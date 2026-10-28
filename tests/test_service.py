"""Integration tests for the demo service (no phone or network required)."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from mobile_proxy.config import AppConfig
from mobile_proxy.service import MobileProxyService, NotConnectedError


class DemoServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.config = AppConfig(
            proxy_port=18080,
            control_port=18081,
            data_dir=Path(self.temporary.name),
            demo=True,
        )
        self.service = MobileProxyService(
            self.config,
            demo=True,
            echo_logs=False,
            time_scale=0.01,
        )
        self.service.start()
        self.addCleanup(self.service.stop)

    def test_startup_payload_has_device_and_app_metadata(self) -> None:
        status = self.service.status()

        self.assertTrue(status["device"]["connected"])
        self.assertEqual(status["device"]["status"], "ready")
        self.assertEqual(status["device"]["serial"], "DEMO-4G-01")
        self.assertTrue(status["device"]["daemon_running"])
        self.assertEqual(status["network"]["state"], "online")
        self.assertIsNotNone(status["network"]["ip"])
        self.assertEqual(status["app"]["version"], "2.0.0")
        self.assertEqual(status["app"]["data_dir"], self.temporary.name)
        self.assertIn("server_time", status)
        self.assertIn("history", status)
        self.assertIn("stats", status)

    def test_rotation_records_history_and_changes_ip(self) -> None:
        before = self.service.status()
        old_ip = before["network"]["ip"]

        rotation = self.service.rotate(trigger="manual", wait=True)

        self.assertEqual(rotation["status"], "success")
        self.assertFalse(rotation["running"])
        self.assertNotEqual(rotation["new_ip"], old_ip)

        after = self.service.status()
        self.assertEqual(after["network"]["ip"], rotation["new_ip"])
        self.assertEqual(after["rotation"]["status"], "success")
        self.assertEqual(after["stats"]["total"], 1)
        self.assertEqual(after["stats"]["success"], 1)

        history = self.service.history_payload()
        self.assertEqual(len(history["items"]), 1)
        self.assertEqual(history["items"][0]["old_ip"], old_ip)
        self.assertEqual(history["items"][0]["new_ip"], rotation["new_ip"])
        self.assertTrue((Path(self.temporary.name) / "history.json").exists())

    def test_settings_are_validated_and_persisted(self) -> None:
        payload = self.service.update_settings(
            {
                "auto_rotate_enabled": True,
                "auto_rotate_interval_min": 60,
                "rotate_method": "data",
            }
        )

        self.assertTrue(payload["settings"]["auto_rotate_enabled"])
        self.assertEqual(payload["settings"]["auto_rotate_interval_min"], 60)
        self.assertEqual(payload["settings"]["rotate_method"], "data")
        self.assertIsNotNone(payload["auto_rotate"]["next_at"])

        with self.assertRaises(ValueError):
            self.service.update_settings({"auto_rotate_interval_min": 2})

        stored = self.service._settings_store.load()  # noqa: SLF001 - persistence check
        self.assertEqual(stored["auto_rotate_interval_min"], 60)

    def test_clear_history_and_logs(self) -> None:
        self.service.rotate(trigger="manual", wait=True)
        self.assertGreater(len(self.service.history_payload()["items"]), 0)

        cleared = self.service.clear_history()
        self.assertEqual(cleared["stats"]["total"], 0)
        self.assertEqual(self.service.history_payload()["items"], [])

        last_id = self.service.clear_logs()["last_id"]
        self.assertEqual(self.service.events.snapshot(after=last_id)["items"], [])

    def test_reconnect_and_restart_are_rejected_without_device(self) -> None:
        disconnected = MobileProxyService(
            self.config,
            demo=True,
            echo_logs=False,
            time_scale=0.01,
        )
        # A demo service always has a simulated phone; this verifies the guard
        # without starting the monitor thread.
        disconnected.device["connected"] = False
        disconnected.device["serial"] = None
        with self.assertRaises(NotConnectedError):
            disconnected.reconnect_device()
        with self.assertRaises(NotConnectedError):
            disconnected.restart_proxy()


if __name__ == "__main__":
    unittest.main()
