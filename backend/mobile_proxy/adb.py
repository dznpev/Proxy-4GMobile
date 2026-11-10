"""Thin, testable wrapper around the Android Debug Bridge (ADB)."""

from __future__ import annotations

import os
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any


def resolve_adb_path(executable: str = "adb") -> str:
    """Resolve the ADB binary path, preferring platform-tools on Windows if default."""
    if executable == "adb":
        standard_path = Path(r"C:\platform-tools\adb.exe")
        if standard_path.is_file():
            return str(standard_path)
    return executable


@dataclass(frozen=True)
class AdbDevice:
    serial: str
    status: str


class AdbClient:
    def __init__(self, executable: str = "adb") -> None:
        self.executable = resolve_adb_path(executable)

    def available(self) -> bool:
        return shutil.which(self.executable) is not None

    def _run(
        self, args: list[str], *, timeout: float = 15
    ) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [self.executable, *args],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            check=False,
        )

    def devices(self) -> list[AdbDevice]:
        result = self._run(["devices"], timeout=8)
        devices: list[AdbDevice] = []
        for line in result.stdout.splitlines()[1:]:
            line = line.strip()
            if not line or line.startswith("*"):
                continue
            parts = line.split()
            if len(parts) >= 2:
                devices.append(AdbDevice(serial=parts[0], status=parts[1]))
        return devices

    def shell(self, serial: str, command: str, *, timeout: float = 15) -> str:
        result = self._run(["-s", serial, "shell", command], timeout=timeout)
        return (result.stdout or result.stderr or "").strip()

    def getprop(self, serial: str, prop: str) -> str:
        return self.shell(serial, f"getprop {prop}", timeout=8)

    def push(self, serial: str, local_path: str, remote_path: str) -> str:
        result = self._run(
            ["-s", serial, "push", local_path, remote_path], timeout=60
        )
        return (result.stdout or result.stderr or "").strip()

    def forward(self, serial: str, local_port: int, remote_port: int) -> str:
        result = self._run(
            [
                "-s",
                serial,
                "forward",
                f"tcp:{local_port}",
                f"tcp:{remote_port}",
            ],
            timeout=10,
        )
        return (result.stdout or result.stderr or "").strip()

    def remove_forward(self, serial: str, local_port: int) -> str:
        result = self._run(
            ["-s", serial, "forward", "--remove", f"tcp:{local_port}"], timeout=10
        )
        return (result.stdout or result.stderr or "").strip()

    def pidof(self, serial: str, process: str) -> str:
        output = self.shell(serial, f"pidof {process}", timeout=8)
        # Filter for genuine numeric PIDs, ignoring error messages or shell banners
        pids = [part for part in output.split() if part.isdigit()]
        return " ".join(pids)

    def is_forwarded(self, serial: str, local_port: int) -> bool:
        """Check if local_port is actively forwarded to the specified device."""
        result = self._run(["forward", "--list"], timeout=8)
        target = f"tcp:{local_port}"
        for line in result.stdout.splitlines():
            parts = line.strip().split()
            if len(parts) >= 2 and parts[0] == serial and parts[1] == target:
                return True
        return False

    def battery_info(self, serial: str) -> dict[str, Any]:
        """Query and parse Android battery and thermal status via dumpsys battery."""
        output = self.shell(serial, "dumpsys battery", timeout=8)
        return parse_dumpsys_battery(output)

    def is_rooted(self, serial: str) -> bool:
        """Check if device has root (su) access."""
        id_out = self.shell(serial, "su -c id", timeout=6)
        if "uid=0" in id_out or "root" in id_out:
            return True
        which_su = self.shell(serial, "which su", timeout=6)
        return bool(which_su and "not found" not in which_su.lower())

    def set_charging(self, serial: str, enabled: bool) -> bool:
        """Control charging state via ADB dumpsys or kernel sysfs if rooted.

        Does not touch input_suspend or batt_slate_mode to avoid suspending USB PHY.
        """
        if enabled:
            self.shell(serial, "dumpsys battery reset", timeout=8)
            # Restore kernel sysfs charging nodes across Qualcomm, MediaTek, Samsung, Pixel
            self.shell(
                serial,
                "su -c 'for f in /sys/class/power_supply/battery/charging_enabled "
                "/sys/class/power_supply/battery/battery_charging_enabled "
                "/sys/devices/platform/charger/charging_enabled; do "
                "[ -f $f ] && echo 1 > $f; done; "
                "[ -f /sys/class/power_supply/battery/input_suspend ] && echo 0 > /sys/class/power_supply/battery/input_suspend; "
                "[ -f /sys/class/power_supply/battery/batt_slate_mode ] && echo 0 > /sys/class/power_supply/battery/batt_slate_mode;' 2>/dev/null",
                timeout=8,
            )
        else:
            self.shell(serial, "dumpsys battery set usb 0", timeout=8)
            self.shell(serial, "dumpsys battery set status 4", timeout=8)
            # Disable charging in kernel sysfs across Qualcomm, MediaTek, Samsung, Pixel safely
            self.shell(
                serial,
                "su -c 'for f in /sys/class/power_supply/battery/charging_enabled "
                "/sys/class/power_supply/battery/battery_charging_enabled "
                "/sys/devices/platform/charger/charging_enabled; do "
                "[ -f $f ] && echo 0 > $f; done;' 2>/dev/null",
                timeout=8,
            )
        return True

    def network_traffic(self, serial: str) -> dict[str, int]:
        """Read cellular network traffic from /proc/net/dev."""
        output = self.shell(serial, "cat /proc/net/dev", timeout=8)
        return parse_proc_net_dev(output)


