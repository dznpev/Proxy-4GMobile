"""Thin, testable wrapper around the Android Debug Bridge (ADB)."""

from __future__ import annotations

import shutil
import subprocess
from dataclasses import dataclass


@dataclass(frozen=True)
class AdbDevice:
    serial: str
    status: str


class AdbClient:
    def __init__(self, executable: str = "adb") -> None:
        self.executable = executable

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
        return self.shell(serial, f"pidof {process}", timeout=8)
