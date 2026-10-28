"""Unit tests for settings validation and the activity log."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from mobile_proxy.events import EventLog
from mobile_proxy.storage import (
    DEFAULT_SETTINGS,
    HistoryStore,
    SettingsStore,
    validate_settings,
)


class ValidateSettingsTests(unittest.TestCase):
    def test_defaults_are_applied(self) -> None:
        self.assertEqual(validate_settings({}, DEFAULT_SETTINGS), DEFAULT_SETTINGS)

    def test_valid_patch_is_merged(self) -> None:
        result = validate_settings(
            {
                "auto_rotate_enabled": True,
                "auto_rotate_interval_min": 45,
                "rotate_method": "data",
            },
            DEFAULT_SETTINGS,
        )
        self.assertTrue(result["auto_rotate_enabled"])
        self.assertEqual(result["auto_rotate_interval_min"], 45)
        self.assertEqual(result["rotate_method"], "data")

    def test_interval_boundaries(self) -> None:
        for value in (5, 1440):
            result = validate_settings(
                {"auto_rotate_interval_min": value}, DEFAULT_SETTINGS
            )
            self.assertEqual(result["auto_rotate_interval_min"], value)

        for value in (4, 1441):
            with self.assertRaises(ValueError):
                validate_settings(
                    {"auto_rotate_interval_min": value}, DEFAULT_SETTINGS
                )

    def test_invalid_values_are_rejected(self) -> None:
        with self.assertRaises(ValueError):
            validate_settings({"auto_rotate_enabled": "yes"}, DEFAULT_SETTINGS)
        with self.assertRaises(ValueError):
            validate_settings({"auto_rotate_interval_min": "soon"}, DEFAULT_SETTINGS)
        with self.assertRaises(ValueError):
            validate_settings({"rotate_method": "wifi"}, DEFAULT_SETTINGS)


class StoreTests(unittest.TestCase):
    def test_settings_round_trip(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "settings.json"
            store = SettingsStore(path)
            saved = {
                "auto_rotate_enabled": True,
                "auto_rotate_interval_min": 15,
                "rotate_method": "data",
            }
            store.save(saved)

            self.assertEqual(store.load(), saved)
            self.assertEqual(json.loads(path.read_text(encoding="utf-8")), saved)

    def test_invalid_settings_file_falls_back_to_defaults(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "settings.json"
            path.write_text('{"auto_rotate_interval_min": 1}', encoding="utf-8")
            self.assertEqual(SettingsStore(path).load(), DEFAULT_SETTINGS)

    def test_history_round_trip_and_filtering(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "history.json"
            store = HistoryStore(path)
            entries = [
                {"id": "b", "ts": 2, "status": "failed"},
                {"id": "a", "ts": 1, "status": "success"},
                {"id": "bad", "ts": 3, "status": "pending"},
            ]
            store.save(entries)

            loaded = store.load()
            self.assertEqual([item["id"] for item in loaded], ["b", "a"])
            self.assertEqual([item["id"] for item in store.load()], ["b", "a"])


class EventLogTests(unittest.TestCase):
    def test_snapshot_after_and_limit(self) -> None:
        log = EventLog(echo=False)
        for index in range(5):
            log.add("info", f"event {index}", source="test")

        snapshot = log.snapshot(after=2, limit=2)
        self.assertEqual(snapshot["last_id"], 5)
        self.assertEqual([item["message"] for item in snapshot["items"]], ["event 3", "event 4"])

    def test_clear_keeps_increasing_ids(self) -> None:
        log = EventLog(echo=False)
        log.add("info", "first")
        cleared_at = log.clear()
        entry = log.add("info", "second")

        self.assertEqual(cleared_at, 1)
        self.assertEqual(entry["id"], 2)
        self.assertEqual(log.snapshot(after=1)["items"][0]["message"], "second")


if __name__ == "__main__":
    unittest.main()
