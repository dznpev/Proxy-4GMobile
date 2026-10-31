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
from .network import NetworkChecker, NetworkError, NetworkInfo
from .storage import (
    MAX_HISTORY,
    MAX_INTERVAL_MIN,
    MIN_INTERVAL_MIN,
    ROTATE_METHODS,
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
        self.settings = self._settings_store.load()
        self.history = self._history_store.load()

        self._rotating = False
        self._network_checking = False
        self._next_rotate_at: float | None = None
        self._last_network_check = 0.0
        self._last_health_check = 0.0
        self._adb_missing_logged = False
        self._unauthorized_logged = False
        self._charging_disabled = False
        self._overheat_warning_logged = False
        self._overheat_critical_logged = False

        self.device: dict[str, Any] = {
            "connected": False,
            "serial": None,
            "status": "disconnected",
            "model": None,
            "android": None,
            "abi": None,
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
            "message": "Chưa xoay IP trong phiên này.",
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
            "info", f"Khởi động {APP_NAME} v{APP_VERSION}.", source="app"
        )
        if self.demo:
            self.events.add(
                "warning",
                "Chế độ DEMO đang bật: thiết bị và IP đều được mô phỏng.",
                source="app",
            )
        if not self.adb.available():
            self._adb_missing_logged = True
            self.events.add(
                "error",
                "Không tìm thấy ADB trong PATH. Cài Android Platform Tools để tiếp tục.",
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
                        "Đã dừng daemon proxy và giải phóng cổng trên điện thoại.",
                        source="app",
                    )
                except Exception as exc:  # pragma: no cover - best effort
                    self.events.add(
                        "warning", f"Không dọn dẹp được thiết bị: {exc}", source="app"
                    )

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
                            "Không tìm thấy ADB trong PATH. Đang chờ Android Platform Tools.",
                            source="adb",
                        )
                    with self._state_lock:
                        if not self.device["connected"]:
                            self.device["status"] = "adb-missing"
                            self.device["error"] = (
                                "Không tìm thấy lệnh adb trên máy tính."
                            )
                    self._stop.wait(5)
                    continue

                if self._adb_missing_logged:
                    self._adb_missing_logged = False
                    self.events.add("info", "Đã tìm thấy ADB.", source="adb")

                devices = self.adb.devices()
                ready = [item for item in devices if item.status == "device"]
                unauthorized = [
                    item for item in devices if item.status == "unauthorized"
                ]

                if ready:
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
                            self.device["error"] = (
                                "Thiết bị chưa được ủy quyền gỡ lỗi USB."
                            )
                        if not self._unauthorized_logged:
                            self._unauthorized_logged = True
                            self.events.add(
                                "warning",
                                "Thiết bị chưa được ủy quyền. Bấm 'Cho phép gỡ lỗi USB' trên màn hình điện thoại.",
                                source="adb",
                            )
            except FileNotFoundError:
                if not self._adb_missing_logged:
                    self._adb_missing_logged = True
                    self.events.add(
                        "error",
                        "Không chạy được ADB. Kiểm tra Android Platform Tools trong PATH.",
                        source="adb",
                    )
            except Exception as exc:  # keep the monitor alive
                self.events.add(
                    "error", f"Lỗi giám sát thiết bị: {exc}", source="adb"
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
                        "Daemon proxy không phản hồi. Đang khởi động lại...",
                        source="proxy",
                    )
                    self._start_daemon(serial)
                finally:
                    self._op_lock.release()
            return

        self._update_battery(serial)

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
                        self.device["error"] = (
                            "Thiết bị đang bận. Hãy thử kết nối lại."
                        )
            self.events.add(
                "warning",
                "Thiết bị đang xử lý thao tác khác. Bỏ qua lần kết nối này.",
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
                    "info", "Đang kết nối lại thiết bị theo yêu cầu.", source="adb"
                )
            elif reason == "retry":
                self.events.add(
                    "info", "Đang thử kết nối lại thiết bị...", source="adb"
                )
            else:
                self.events.add(
                    "info", f"Phát hiện thiết bị Android: {serial}", source="adb"
                )

            model = self.adb.getprop(serial, "ro.product.model").strip() or "Không xác định"
            android = (
                self.adb.getprop(serial, "ro.build.version.release").strip()
                or "Không xác định"
            )
            abi = (
                self.adb.getprop(serial, "ro.product.cpu.abi").strip()
                or "arm64-v8a"
            )
            with self._state_lock:
                self.device.update(
                    {"model": model, "android": android, "abi": abi}
                )
            self.events.add(
                "info",
                f"Thiết bị: {model} · Android {android} · {abi}",
                source="adb",
            )

            chosen = BIN_DIR / (
                "proxy_arm64.bin" if "arm64" in abi.lower() else "proxy_arm32.bin"
            )
            if not chosen.exists():
                raise RuntimeError(f"Không tìm thấy nhị phân proxy: {chosen.name}")

            self.events.add("info", "Đang dừng daemon proxy cũ...", source="proxy")
            self.adb.shell(serial, "pkill -f mini_proxy", timeout=8)
            self._sleep(0.4)

            self.events.add(
                "info", "Đang đồng bộ daemon proxy sang điện thoại...", source="proxy"
            )
            self.adb.push(serial, str(chosen), REMOTE_BIN)
            self.adb.shell(serial, f"chmod 755 {REMOTE_BIN}", timeout=8)

            running = self._start_daemon(serial)
            if not running:
                raise RuntimeError(
                    "Daemon proxy không khởi động được trên điện thoại."
                )

            with self._state_lock:
                self.device["status"] = "ready"
                self.device["since"] = now
            self._last_health_check = time.time()
            self._update_battery(serial)
            self._check_network(announce=True)
            self._schedule_next()
            self.events.add(
                "success",
                f"Phiên proxy đã sẵn sàng trên {model}.",
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
                "error", f"Không thiết lập được proxy: {exc}", source="proxy"
            )
        finally:
            self._op_lock.release()

    def _start_daemon(self, serial: str) -> bool:
        try:
            self.events.add(
                "info",
                f"Đang khởi động daemon proxy trên cổng {self.config.proxy_port}...",
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
                    f"Daemon proxy đang chạy (PID {pid}).",
                    source="proxy",
                )
            else:
                self.events.add(
                    "error",
                    "Daemon proxy không chạy sau khi khởi động.",
                    source="proxy",
                )
            return running
        except Exception as exc:
            with self._state_lock:
                self.proxy.update({"running": False, "forwarded": False})
                self.device["daemon_running"] = False
                self.device["forwarded"] = False
            self.events.add(
                "error", f"Không khởi động được daemon proxy: {exc}", source="proxy"
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
                }
            )
            self.proxy.update({"running": False, "forwarded": False})
            self.network.update(
                {
                    "state": "offline",
                    "error": "Thiết bị đã ngắt kết nối.",
                }
            )
            self._next_rotate_at = None
        if was_connected:
            self.events.add(
                "warning",
                "Đã ngắt kết nối thiết bị. Đang chờ cắm lại cáp USB...",
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
                            f"Cảnh báo nguy hiểm: Nhiệt độ pin {temp}°C vượt ngưỡng 45°C! Đang ngắt sạc bảo vệ.",
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
                            f"Cảnh báo: Nhiệt độ pin tăng cao ({temp}°C > 40°C). Hãy chú ý vị trí đặt máy thoáng mát.",
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
                raise NotConnectedError(
                    "Chưa có thiết bị Android nào được kết nối."
                )
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
                    "error", f"Không xác minh được IP: {message}", source="network"
                )
            return False
        except Exception as exc:
            message = f"Lỗi không xác định khi kiểm tra IP: {exc}"
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
                f"IP công khai: {info.ip} · {info.isp} · {info.city}".rstrip(" ·"),
                source="network",
            )
        return True

    def refresh_network(self) -> dict[str, Any]:
        with self._state_lock:
            if not self.device["connected"] or not self.device["serial"]:
                raise NotConnectedError(
                    "Chưa có thiết bị Android nào được kết nối."
                )
            if self._rotating:
                raise BusyError("Đang xoay IP. Vui lòng chờ hoàn tất.")
            if self._network_checking:
                raise BusyError("Đang kiểm tra kết nối.")
        if not self._op_lock.acquire(blocking=False):
            raise BusyError("Thiết bị đang xử lý thao tác khác.")
        try:
            with self._state_lock:
                if self._network_checking:
                    raise BusyError("Đang kiểm tra kết nối.")
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
                message = self.network.get("error") or "Không kiểm tra được kết nối."
            raise UpstreamError(message)
        return self.status()

    # ------------------------------------------------------------------
    # IP rotation
    # ------------------------------------------------------------------
    def rotate(self, *, trigger: str = "manual", wait: bool = False) -> dict[str, Any]:
        with self._state_lock:
            if self._rotating:
                raise BusyError("Đang có một lần xoay IP khác chạy.")
            if not self.device["connected"] or not self.device["serial"]:
                raise NotConnectedError(
                    "Chưa có thiết bị Android nào được kết nối."
                )
            if not self.device["daemon_running"]:
                raise BusyError(
                    "Daemon proxy chưa chạy. Hãy kết nối lại thiết bị trước khi xoay IP."
                )

            job_id = uuid.uuid4().hex[:10]
            old_ip = self.network.get("ip")
            now = time.time()
            self._rotating = True
            self.rotation = {
                "id": job_id,
                "status": "running",
                "step": "preparing",
                "progress": 8,
                "message": "Đang chuẩn bị xoay IP...",
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
            "auto": "tự động",
            "legacy": "qua API",
        }.get(trigger, "thủ công")
        self.events.add("info", f"Bắt đầu xoay IP ({label}).", source="rotation")

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
                        "message": f"Không bắt đầu được tiến trình xoay: {exc}",
                        "running": False,
                    }
                )
            raise ServiceError("Không bắt đầu được tiến trình xoay IP.") from exc
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
                        raise RuntimeError("Ứng dụng đang dừng.")

                    base = 20 if attempt == 1 else 42
                    self._set_rotation(
                        step="network-off",
                        progress=base,
                        message=(
                            "Bật chế độ máy bay..."
                            if method == "airplane"
                            else "Tắt dữ liệu di động..."
                        ),
                    )
                    self._toggle_network(serial, method, enabled=True)
                    self._sleep(2.5 if method == "airplane" else 2.0)

                    self._set_rotation(
                        step="network-on",
                        progress=base + 14,
                        message=(
                            "Tắt chế độ máy bay, chờ mạng 4G..."
                            if method == "airplane"
                            else "Bật lại dữ liệu di động, chờ mạng 4G..."
                        ),
                    )
                    self._toggle_network(serial, method, enabled=False)
                    self._sleep(5.0 if method == "airplane" else 5.0)

                    self._set_rotation(
                        step="waiting",
                        progress=base + 26,
                        message="Đang chờ nhà mạng cấp IP mới...",
                    )
                    self._ensure_daemon_after_rotation(serial)
                    self._sleep(1.0)

                    self._set_rotation(
                        step="verifying",
                        progress=75 if attempt == 1 else 88,
                        message="Đang xác minh IP công khai...",
                    )
                    try:
                        info = self.checker.check(self.config.proxy_port)
                    except NetworkError as exc:
                        last_error = str(exc)
                        if attempt < attempts:
                            self.events.add(
                                "warning",
                                f"Chưa xác minh được IP ({exc}). Thử lại lần {attempt + 1}/{attempts}.",
                                source="rotation",
                            )
                            self._sleep(4.0)
                            continue
                        raise

                    if old_ip and info.ip == old_ip and attempt < attempts:
                        self.events.add(
                            "warning",
                            "Nhà mạng cấp lại cùng IP cũ. Đang thử xoay lại...",
                            source="rotation",
                        )
                        self._sleep(2.0)
                        continue
                    break

                if info is None:
                    raise RuntimeError(
                        last_error or "Không lấy được IP sau khi xoay."
                    )

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
                    message = f"Đã xoay IP thành công: {info.ip}"
                else:
                    message = f"IP sau khi xoay vẫn là {info.ip}"
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
                        f"Xoay IP thành công: {old_ip or '—'} → {info.ip} · {info.isp}.",
                        source="rotation",
                    )
                else:
                    self.events.add(
                        "warning",
                        f"Nhà mạng vẫn cấp IP cũ ({info.ip}) sau 2 lần thử.",
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
            message = str(exc) or "Xoay IP thất bại."
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
                "error", f"Xoay IP thất bại: {message}", source="rotation"
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
        alive = bool(self.adb.pidof(serial, "mini_proxy"))
        if not alive:
            self.events.add(
                "warning",
                "Daemon proxy đã dừng sau khi đổi mạng. Đang khởi động lại...",
                source="proxy",
            )
            if not self._start_daemon(serial):
                raise RuntimeError(
                    "Không thể khởi động lại daemon proxy sau khi xoay IP."
                )
        else:
            self.adb.forward(
                serial, self.config.proxy_port, self.config.proxy_port
            )
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
                f"Không lưu được lịch sử xoay IP: {exc}",
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
                f"Không lưu được lịch sử xoay IP: {exc}",
                source="storage",
            )
        self.events.add("info", "Đã xóa lịch sử xoay IP.", source="app")
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
        with self._state_lock:
            self.settings = candidate
            self._settings_store.save(candidate)
            if candidate["auto_rotate_enabled"] and self.device["connected"]:
                self._next_rotate_at = (
                    time.time() + candidate["auto_rotate_interval_min"] * 60
                )
            else:
                self._next_rotate_at = None

        if current.get("auto_rotate_enabled") != candidate["auto_rotate_enabled"]:
            if candidate["auto_rotate_enabled"]:
                self.events.add(
                    "success",
                    f"Đã bật xoay IP tự động mỗi {candidate['auto_rotate_interval_min']} phút.",
                    source="settings",
                )
            else:
                self.events.add(
                    "info", "Đã tắt xoay IP tự động.", source="settings"
                )
        elif (
            current.get("auto_rotate_interval_min")
            != candidate["auto_rotate_interval_min"]
        ):
            self.events.add(
                "info",
                f"Chu kỳ xoay tự động: {candidate['auto_rotate_interval_min']} phút.",
                source="settings",
            )
        if current.get("rotate_method") != candidate["rotate_method"]:
            label = (
                "chế độ máy bay"
                if candidate["rotate_method"] == "airplane"
                else "bật/tắt dữ liệu di động"
            )
            self.events.add(
                "info", f"Phương thức xoay: {label}.", source="settings"
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
                            f"Không thể xoay IP tự động: {exc}",
                            source="auto",
                        )
                        with self._state_lock:
                            self._next_rotate_at = time.time() + 60
            except Exception as exc:  # pragma: no cover - defensive
                self.events.add(
                    "error", f"Lỗi lịch xoay tự động: {exc}", source="auto"
                )
            self._stop.wait(1)

    def reconnect_device(self) -> dict[str, Any]:
        with self._state_lock:
            serial = self.device["serial"]
            status = self.device["status"]
            if not serial:
                raise NotConnectedError("Chưa phát hiện thiết bị Android.")
            if self._rotating:
                raise BusyError("Đang xoay IP. Vui lòng chờ hoàn tất.")
            if status == "preparing":
                raise BusyError("Thiết bị đang được kết nối.")
            self.device["status"] = "preparing"
            self.device["error"] = None
        self._spawn(
            lambda: self._connect_device(serial, reason="manual"),
            "reconnect-device",
        )
        return {"message": "Đang kết nối lại thiết bị."}

    def set_device_charging(self, enabled: bool) -> dict[str, Any]:
        with self._state_lock:
            if not self.device["connected"] or not self.device["serial"]:
                raise NotConnectedError("Chưa có thiết bị Android nào được kết nối.")
            serial = self.device["serial"]

        self.adb.set_charging(serial, enabled)
        self._charging_disabled = not enabled
        action = "Bật lại sạc pin" if enabled else "Ngắt sạc pin tạm thời"
        self.events.add(
            "info" if enabled else "warning",
            f"{action} cho thiết bị ({serial}).",
            source="adb",
        )
        battery = self._update_battery(serial)
        return {"ok": True, "battery": battery or {}}

    def restart_proxy(self) -> dict[str, Any]:
        with self._state_lock:
            serial = self.device["serial"]
            if not serial or not self.device["connected"]:
                raise NotConnectedError("Chưa có thiết bị Android nào được kết nối.")
            if self._rotating:
                raise BusyError("Đang xoay IP. Vui lòng chờ hoàn tất.")
            if self.device["status"] == "preparing":
                raise BusyError("Thiết bị đang được kết nối.")
        self._spawn(lambda: self._restart_proxy_worker(serial), "restart-proxy")
        return {"message": "Đang khởi động lại daemon proxy."}

    def _restart_proxy_worker(self, serial: str) -> None:
        if not self._op_lock.acquire(timeout=3):
            self.events.add(
                "warning",
                "Thiết bị đang xử lý thao tác khác. Chưa thể khởi động lại daemon.",
                source="proxy",
            )
            return
        try:
            self.events.add(
                "info", "Đang khởi động lại daemon proxy theo yêu cầu.", source="proxy"
            )
            self.adb.shell(serial, "pkill -f mini_proxy", timeout=8)
            self._sleep(0.4)
            if self._start_daemon(serial):
                self._check_network(announce=True)
                with self._state_lock:
                    self.device["status"] = "ready"
                    self.device["error"] = None
                self.events.add(
                    "success", "Đã khởi động lại daemon proxy.", source="proxy"
                )
            else:
                with self._state_lock:
                    self.device["status"] = "error"
                    self.device["error"] = "Không khởi động lại được daemon proxy."
        finally:
            self._op_lock.release()

    def clear_logs(self) -> dict[str, Any]:
        self.events.clear()
        entry = self.events.add(
            "info", "Đã xóa nhật ký hoạt động.", source="app"
        )
        return {"last_id": entry["id"]}
