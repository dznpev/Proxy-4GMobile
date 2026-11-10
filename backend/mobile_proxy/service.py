"""Application service: device lifecycle, IP rotation and dashboard state."""

from __future__ import annotations

import threading
import time
import uuid
from datetime import date, datetime
from typing import Any

from .adb import AdbClient
from .config import APP_NAME, APP_VERSION, BIN_DIR, REMOTE_BIN, AppConfig
from .demo import DemoBackend
from .events import EventLog
from .i18n import DEFAULT_LANGUAGE, get_message
from .network import NetworkChecker, NetworkError, NetworkInfo
from .storage import (
    MAX_HISTORY,
    MAX_INTERVAL_MIN,
    MIN_INTERVAL_MIN,
    ROTATE_METHODS,
    DataUsageStore,
    HistoryStore,
    SettingsStore,
    validate_settings,
)


class ServiceError(RuntimeError):
    http_status = 400
    code = "bad_request"


class NotConnectedError(ServiceError):
    http_status = 409
    code = "not_connected"


class BusyError(ServiceError):
    http_status = 409
    code = "busy"


class UpstreamError(ServiceError):
    http_status = 502
    code = "upstream_error"


class MobileProxyService:
    def __init__(
        self,
        config: AppConfig,
        *,
        demo: bool = False,
        adb: AdbClient | DemoBackend | None = None,
        checker: NetworkChecker | DemoBackend | None = None,
        echo_logs: bool = True,
        time_scale: float = 1.0,
    ) -> None:
        self.config = config
        self.demo = demo
        if demo:
            backend = DemoBackend()
            self.adb: AdbClient | DemoBackend = adb or backend
            self.checker: NetworkChecker | DemoBackend = checker or backend
        else:
            self.adb = adb or AdbClient(config.adb_path)
            self.checker = checker or NetworkChecker()

        self.events = EventLog(echo=echo_logs)
        self.time_scale = max(0.001, time_scale)
        self.started_at = time.time()

        self._state_lock = threading.RLock()
        self._op_lock = threading.RLock()
        self._stop = threading.Event()
        self._threads: list[threading.Thread] = []
        self._rotation_thread: threading.Thread | None = None
        self._started = False
        self._stopped = False

        self._settings_store = SettingsStore(config.settings_path)
        self._history_store = HistoryStore(config.history_path)
        self._usage_store = DataUsageStore(config.usage_path)
        self.settings = self._settings_store.load()
        self.language = self.settings.get("language", DEFAULT_LANGUAGE)
        self.history = self._history_store.load()

        self._rotating = False
        self._network_checking = False
        self._next_rotate_at: float | None = None
        self._last_network_check = 0.0
        self._last_health_check = 0.0
        self._last_traffic_rx: int | None = None
        self._last_traffic_tx: int | None = None
        self._usage_warning_logged = False
        self._usage_limit_logged = False
        self._adb_missing_logged = False
        self._unauthorized_logged = False
        self._charging_disabled = False
        self._overheat_warning_logged = False
        self._overheat_critical_logged = False
        self._disconnect_misses = 0

        self.device: dict[str, Any] = {
            "connected": False,
            "serial": None,
            "status": "disconnected",
            "model": None,
            "android": None,
            "abi": None,
            "rooted": False,
            "daemon_running": False,
            "forwarded": False,
            "since": None,
            "last_seen": None,
            "last_attempt": None,
            "error": None,
            "battery": None,
        }
        self.proxy: dict[str, Any] = {
            "running": False,
            "forwarded": False,
            "port": config.proxy_port,
            "url": config.proxy_url,
        }
        self.network: dict[str, Any] = {
            "state": "unknown",
            "ip": None,
            "isp": None,
            "city": None,
            "region": None,
            "country": None,
            "latency_ms": None,
            "checked_at": None,
            "error": None,
        }
        self.rotation: dict[str, Any] = {
            "id": None,
            "status": "idle",
            "step": "idle",
            "progress": 0,
            "message": self._t("rotation.idle"),
            "trigger": None,
            "running": False,
            "started_at": None,
            "finished_at": None,
            "duration_sec": None,
            "old_ip": None,
            "new_ip": None,
            "changed": None,
        }

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    def start(self, *, monitor: bool = True, auto_rotate: bool = True) -> None:
        if self._started:
            return
        self._started = True
        self.events.add(
            "info",
            self._t("app.starting", app=APP_NAME, version=APP_VERSION),
            source="app",
        )
        if self.demo:
            self.events.add(
                "warning",
                self._t("app.demo_mode"),
                source="app",
            )
        if not self.adb.available():
            self._adb_missing_logged = True
            self.events.add(
                "error",
                self._t("adb.missing"),
                source="adb",
            )

        if self.demo:
            devices = self.adb.devices()
            if devices:
                self._connect_device(devices[0].serial, reason="startup")

        if monitor:
            self._spawn(self._monitor_loop, "adb-monitor")
        if auto_rotate:
            self._spawn(self._auto_rotate_loop, "auto-rotate")

    def stop(self, *, cleanup: bool = False) -> None:
        if self._stopped:
            return
        self._stopped = True
        self._stop.set()
        for thread in list(self._threads):
            if thread is not threading.current_thread():
                thread.join(timeout=3)
        if self._rotation_thread and self._rotation_thread is not threading.current_thread():
            self._rotation_thread.join(timeout=4)

        if cleanup:
            with self._state_lock:
                serial = self.device.get("serial")
            if serial:
                try:
                    self.adb.shell(serial, "pkill -f mini_proxy", timeout=6)
                    self.adb.remove_forward(serial, self.config.proxy_port)
                    self.events.add(
                        "info",
                        self._t("app.cleanup_done"),
                        source="app",
                    )
                except Exception as exc:  # pragma: no cover - best effort
                    self.events.add(
                        "warning",
                        self._t("app.cleanup_failed", error=exc),
                        source="app",
                    )

    def _t(self, key: str, **kwargs: Any) -> str:
        """Return a catalog message in the service's active language."""
        return get_message(key, self.language, **kwargs)

    def _spawn(self, target: Any, name: str) -> threading.Thread:
        thread = threading.Thread(target=target, name=name, daemon=True)
        thread.start()
        self._threads.append(thread)
        return thread

    def _sleep(self, seconds: float) -> None:
        self._stop.wait(max(0.001, seconds * self.time_scale))

    # ------------------------------------------------------------------
    # Status payloads
    # ------------------------------------------------------------------
    def status(self) -> dict[str, Any]:
        now = time.time()
        with self._state_lock:
            device = dict(self.device)
            network = dict(self.network)
            proxy = dict(self.proxy)
            rotation = dict(self.rotation)
            settings = dict(self.settings)
            next_at = self._next_rotate_at if settings["auto_rotate_enabled"] else None
            history_preview = [dict(item) for item in self.history[:5]]
            stats = self._stats_locked(now)
            session_uptime = (
                int(now - device["since"]) if device.get("since") else 0
            )

        stats["session_uptime_sec"] = max(0, session_uptime)
        stats["app_uptime_sec"] = max(0, int(now - self.started_at))
        try:
            adb_available = bool(self.adb.available())
        except Exception:
            adb_available = False

        return {
            "app": {
                "name": APP_NAME,
                "version": APP_VERSION,
                "demo": self.demo,
                "adb_available": adb_available,
                "dashboard_url": self.config.dashboard_url,
                "proxy_url": self.config.proxy_url,
                "data_dir": str(self.config.data_dir),
                "control_port": self.config.control_port,
                "proxy_port": self.config.proxy_port,
                "uptime_sec": max(0, int(now - self.started_at)),
            },
            "device": device,
            "proxy": proxy,
            "network": network,
            "data_usage": self._data_usage_payload(),
            "rotation": rotation,
            "auto_rotate": {
                "enabled": bool(settings["auto_rotate_enabled"]),
                "interval_min": settings["auto_rotate_interval_min"],
                "next_at": next_at,
            },
            "settings": settings,
            "stats": stats,
            "history": history_preview,
            "server_time": round(now, 3),
        }

    def settings_payload(self) -> dict[str, Any]:
        with self._state_lock:
            settings = dict(self.settings)
            next_at = (
                self._next_rotate_at if settings["auto_rotate_enabled"] else None
            )
        return {
            "settings": settings,
            "auto_rotate": {
                "enabled": bool(settings["auto_rotate_enabled"]),
                "interval_min": settings["auto_rotate_interval_min"],
                "next_at": next_at,
            },
            "options": {
                "rotate_methods": list(ROTATE_METHODS),
                "min_interval_min": MIN_INTERVAL_MIN,
                "max_interval_min": MAX_INTERVAL_MIN,
            },
        }

    def _stats_locked(self, now: float | None = None) -> dict[str, Any]:
        total = len(self.history)
        success = sum(1 for item in self.history if item.get("status") == "success")
        today = date.today()
        rotations_today = 0
        for item in self.history:
            try:
                if datetime.fromtimestamp(float(item["ts"])).date() == today:
                    rotations_today += 1
            except (KeyError, TypeError, ValueError, OSError):
                continue
        return {
            "total": total,
            "success": success,
            "failed": total - success,
            "success_rate": round(success / total * 100) if total else None,
            "today": rotations_today,
            "last_rotation_at": self.history[0].get("ts") if self.history else None,
        }

    # ------------------------------------------------------------------
    # Device lifecycle
    # ------------------------------------------------------------------
    def _monitor_loop(self) -> None:
        while not self._stop.is_set():
            try:
                if not self.adb.available():
                    if not self._adb_missing_logged:
                        self._adb_missing_logged = True
                        self.events.add(
                            "error",
                            self._t("adb.missing_waiting"),
                            source="adb",
                        )
                    with self._state_lock:
                        if not self.device["connected"]:
                            self.device["status"] = "adb-missing"
                            self.device["error"] = self._t("adb.command_missing")
                    self._stop.wait(5)
                    continue

                if self._adb_missing_logged:
                    self._adb_missing_logged = False
                    self.events.add("info", self._t("adb.found"), source="adb")

                devices = self.adb.devices()
                ready = [item for item in devices if item.status == "device"]
                unauthorized = [
                    item for item in devices if item.status == "unauthorized"
                ]

                if ready:
                    self._disconnect_misses = 0
                    serial = ready[0].serial
                    with self._state_lock:
                        current = self.device["serial"]
                        connected = self.device["connected"]
                        device_status = self.device["status"]
                        last_attempt = self.device["last_attempt"] or 0
                        self.device["last_seen"] = time.time()
                        self._unauthorized_logged = False

                    if (
                        serial != current
                        or not connected
                        or device_status in ("disconnected", "unauthorized", "adb-missing")
                    ):
                        self._connect_device(serial)
                    else:
                        self._periodic_health(
                            serial, device_status, last_attempt=last_attempt
                        )
                else:
                    with self._state_lock:
                        rotating = self._rotating
                    self._disconnect_misses += 1
                    # Debounce disconnects: require at least 3 misses (~6s) or 5 misses (~10s) during rotation
                    threshold = 5 if rotating else 3
                    if self._disconnect_misses >= threshold:
                        with self._state_lock:
                            was_known = self.device["connected"] or self.device[
                                "status"
                            ] in ("ready", "preparing", "error", "unauthorized")
                        if was_known:
                            self._mark_disconnected()

                    if unauthorized:
                        serial = unauthorized[0].serial
                        with self._state_lock:
                            self.device["serial"] = serial
                            self.device["status"] = "unauthorized"
                            self.device["error"] = self._t("adb.unauthorized_error")
                        if not self._unauthorized_logged:
                            self._unauthorized_logged = True
                            self.events.add(
                                "warning",
                                self._t("adb.unauthorized"),
                                source="adb",
                            )
            except FileNotFoundError:
                if not self._adb_missing_logged:
                    self._adb_missing_logged = True
                    self.events.add(
                        "error",
                        self._t("adb.failed"),
                        source="adb",
                    )
            except Exception as exc:  # keep the monitor alive
                self.events.add(
                    "error", self._t("adb.monitor_error", error=exc), source="adb"
                )
            self._stop.wait(2)

    def _periodic_health(
        self, serial: str, status: str, *, last_attempt: float
    ) -> None:
        now = time.time()
        if status == "error" and now - last_attempt > 60:
            self._connect_device(serial, reason="retry")
            return
        if status != "ready":
            return
        if now - self._last_health_check < 15:
            return
        self._last_health_check = now

        with self._state_lock:
            rotating = self._rotating
        if rotating:
            return

        alive = False
        try:
            alive = bool(self.adb.pidof(serial, "mini_proxy"))
        except Exception:
            alive = False

        with self._state_lock:
            self.proxy["running"] = alive
            self.device["daemon_running"] = alive

        if not alive:
            if self._op_lock.acquire(blocking=False):
                try:
                    self.events.add(
                        "warning",
                        self._t("proxy.unresponsive_restarting"),
                        source="proxy",
                    )
                    self._start_daemon(serial)
                finally:
                    self._op_lock.release()
            return
        else:
            try:
                is_fwd = getattr(self.adb, "is_forwarded", None)
                if callable(is_fwd) and not is_fwd(serial, self.config.proxy_port):
                    self.adb.forward(serial, self.config.proxy_port, self.config.proxy_port)
                    with self._state_lock:
                        self.proxy["forwarded"] = True
                        self.device["forwarded"] = True
            except Exception:
                pass

        self._update_battery(serial)
        self._update_traffic(serial)

        if now - self._last_network_check > 60:
            with self._state_lock:
                has_serial = bool(self.device["serial"])
            if has_serial:
                self._check_network(announce=False)

    def _connect_device(self, serial: str, *, reason: str = "detected") -> None:
        if not self._op_lock.acquire(timeout=3):
            with self._state_lock:
                if self.device["status"] == "preparing":
                    if self.device["daemon_running"]:
                        self.device["status"] = "ready"
                    else:
                        self.device["status"] = "error"
                        self.device["error"] = self._t("device.busy_retry")
            self.events.add(
                "warning",
                self._t("device.busy_skip"),
                source="adb",
            )
            return
        try:
            now = time.time()
            with self._state_lock:
                previous_serial = self.device["serial"]
                self.device.update(
                    {
                        "connected": True,
                        "serial": serial,
                        "status": "preparing",
                        "since": self.device["since"] if previous_serial == serial else now,
                        "last_seen": now,
                        "last_attempt": now,
                        "error": None,
                    }
                )
            if reason == "manual":
                self.events.add(
                    "info", self._t("device.reconnect_requested"), source="adb"
                )
            elif reason == "retry":
                self.events.add(
                    "info", self._t("device.reconnect_retry"), source="adb"
                )
            else:
                self.events.add(
                    "info", self._t("device.detected", serial=serial), source="adb"
                )

            model = (
                self.adb.getprop(serial, "ro.product.model").strip()
                or self._t("common.unknown")
            )
            android = (
                self.adb.getprop(serial, "ro.build.version.release").strip()
                or self._t("common.unknown")
            )
            abi = (
                self.adb.getprop(serial, "ro.product.cpu.abi").strip()
                or "arm64-v8a"
            )
            rooted = False
            try:
                rooted = bool(self.adb.is_rooted(serial))
            except Exception:
                rooted = False

            with self._state_lock:
                self.device.update(
                    {"model": model, "android": android, "abi": abi, "rooted": rooted}
                )
            self.events.add(
                "info",
                self._t(
                    "device.summary",
                    model=model,
                    android=android,
                    abi=abi,
                    root_status=self._t(
                        "common.rooted" if rooted else "common.not_rooted"
                    ),
                ),
                source="adb",
            )

            chosen = BIN_DIR / (
                "proxy_arm64.bin" if "arm64" in abi.lower() else "proxy_arm32.bin"
            )
            if not chosen.exists():
                raise RuntimeError(
                    self._t("proxy.binary_missing", name=chosen.name)
                )

            self.events.add(
                "info", self._t("proxy.stopping_old"), source="proxy"
            )
            self.adb.shell(serial, "pkill -f mini_proxy", timeout=8)
            self._sleep(0.4)

            self.events.add(
                "info", self._t("proxy.syncing"), source="proxy"
            )
            self.adb.push(serial, str(chosen), REMOTE_BIN)
            self.adb.shell(serial, f"chmod 755 {REMOTE_BIN}", timeout=8)

            running = self._start_daemon(serial)
            if not running:
                raise RuntimeError(self._t("proxy.start_failed_device"))

            with self._state_lock:
                self.device["status"] = "ready"
                self.device["since"] = now
            self._last_health_check = time.time()
            self._update_battery(serial)
            self._update_traffic(serial)
            self._check_network(announce=True)
            self._schedule_next()
            self.events.add(
                "success",
                self._t("proxy.session_ready", model=model),
                source="app",
            )
        except Exception as exc:
            with self._state_lock:
                self.device["status"] = "error"
                self.device["error"] = str(exc)
                self.device["daemon_running"] = False
                self.device["forwarded"] = False
                self.proxy["running"] = False
                self.proxy["forwarded"] = False
                self._next_rotate_at = None
            self.events.add(
                "error", self._t("proxy.setup_failed", error=exc), source="proxy"
            )
        finally:
            self._op_lock.release()

    def _start_daemon(self, serial: str) -> bool:
        try:
            self.events.add(
                "info",
                self._t("proxy.starting", port=self.config.proxy_port),
                source="proxy",
            )
            command = (
                f"nohup {REMOTE_BIN} -port {self.config.proxy_port} "
                "</dev/null >/dev/null 2>&1 &"
            )
            self.adb.shell(serial, command, timeout=10)
            self._sleep(1.4)
            pid = self.adb.pidof(serial, "mini_proxy")
            running = bool(pid)
            forwarded = False
            if running:
                self.adb.forward(
                    serial, self.config.proxy_port, self.config.proxy_port
                )
                forwarded = True
            with self._state_lock:
                self.proxy.update({"running": running, "forwarded": forwarded})
                self.device["daemon_running"] = running
                self.device["forwarded"] = forwarded
            if running:
                self.events.add(
                    "success",
                    self._t("proxy.running", pid=pid),
                    source="proxy",
                )
            else:
                self.events.add(
                    "error",
                    self._t("proxy.not_running"),
                    source="proxy",
                )
            return running
        except Exception as exc:
            with self._state_lock:
                self.proxy.update({"running": False, "forwarded": False})
                self.device["daemon_running"] = False
                self.device["forwarded"] = False
            self.events.add(
                "error", self._t("proxy.start_failed", error=exc), source="proxy"
            )
            return False

    def _mark_disconnected(self) -> None:
        with self._state_lock:
            was_connected = self.device["connected"]
            self.device.update(
                {
                    "connected": False,
                    "status": "disconnected",
                    "since": None,
                    "daemon_running": False,
                    "forwarded": False,
                    "error": None,
                    "battery": None,
                    "rooted": False,
                }
            )
            self.proxy.update({"running": False, "forwarded": False})
            self.network.update(
                {
                    "state": "offline",
                    "error": self._t("network.device_disconnected"),
                }
            )
            self._next_rotate_at = None
        if was_connected:
            self.events.add(
                "warning",
                self._t("device.disconnected"),
                source="adb",
            )

    def _update_battery(self, serial: str) -> dict[str, Any] | None:
        try:
            battery = self.adb.battery_info(serial)
            if not battery or battery.get("level") is None:
                return None

            temp = battery.get("temperature")
            warning_level = "normal"
            if temp is not None:
                if temp >= 45.0:
                    warning_level = "danger"
                    if not self._overheat_critical_logged:
                        self.events.add(
                            "error",
                            self._t("battery.critical", temp=temp),
                            source="adb",
                        )
                        self._overheat_critical_logged = True
                        try:
                            self.adb.set_charging(serial, False)
                            self._charging_disabled = True
                        except Exception:
                            pass
                elif temp >= 40.0:
                    warning_level = "warning"
                    if not self._overheat_warning_logged:
                        self.events.add(
                            "warning",
                            self._t("battery.warning", temp=temp),
                            source="adb",
                        )
                        self._overheat_warning_logged = True
                else:
                    if temp < 38.5:
                        self._overheat_warning_logged = False
                        self._overheat_critical_logged = False

            battery["warning_level"] = warning_level
            battery["charging_disabled"] = self._charging_disabled
            try:
                battery["root_supported"] = self.adb.is_rooted(serial)
            except Exception:
                battery["root_supported"] = False

            with self._state_lock:
                self.device["battery"] = battery
            return battery
        except Exception:
            return None

    # ------------------------------------------------------------------
    # Network verification
    # ------------------------------------------------------------------
    def _check_network(self, *, announce: bool = False) -> bool:
        with self._state_lock:
            serial = self.device["serial"]
            connected = self.device["connected"]
            if announce:
                self.network["state"] = "checking"
            previous_ip = self.network["ip"]
            previous_state = self.network["state"]
            previous_error = self.network["error"]

        if not connected or not serial:
            if announce:
                raise NotConnectedError(self._t("errors.not_connected"))
            return False

        try:
            info = self.checker.check(self.config.proxy_port)
        except NetworkError as exc:
            message = str(exc)
            with self._state_lock:
                self.network.update(
                    {
                        "state": "error",
                        "latency_ms": None,
                        "error": message,
                    }
                )
                self._last_network_check = time.time()
            if announce or previous_error != message:
                self.events.add(
                    "error",
                    self._t("network.verify_failed", error=message),
                    source="network",
                )
            return False
        except Exception as exc:
            message = self._t("network.unknown_error", error=exc)
            with self._state_lock:
                self.network.update({"state": "error", "error": message})
                self._last_network_check = time.time()
            if announce or previous_error != message:
                self.events.add("error", message, source="network")
            return False

        with self._state_lock:
            self.network.update(
                {
                    "state": "online",
                    "ip": info.ip,
                    "isp": info.isp,
                    "city": info.city,
                    "region": info.region,
                    "country": info.country,
                    "latency_ms": info.latency_ms,
                    "checked_at": info.checked_at,
                    "error": None,
                }
            )
            self._last_network_check = time.time()

        if (
            announce
            or previous_state in ("error", "offline", "unknown")
            or (previous_ip and previous_ip != info.ip)
        ):
            self.events.add(
                "success",
                self._t(
                    "network.public_ip",
                    ip=info.ip,
                    isp=info.isp,
                    city=info.city,
                ).rstrip(" ·"),
                source="network",
            )
        return True

    def refresh_network(self) -> dict[str, Any]:
        with self._state_lock:
            if not self.device["connected"] or not self.device["serial"]:
                raise NotConnectedError(self._t("errors.not_connected"))
            if self._rotating:
                raise BusyError(self._t("errors.rotating"))
            if self._network_checking:
                raise BusyError(self._t("errors.checking_network"))
        if not self._op_lock.acquire(blocking=False):
            raise BusyError(self._t("errors.device_busy"))
        try:
            with self._state_lock:
                if self._network_checking:
                    raise BusyError(self._t("errors.checking_network"))
                self._network_checking = True
            try:
                ok = self._check_network(announce=True)
            finally:
                with self._state_lock:
                    self._network_checking = False
        finally:
            self._op_lock.release()

        if not ok:
            with self._state_lock:
                message = self.network.get("error") or self._t(
                    "network.check_failed"
                )
            raise UpstreamError(message)
        return self.status()

    # ------------------------------------------------------------------
    # IP rotation
    # ------------------------------------------------------------------
    def rotate(self, *, trigger: str = "manual", wait: bool = False) -> dict[str, Any]:
        with self._state_lock:
            if self._rotating:
                raise BusyError(self._t("errors.rotation_running"))
            if not self.device["connected"] or not self.device["serial"]:
                raise NotConnectedError(self._t("errors.not_connected"))
            if not self.device["daemon_running"]:
                raise BusyError(self._t("errors.daemon_not_running"))

            job_id = uuid.uuid4().hex[:10]
            old_ip = self.network.get("ip")
            now = time.time()
            self._rotating = True
            self.rotation = {
                "id": job_id,
                "status": "running",
                "step": "preparing",
                "progress": 8,
                "message": self._t("rotation.preparing"),
                "trigger": trigger,
                "running": True,
                "started_at": now,
                "finished_at": None,
                "duration_sec": None,
                "old_ip": old_ip,
                "new_ip": None,
                "changed": None,
            }
            self.network["state"] = "rotating"
            self.network["error"] = None
            serial = self.device["serial"]

        label = {
            "auto": self._t("rotation.trigger_auto"),
            "legacy": self._t("rotation.trigger_api"),
        }.get(trigger, self._t("rotation.trigger_manual"))
        self.events.add(
            "info", self._t("rotation.started", trigger=label), source="rotation"
        )

        thread = threading.Thread(
            target=self._run_rotation,
            args=(job_id, trigger, old_ip, serial),
            name="ip-rotation",
            daemon=True,
        )
        self._rotation_thread = thread
        try:
            thread.start()
        except Exception as exc:
            with self._state_lock:
                self._rotating = False
                self.rotation.update(
                    {
                        "status": "failed",
                        "step": "error",
                        "message": self._t(
                            "rotation.start_failed_detail", error=exc
                        ),
                        "running": False,
                    }
                )
            raise ServiceError(self._t("errors.rotation_start_failed")) from exc
        if wait:
            thread.join(timeout=120)
        with self._state_lock:
            return dict(self.rotation)

    def _run_rotation(
        self, job_id: str, trigger: str, old_ip: str | None, serial: str
    ) -> None:
        started = time.time()
        success = False
        info: NetworkInfo | None = None
        message = ""
        try:
            with self._op_lock:
                method = self.settings["rotate_method"]
                attempts = 2
                last_error: str | None = None

                for attempt in range(1, attempts + 1):
                    if self._stop.is_set():
                        raise RuntimeError(self._t("errors.app_stopping"))

                    base = 20 if attempt == 1 else 42
                    self._set_rotation(
                        step="network-off",
                        progress=base,
                        message=(
                            self._t("rotation.airplane_on")
                            if method == "airplane"
                            else self._t("rotation.data_off")
                        ),
                    )
                    self._toggle_network(serial, method, enabled=True)
                    self._sleep(2.5 if method == "airplane" else 2.0)

                    self._set_rotation(
                        step="network-on",
                        progress=base + 14,
                        message=(
                            self._t("rotation.airplane_off")
                            if method == "airplane"
                            else self._t("rotation.data_on")
                        ),
                    )
                    self._toggle_network(serial, method, enabled=False)
                    self._sleep(3.0 if method == "airplane" else 2.5)

                    self._set_rotation(
                        step="waiting",
                        progress=base + 26,
                        message=self._t("rotation.waiting"),
                    )
                    self._ensure_daemon_after_rotation(serial)
                    self._sleep(1.0)

                    self._set_rotation(
                        step="verifying",
                        progress=75 if attempt == 1 else 88,
                        message=self._t("rotation.verifying"),
                    )

                    # Adaptive polling loop: allow time for 4G radio negotiation & DNS resolution
                    poll_deadline = time.time() + (12.0 * self.time_scale)
                    info = None
                    while time.time() < poll_deadline and not self._stop.is_set():
                        try:
                            is_fwd = getattr(self.adb, "is_forwarded", None)
                            if callable(is_fwd) and not is_fwd(serial, self.config.proxy_port):
                                self.adb.forward(serial, self.config.proxy_port, self.config.proxy_port)

                            info = self.checker.check(self.config.proxy_port)
                            if info is not None:
                                break
                        except NetworkError as exc:
                            last_error = str(exc)
                            if "Không kết nối được tới proxy trên máy tính" in last_error:
                                self.adb.forward(serial, self.config.proxy_port, self.config.proxy_port)
                        self._sleep(1.5)

                    if info is None:
                        err_text = last_error or self._t("rotation.no_ip")
                        if attempt < attempts:
                            self.events.add(
                                "warning",
                                self._t(
                                    "rotation.retry_verify",
                                    error=err_text,
                                    attempt=attempt + 1,
                                    attempts=attempts,
                                ),
                                source="rotation",
                            )
                            self._sleep(3.0)
                            continue
                        raise NetworkError(err_text)

                    if old_ip and info.ip == old_ip and attempt < attempts:
                        self.events.add(
                            "warning",
                            self._t("rotation.same_ip_retry"),
                            source="rotation",
                        )
                        self._sleep(2.0)
                        continue
                    break

                if info is None:
                    raise RuntimeError(last_error or self._t("rotation.no_ip"))

                changed = bool(old_ip) and info.ip != old_ip
                with self._state_lock:
                    self.network.update(
                        {
                            "state": "online",
                            "ip": info.ip,
                            "isp": info.isp,
                            "city": info.city,
                            "region": info.region,
                            "country": info.country,
                            "latency_ms": info.latency_ms,
                            "checked_at": info.checked_at,
                            "error": None,
                        }
                    )
                    self._last_network_check = time.time()

                if changed or not old_ip:
                    message = self._t("rotation.success", ip=info.ip)
                else:
                    message = self._t("rotation.unchanged", ip=info.ip)
                success = True
                finished = time.time()
                duration = round(finished - started, 1)
                with self._state_lock:
                    self.rotation.update(
                        {
                            "status": "success",
                            "step": "done",
                            "progress": 100,
                            "message": message,
                            "running": False,
                            "finished_at": finished,
                            "duration_sec": duration,
                            "new_ip": info.ip,
                            "changed": changed if old_ip else True,
                        }
                    )
                if changed or not old_ip:
                    self.events.add(
                        "success",
                        self._t(
                            "rotation.success_log",
                            old_ip=old_ip or "—",
                            ip=info.ip,
                            isp=info.isp,
                        ),
                        source="rotation",
                    )
                else:
                    self.events.add(
                        "warning",
                        self._t("rotation.same_ip_final", ip=info.ip),
                        source="rotation",
                    )
                self._record_history(
                    job_id=job_id,
                    trigger=trigger,
                    status="success",
                    started=started,
                    old_ip=old_ip,
                    new_ip=info.ip,
                    isp=info.isp,
                    city=info.city,
                    message=message,
                    changed=bool(changed),
                )
        except Exception as exc:
            message = str(exc) or self._t("rotation.failed")
            finished = time.time()
            with self._state_lock:
                self.rotation.update(
                    {
                        "status": "failed",
                        "step": "error",
                        "progress": 100,
                        "message": message,
                        "running": False,
                        "finished_at": finished,
                        "duration_sec": round(finished - started, 1),
                    }
                )
                if self.network.get("state") == "rotating":
                    self.network["state"] = "error"
                    self.network["error"] = message
            self.events.add(
                "error",
                self._t("rotation.failed_log", error=message),
                source="rotation",
            )
            self._record_history(
                job_id=job_id,
                trigger=trigger,
                status="failed",
                started=started,
                old_ip=old_ip,
                new_ip=None,
                isp=None,
                city=None,
                message=message,
                changed=False,
            )
        finally:
            self._schedule_next()
            with self._state_lock:
                self._rotating = False
                self.rotation["running"] = False

    def _toggle_network(self, serial: str, method: str, *, enabled: bool) -> None:
        if method == "data":
            command = "svc data disable" if enabled else "svc data enable"
            self.adb.shell(serial, command, timeout=8)
            return
        self._set_airplane(serial, enabled)

    def _set_airplane(self, serial: str, enabled: bool) -> None:
        action = "enable" if enabled else "disable"
        output = self.adb.shell(
            serial, f"cmd connectivity airplane-mode {action}", timeout=8
        )
        lowered = output.lower()
        if any(
            token in lowered
            for token in ("unknown", "error", "exception", "not found")
        ):
            value = "1" if enabled else "0"
            state = "true" if enabled else "false"
            self.adb.shell(
                serial,
                "settings put global airplane_mode_on "
                f"{value}; am broadcast -a android.intent.action.AIRPLANE_MODE "
                f"--ez state {state}",
                timeout=8,
            )

    def _ensure_daemon_after_rotation(self, serial: str) -> None:
        pids = self.adb.pidof(serial, "mini_proxy")
        alive = bool(pids)
        if not alive:
            self.events.add(
                "warning",
                self._t("proxy.stopped_after_network_restarting"),
                source="proxy",
            )
            if not self._start_daemon(serial):
                raise RuntimeError(self._t("proxy.restart_failed_rotation"))
        else:
            for _ in range(3):
                self.adb.forward(
                    serial, self.config.proxy_port, self.config.proxy_port
                )
                is_fwd = getattr(self.adb, "is_forwarded", None)
                if callable(is_fwd) and not is_fwd(serial, self.config.proxy_port):
                    self._sleep(0.4)
                else:
                    break

            with self._state_lock:
                self.proxy.update({"running": True, "forwarded": True})
                self.device["daemon_running"] = True
                self.device["forwarded"] = True
                if self.device["status"] == "preparing":
                    self.device["status"] = "ready"

    def _set_rotation(self, **changes: Any) -> None:
        with self._state_lock:
            self.rotation.update(changes)

    def _record_history(
        self,
        *,
        job_id: str,
        trigger: str,
        status: str,
        started: float,
        old_ip: str | None,
        new_ip: str | None,
        isp: str | None,
        city: str | None,
        message: str,
        changed: bool,
    ) -> None:
        entry = {
            "id": job_id,
            "ts": round(time.time(), 3),
            "trigger": trigger,
            "status": status,
            "old_ip": old_ip,
            "new_ip": new_ip,
            "isp": isp,
            "city": city,
            "message": message,
            "changed": changed,
            "duration_sec": round(time.time() - started, 1),
        }
        with self._state_lock:
            self.history.insert(0, entry)
            self.history = self.history[:MAX_HISTORY]
            entries = list(self.history)
        try:
            self._history_store.save(entries)
        except OSError as exc:
            self.events.add(
                "warning",
                self._t("history.save_failed", error=exc),
                source="storage",
            )

    def history_payload(self) -> dict[str, Any]:
        with self._state_lock:
            items = [dict(item) for item in self.history]
            stats = self._stats_locked()
        return {"items": items, "stats": stats}

    def clear_history(self) -> dict[str, Any]:
        with self._state_lock:
            self.history = []
        try:
            self._history_store.save([])
        except OSError as exc:
            self.events.add(
                "warning",
                self._t("history.save_failed", error=exc),
                source="storage",
            )
        self.events.add("info", self._t("history.cleared"), source="app")
        with self._state_lock:
            stats = self._stats_locked()
        return {"stats": stats}

    # ------------------------------------------------------------------
    # Settings, scheduling and maintenance
    # ------------------------------------------------------------------
    def update_settings(self, payload: dict[str, Any]) -> dict[str, Any]:
        with self._state_lock:
            current = dict(self.settings)
        candidate = validate_settings(payload, current)
        language_changed = current.get("language") != candidate["language"]
        with self._state_lock:
            self.settings = candidate
            self.language = candidate.get("language", DEFAULT_LANGUAGE)
            self._settings_store.save(candidate)
            if candidate["auto_rotate_enabled"] and self.device["connected"]:
                self._next_rotate_at = (
                    time.time() + candidate["auto_rotate_interval_min"] * 60
                )
            else:
                self._next_rotate_at = None

        if language_changed:
            self.events.add(
                "info",
                self._t("settings.language_changed", language=self.language),
                source="settings",
            )
        if current.get("auto_rotate_enabled") != candidate["auto_rotate_enabled"]:
            if candidate["auto_rotate_enabled"]:
                self.events.add(
                    "success",
                    self._t(
                        "settings.auto_rotate_enabled",
                        minutes=candidate["auto_rotate_interval_min"],
                    ),
                    source="settings",
                )
            else:
                self.events.add(
                    "info", self._t("settings.auto_rotate_disabled"), source="settings"
                )
        elif (
            current.get("auto_rotate_interval_min")
            != candidate["auto_rotate_interval_min"]
        ):
            self.events.add(
                "info",
                self._t(
                    "settings.interval_changed",
                    minutes=candidate["auto_rotate_interval_min"],
                ),
                source="settings",
            )
        if current.get("rotate_method") != candidate["rotate_method"]:
            label = self._t(
                "settings.method_airplane"
                if candidate["rotate_method"] == "airplane"
                else "settings.method_data"
            )
            self.events.add(
                "info",
                self._t("settings.method_changed", method=label),
                source="settings",
            )
        return self.settings_payload()

    def _schedule_next(self) -> None:
        with self._state_lock:
            if (
                self.settings["auto_rotate_enabled"]
                and self.device["connected"]
            ):
                self._next_rotate_at = (
                    time.time()
                    + self.settings["auto_rotate_interval_min"] * 60
                )
            else:
                self._next_rotate_at = None

    def _auto_rotate_loop(self) -> None:
        while not self._stop.is_set():
            try:
                now = time.time()
                with self._state_lock:
                    due = (
                        self.settings["auto_rotate_enabled"]
                        and self.device["connected"]
                        and self._next_rotate_at is not None
                        and now >= self._next_rotate_at
                        and not self._rotating
                    )
                if due:
                    try:
                        self.rotate(trigger="auto")
                    except ServiceError as exc:
                        self.events.add(
                            "warning",
                            self._t("auto_rotate.failed", error=exc),
                            source="auto",
                        )
                        with self._state_lock:
                            self._next_rotate_at = time.time() + 60
            except Exception as exc:  # pragma: no cover - defensive
                self.events.add(
                    "error",
                    self._t("auto_rotate.schedule_error", error=exc),
                    source="auto",
                )
            self._stop.wait(1)

    def reconnect_device(self) -> dict[str, Any]:
        with self._state_lock:
            serial = self.device["serial"]
            status = self.device["status"]
            if not serial:
                raise NotConnectedError(self._t("errors.device_not_detected"))
            if self._rotating:
                raise BusyError(self._t("errors.rotating"))
            if status == "preparing":
                raise BusyError(self._t("errors.device_connecting"))
            self.device["status"] = "preparing"
            self.device["error"] = None
        self._spawn(
            lambda: self._connect_device(serial, reason="manual"),
            "reconnect-device",
        )
        return {"message": self._t("device.reconnecting")}

    def set_device_charging(self, enabled: bool) -> dict[str, Any]:
        with self._state_lock:
            if not self.device["connected"] or not self.device["serial"]:
                raise NotConnectedError(self._t("errors.not_connected"))
            serial = self.device["serial"]

        self.adb.set_charging(serial, enabled)
        self._charging_disabled = not enabled
        action = self._t(
            "battery.charging_on" if enabled else "battery.charging_off"
        )
        self.events.add(
            "info" if enabled else "warning",
            self._t("battery.charging_action", action=action, serial=serial),
            source="adb",
        )
        battery = self._update_battery(serial)
        return {"ok": True, "battery": battery or {}}

    def reset_today_usage(self) -> dict[str, Any]:
        """Reset data usage counters for today."""
        self._usage_store.reset_today()
        self._last_traffic_rx = None
        self._last_traffic_tx = None
        self._usage_warning_logged = False
        self._usage_limit_logged = False
        self.events.add(
            "info",
            self._t("usage.reset"),
            source="app",
        )
        return {"ok": True, "data_usage": self._data_usage_payload()}

    def _update_traffic(self, serial: str) -> None:
        try:
            traffic = self.adb.network_traffic(serial)
            rx = int(traffic.get("rx_bytes", 0))
            tx = int(traffic.get("tx_bytes", 0))

            if self._last_traffic_rx is not None and self._last_traffic_tx is not None:
                rx_delta = rx - self._last_traffic_rx if rx >= self._last_traffic_rx else rx
                tx_delta = tx - self._last_traffic_tx if tx >= self._last_traffic_tx else tx
                if rx_delta > 0 or tx_delta > 0:
                    self._usage_store.record_delta(rx_delta, tx_delta)

            self._last_traffic_rx = rx
            self._last_traffic_tx = tx
        except Exception:
            pass

    def _data_usage_payload(self) -> dict[str, Any]:
        today_usage = self._usage_store.get_today()
        today_bytes = today_usage["total_bytes"]
        limit_gb = float(self.settings.get("daily_data_limit_gb", 4.0))
        limit_bytes = int(limit_gb * 1024 * 1024 * 1024) if limit_gb > 0 else 0
        usage_percent = (
            round((today_bytes / limit_bytes) * 100, 1) if limit_bytes > 0 else 0.0
        )
        warning = limit_bytes > 0 and usage_percent >= 80.0
        exceeded = limit_bytes > 0 and today_bytes >= limit_bytes

        if warning and not self._usage_warning_logged:
            used_gb = round(today_bytes / (1024**3), 2)
            self.events.add(
                "warning",
                self._t(
                    "usage.warning",
                    percent=usage_percent,
                    used=used_gb,
                    limit=limit_gb,
                ),
                source="network",
            )
            self._usage_warning_logged = True
        elif exceeded and not self._usage_limit_logged:
            self.events.add(
                "error",
                self._t("usage.exceeded", limit=limit_gb),
                source="network",
            )
            self._usage_limit_logged = True

        return {
            "today_rx_bytes": today_usage["rx_bytes"],
            "today_tx_bytes": today_usage["tx_bytes"],
            "today_total_bytes": today_bytes,
            "daily_limit_gb": limit_gb,
            "daily_limit_bytes": limit_bytes,
            "usage_percent": usage_percent,
            "warning": warning,
            "exceeded": exceeded,
        }

    def restart_proxy(self) -> dict[str, Any]:
        with self._state_lock:
            serial = self.device["serial"]
            if not serial or not self.device["connected"]:
                raise NotConnectedError(self._t("errors.not_connected"))
            if self._rotating:
                raise BusyError(self._t("errors.rotating"))
            if self.device["status"] == "preparing":
                raise BusyError(self._t("errors.device_connecting"))
        self._spawn(lambda: self._restart_proxy_worker(serial), "restart-proxy")
        return {"message": self._t("proxy.restarting")}

    def _restart_proxy_worker(self, serial: str) -> None:
        if not self._op_lock.acquire(timeout=3):
            self.events.add(
                "warning",
                self._t("proxy.busy_restart"),
                source="proxy",
            )
            return
        try:
            self.events.add(
                "info", self._t("proxy.restart_requested"), source="proxy"
            )
            self.adb.shell(serial, "pkill -f mini_proxy", timeout=8)
            self._sleep(0.4)
            if self._start_daemon(serial):
                self._check_network(announce=True)
                with self._state_lock:
                    self.device["status"] = "ready"
                    self.device["error"] = None
                self.events.add(
                    "success", self._t("proxy.restarted"), source="proxy"
                )
            else:
                with self._state_lock:
                    self.device["status"] = "error"
                    self.device["error"] = self._t("proxy.restart_failed")
        finally:
            self._op_lock.release()

    def clear_logs(self) -> dict[str, Any]:
        self.events.clear()
        entry = self.events.add(
            "info", self._t("logs.cleared"), source="app"
        )
        return {"last_id": entry["id"]}
