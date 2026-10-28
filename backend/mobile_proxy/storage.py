"""JSON persistence for dashboard settings and IP-rotation history."""

from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Any

DEFAULT_SETTINGS: dict[str, Any] = {
    "auto_rotate_enabled": False,
    "auto_rotate_interval_min": 30,
    "rotate_method": "airplane",
}

ROTATE_METHODS = ("airplane", "data")
MIN_INTERVAL_MIN = 5
MAX_INTERVAL_MIN = 1440
MAX_HISTORY = 100


def _atomic_write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f"{path.name}.tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    os.replace(temporary, path)


def _read_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return fallback


def validate_settings(payload: dict[str, Any], base: dict[str, Any]) -> dict[str, Any]:
    candidate = dict(base)
    if "auto_rotate_enabled" in payload:
        value = payload["auto_rotate_enabled"]
        if not isinstance(value, bool):
            raise ValueError("Tự động xoay phải là giá trị bật hoặc tắt.")
        candidate["auto_rotate_enabled"] = value

    if "auto_rotate_interval_min" in payload:
        raw = payload["auto_rotate_interval_min"]
        try:
            interval = int(raw)
        except (TypeError, ValueError) as exc:
            raise ValueError("Chu kỳ xoay phải là số phút.") from exc
        if interval < MIN_INTERVAL_MIN or interval > MAX_INTERVAL_MIN:
            raise ValueError(
                f"Chu kỳ xoay phải nằm trong khoảng {MIN_INTERVAL_MIN}-{MAX_INTERVAL_MIN} phút."
            )
        candidate["auto_rotate_interval_min"] = interval

    if "rotate_method" in payload:
        method = payload["rotate_method"]
        if method not in ROTATE_METHODS:
            raise ValueError("Phương thức xoay không hợp lệ.")
        candidate["rotate_method"] = method

    return candidate


class SettingsStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self._lock = threading.Lock()

    def load(self) -> dict[str, Any]:
        data = _read_json(self.path, {})
        if not isinstance(data, dict):
            data = {}
        try:
            return validate_settings(data, DEFAULT_SETTINGS)
        except ValueError:
            return dict(DEFAULT_SETTINGS)

    def save(self, settings: dict[str, Any]) -> None:
        with self._lock:
            _atomic_write(self.path, validate_settings(settings, DEFAULT_SETTINGS))


class HistoryStore:
    def __init__(self, path: Path, *, limit: int = MAX_HISTORY) -> None:
        self.path = path
        self.limit = limit
        self._lock = threading.Lock()

    def load(self) -> list[dict[str, Any]]:
        data = _read_json(self.path, [])
        if not isinstance(data, list):
            return []
        entries = [
            item
            for item in data
            if isinstance(item, dict)
            and item.get("status") in ("success", "failed")
            and "ts" in item
        ]
        return entries[: self.limit]

    def save(self, entries: list[dict[str, Any]]) -> None:
        with self._lock:
            _atomic_write(self.path, entries[: self.limit])
