"""JSON persistence for dashboard settings and IP-rotation history."""

from __future__ import annotations

import json
import os
import threading
from datetime import date
from pathlib import Path
from typing import Any

from .i18n import get_message

DEFAULT_SETTINGS: dict[str, Any] = {
    "auto_rotate_enabled": False,
    "auto_rotate_interval_min": 30,
    "rotate_method": "airplane",
    "daily_data_limit_gb": 4.0,
    "language": "en",
}

ROTATE_METHODS = ("airplane", "data")
LANGUAGES = ("en", "vi")
MIN_INTERVAL_MIN = 2
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


def validate_settings(
    payload: dict[str, Any], base: dict[str, Any], lang: str = "en"
) -> dict[str, Any]:
    candidate = dict(base)
    if "auto_rotate_enabled" in payload:
        value = payload["auto_rotate_enabled"]
        if not isinstance(value, bool):
            raise ValueError(get_message("validation.auto_rotate_bool", lang))
        candidate["auto_rotate_enabled"] = value

    if "auto_rotate_interval_min" in payload:
        raw = payload["auto_rotate_interval_min"]
        try:
            interval = int(raw)
        except (TypeError, ValueError) as exc:
            raise ValueError(get_message("validation.interval_int", lang)) from exc
        if interval < MIN_INTERVAL_MIN or interval > MAX_INTERVAL_MIN:
            raise ValueError(
                get_message(
                    "validation.interval_range",
                    lang,
                    min=MIN_INTERVAL_MIN,
                    max=MAX_INTERVAL_MIN,
                )
            )
        candidate["auto_rotate_interval_min"] = interval

    if "rotate_method" in payload:
        method = payload["rotate_method"]
        if method not in ROTATE_METHODS:
            raise ValueError(get_message("validation.method_invalid", lang))
        candidate["rotate_method"] = method

    if "daily_data_limit_gb" in payload:
        raw_limit = payload["daily_data_limit_gb"]
        try:
            limit = float(raw_limit)
        except (TypeError, ValueError) as exc:
            raise ValueError(get_message("validation.limit_float", lang)) from exc
        if limit < 0 or limit > 1000:
            raise ValueError(get_message("validation.limit_range", lang))
        candidate["daily_data_limit_gb"] = round(limit, 2)

    if "language" in payload:
        language = payload["language"]
        if language not in LANGUAGES:
            raise ValueError(get_message("validation.language_invalid", lang))
        candidate["language"] = language

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


class DataUsageStore:
    """Persists daily cellular data usage stats (bytes rx, tx, total)."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self._lock = threading.Lock()

    def load(self) -> dict[str, Any]:
        data = _read_json(self.path, {})
        if not isinstance(data, dict):
            data = {}
        if "dates" not in data or not isinstance(data["dates"], dict):
            data["dates"] = {}
        return data

    def get_today(self, for_date: str | None = None) -> dict[str, int]:
        today_key = for_date or date.today().isoformat()
        with self._lock:
            data = self.load()
            entry = data.get("dates", {}).get(today_key, {})
            return {
                "rx_bytes": int(entry.get("rx_bytes", 0)),
                "tx_bytes": int(entry.get("tx_bytes", 0)),
                "total_bytes": int(entry.get("total_bytes", 0)),
            }

    def record_delta(
        self, rx_delta: int, tx_delta: int, for_date: str | None = None
    ) -> dict[str, int]:
        today_key = for_date or date.today().isoformat()
        with self._lock:
            data = self.load()
            dates = data.setdefault("dates", {})
            entry = dates.setdefault(
                today_key, {"rx_bytes": 0, "tx_bytes": 0, "total_bytes": 0}
            )
            entry["rx_bytes"] = max(0, int(entry.get("rx_bytes", 0)) + rx_delta)
            entry["tx_bytes"] = max(0, int(entry.get("tx_bytes", 0)) + tx_delta)
            entry["total_bytes"] = entry["rx_bytes"] + entry["tx_bytes"]
            _atomic_write(self.path, data)
            return dict(entry)

    def reset_today(self, for_date: str | None = None) -> dict[str, int]:
        today_key = for_date or date.today().isoformat()
        with self._lock:
            data = self.load()
            dates = data.setdefault("dates", {})
            dates[today_key] = {"rx_bytes": 0, "tx_bytes": 0, "total_bytes": 0}
            _atomic_write(self.path, data)
            return {"rx_bytes": 0, "tx_bytes": 0, "total_bytes": 0}
