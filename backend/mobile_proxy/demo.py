"""Deterministic demo backend used for UI previews and tests.

This never touches ADB or the network. It implements the small subset of the
ADB and network-checker interfaces that the service consumes.
"""

from __future__ import annotations

import time

from .adb import AdbDevice
from .network import NetworkInfo, NetworkError

_IPS = (
    ("113.161.52.18", "Viettel", "Hồ Chí Minh", 96),
    ("14.187.144.203", "VNPT", "Hà Nội", 128),
    ("27.72.101.44", "Mobifone", "Đà Nẵng", 84),
    ("171.244.38.77", "Viettel", "Cần Thơ", 142),
    ("58.187.190.12", "FPT Telecom", "Hải Phòng", 110),
    ("203.113.44.90", "Vinaphone", "Huế", 156),
)


class DemoBackend:
    def __init__(self) -> None:
        self._index = 0
        self._daemon_running = True
        self._forwarded = True
        self._rotate_pending = False
        self._started = time.time()
        self._charging = True
        self._battery_level = 82
        self._battery_temperature = 37.5

    # --- ADB interface -------------------------------------------------
    def available(self) -> bool:
        return True

    def devices(self) -> list[AdbDevice]:
        return [AdbDevice(serial="DEMO-4G-01", status="device")]

    def getprop(self, serial: str, prop: str) -> str:
        values = {
            "ro.product.model": "Pixel 7 (demo)",
            "ro.build.version.release": "14",
            "ro.product.cpu.abi": "arm64-v8a",
            "ro.product.manufacturer": "Google",
        }
        return values.get(prop, "")

    def shell(self, serial: str, command: str, *, timeout: float = 15) -> str:
        lowered = command.lower()
        if "pidof" in lowered:
            return "4242" if self._daemon_running else ""
        if "pkill" in lowered:
            self._daemon_running = False
            return ""
        if "nohup" in lowered and "mini_proxy" in lowered:
            self._daemon_running = True
            return ""
        if "airplane-mode enable" in lowered or "svc data disable" in lowered:
            self._rotate_pending = True
        if "settings put global airplane_mode_on" in lowered:
            self._rotate_pending = True
        return ""

    def pidof(self, serial: str, process: str) -> str:
        return "4242" if self._daemon_running else ""

    def push(self, serial: str, local_path: str, remote_path: str) -> str:
        return "1 file pushed"

    def forward(self, serial: str, local_port: int, remote_port: int) -> str:
        self._forwarded = True
        return ""

    def remove_forward(self, serial: str, local_port: int) -> str:
        self._forwarded = False
        return ""

    def battery_info(self, serial: str) -> dict:
        return {
            "level": self._battery_level,
            "temperature": self._battery_temperature,
            "status": "charging" if self._charging else "not_charging",
            "plugged": "usb" if self._charging else "none",
            "health": "good",
            "voltage_mv": 4120,
            "present": True,
        }

    def is_rooted(self, serial: str) -> bool:
        return True

    def set_charging(self, serial: str, enabled: bool) -> bool:
        self._charging = enabled
        return True

    def network_traffic(self, serial: str) -> dict[str, int]:
        elapsed = int(time.time() - self._started)
        rx = 1_420_000_000 + elapsed * 1024 * 32
        tx = 180_000_000 + elapsed * 1024 * 4
        return {"rx_bytes": rx, "tx_bytes": tx, "total_bytes": rx + tx}

    # --- network checker interface ------------------------------------
    def check(self, proxy_port: int) -> NetworkInfo:
        if not self._daemon_running or not self._forwarded:
            raise NetworkError("Daemon proxy demo chưa chạy.")
        if self._rotate_pending:
            self._index = (self._index + 1) % len(_IPS)
            self._rotate_pending = False
        ip, isp, city, latency = _IPS[self._index]
        return NetworkInfo(
            ip=ip,
            isp=isp,
            city=city,
            region=city,
            country="Việt Nam",
            latency_ms=latency,
            checked_at=time.time(),
        )

    # --- helpers -------------------------------------------------------
    def state(self) -> dict:
        return {
            "index": self._index,
            "daemon_running": self._daemon_running,
            "forwarded": self._forwarded,
            "uptime_sec": int(time.time() - self._started),
        }
