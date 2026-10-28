"""Thread-safe, bounded activity log used by the console and dashboard."""

from __future__ import annotations

import threading
import time
from collections import deque
from datetime import datetime

LEVELS = ("debug", "info", "success", "warning", "error")


class EventLog:
    def __init__(self, maxlen: int = 500, *, echo: bool = True) -> None:
        self._items: deque[dict] = deque(maxlen=maxlen)
        self._next_id = 1
        self._lock = threading.Lock()
        self._echo = echo

    def add(self, level: str, message: str, *, source: str = "system") -> dict:
        level = level if level in LEVELS else "info"
        now = time.time()
        with self._lock:
            entry = {
                "id": self._next_id,
                "ts": round(now, 3),
                "time": datetime.fromtimestamp(now).strftime("%H:%M:%S"),
                "level": level,
                "message": message,
                "source": source,
            }
            self._next_id += 1
            self._items.append(entry)

        if self._echo:
            stamp = datetime.fromtimestamp(now).strftime("%H:%M:%S")
            print(f"[{stamp}] [{level.upper():7}] {message}", flush=True)
        return entry

    def snapshot(self, *, after: int = 0, limit: int = 300) -> dict:
        with self._lock:
            items = [item for item in self._items if item["id"] > after]
            last_id = self._next_id - 1
        if limit > 0:
            items = items[-limit:]
        return {"items": items, "last_id": last_id}

    def clear(self) -> int:
        with self._lock:
            self._items.clear()
            return self._next_id - 1