BATTERY_STATUS_MAP: dict[int, str] = {
    1: "unknown",
    2: "charging",
    3: "discharging",
    4: "not_charging",
    5: "full",
}

BATTERY_HEALTH_MAP: dict[int, str] = {
    1: "unknown",
    2: "good",
    3: "overheat",
    4: "dead",
    5: "over_voltage",
    6: "unspecified_failure",
    7: "cold",
}


def parse_dumpsys_battery(output: str) -> dict[str, Any]:
    """Parse raw output of `dumpsys battery` into structured dictionary."""
    data: dict[str, Any] = {
        "level": None,
        "temperature": None,
        "status": "unknown",
        "plugged": "none",
        "health": "unknown",
        "voltage_mv": None,
        "present": True,
    }
    if not output:
        return data

    usb_powered = False
    ac_powered = False
    wireless_powered = False

    for raw_line in output.splitlines():
        line = raw_line.strip()
        if not line or ":" not in line:
            continue
        key, _, val = line.partition(":")
        key = key.strip().lower()
        val = val.strip()

        if key == "level":
            try:
                data["level"] = int(val)
            except ValueError:
                pass
        elif key == "temperature":
            try:
                raw_temp = float(val)
                data["temperature"] = (
                    round(raw_temp / 10.0, 1) if raw_temp > 100 else round(raw_temp, 1)
                )
            except ValueError:
                pass
        elif key == "voltage":
            try:
                data["voltage_mv"] = int(val)
            except ValueError:
                pass
        elif key == "status":
            try:
                data["status"] = BATTERY_STATUS_MAP.get(int(val), val.lower())
            except ValueError:
                data["status"] = val.lower()
        elif key == "health":
            try:
                data["health"] = BATTERY_HEALTH_MAP.get(int(val), val.lower())
            except ValueError:
                data["health"] = val.lower()
        elif key == "usb powered":
            usb_powered = val.lower() == "true"
        elif key == "ac powered":
            ac_powered = val.lower() == "true"
        elif key == "wireless powered":
            wireless_powered = val.lower() == "true"
        elif key == "present":
            data["present"] = val.lower() == "true"

    if usb_powered:
        data["plugged"] = "usb"
    elif ac_powered:
        data["plugged"] = "ac"
    elif wireless_powered:
        data["plugged"] = "wireless"
    else:
        data["plugged"] = "none"

    return data


def parse_proc_net_dev(output: str) -> dict[str, int]:
    """Parse /proc/net/dev output and aggregate mobile cellular interfaces.

    Filters for common Android mobile data interfaces (Qualcomm rmnet,
    MediaTek ccmni, Samsung pdp/seth_w, generic wwan/radio), while skipping
    virtual IPv4 clat translations (v4-rmnet*) to avoid double counting.
    """
    rx_total = 0
    tx_total = 0

    if not output:
        return {"rx_bytes": 0, "tx_bytes": 0, "total_bytes": 0}

    mobile_prefixes = ("rmnet", "ccmni", "pdp", "wwan", "radio", "seth_w")

    for raw_line in output.splitlines():
        line = raw_line.strip()
        if not line or ":" not in line:
            continue
        iface, _, stats_str = line.partition(":")
        iface = iface.strip()

        # Skip virtual IPv4 clat translation interfaces
        if iface.startswith("v4-"):
            continue

        if any(iface.startswith(prefix) for prefix in mobile_prefixes):
            parts = stats_str.split()
            if len(parts) >= 9:
                try:
                    rx = int(parts[0])
                    tx = int(parts[8])
                    rx_total += rx
                    tx_total += tx
                except ValueError:
                    continue

    return {
        "rx_bytes": rx_total,
        "tx_bytes": tx_total,
        "total_bytes": rx_total + tx_total,
    }
