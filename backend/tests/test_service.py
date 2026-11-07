"""Integration tests for the demo service (no phone or network required)."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from backend.mobile_proxy.adb import parse_dumpsys_battery, parse_proc_net_dev
from backend.mobile_proxy.config import AppConfig
from backend.mobile_proxy.service import MobileProxyService, NotConnectedError


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
            self.service.update_settings({"auto_rotate_interval_min": 1})

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
        with self.assertRaises(NotConnectedError):
            disconnected.set_device_charging(False)

    def test_battery_monitoring_and_charge_control(self) -> None:
        status = self.service.status()
        battery = status["device"].get("battery")
        self.assertIsNotNone(battery)
        self.assertEqual(battery["level"], 82)
        self.assertEqual(battery["temperature"], 37.5)
        self.assertEqual(battery["warning_level"], "normal")
        self.assertEqual(battery["plugged"], "usb")
        self.assertFalse(battery["charging_disabled"])

        # Test toggling charging off
        result = self.service.set_device_charging(False)
        self.assertTrue(result["ok"])
        self.assertTrue(result["battery"]["charging_disabled"])

        # Test toggling charging back on
        result = self.service.set_device_charging(True)
        self.assertTrue(result["ok"])
        self.assertFalse(result["battery"]["charging_disabled"])

    def test_parse_dumpsys_battery_output(self) -> None:
        sample_output = """
Current Battery Service state:
  AC powered: false
  USB powered: true
  Wireless powered: false
  Max charging current: 500000
  Max charging voltage: 5000000
  Charge counter: 2800000
  status: 2
  health: 2
  present: true
  level: 89
  scale: 100
  voltage: 4150
  temperature: 412
  technology: Li-ion
        """.strip()

        parsed = parse_dumpsys_battery(sample_output)
        self.assertEqual(parsed["level"], 89)
        self.assertEqual(parsed["temperature"], 41.2)
        self.assertEqual(parsed["status"], "charging")
        self.assertEqual(parsed["plugged"], "usb")
        self.assertEqual(parsed["health"], "good")
        self.assertEqual(parsed["voltage_mv"], 4150)
        self.assertTrue(parsed["present"])

    def test_data_usage_in_status_and_reset(self) -> None:
        status = self.service.status()
        self.assertIn("data_usage", status)
        usage = status["data_usage"]
        self.assertIn("today_rx_bytes", usage)
        self.assertIn("today_tx_bytes", usage)
        self.assertIn("today_total_bytes", usage)
        self.assertIn("daily_limit_gb", usage)
        self.assertIn("usage_percent", usage)
        self.assertEqual(usage["daily_limit_gb"], 4.0)

        # Record some usage
        self.service._usage_store.record_delta(1024 * 1024, 512 * 1024)
        status_after = self.service.status()
        self.assertGreater(status_after["data_usage"]["today_total_bytes"], 0)

        # Reset usage
        reset_res = self.service.reset_today_usage()
        self.assertTrue(reset_res["ok"])
        self.assertEqual(reset_res["data_usage"]["today_total_bytes"], 0)
        status_reset = self.service.status()
        self.assertEqual(status_reset["data_usage"]["today_total_bytes"], 0)

    def test_adb_pidof_filters_errors_and_extracts_pids(self) -> None:
        from unittest.mock import patch
        from backend.mobile_proxy.adb import AdbClient

        adb = AdbClient()
        with patch.object(adb, "shell", return_value="error: device offline"):
            self.assertEqual(adb.pidof("serial123", "mini_proxy"), "")

        with patch.object(adb, "shell", return_value="/system/bin/sh: pidof: not found"):
            self.assertEqual(adb.pidof("serial123", "mini_proxy"), "")

        with patch.object(adb, "shell", return_value="10597"):
            self.assertEqual(adb.pidof("serial123", "mini_proxy"), "10597")

        with patch.object(adb, "shell", return_value="10597 10598\n"):
            self.assertEqual(adb.pidof("serial123", "mini_proxy"), "10597 10598")

    def test_adb_is_forwarded(self) -> None:
        from unittest.mock import patch, MagicMock
        from backend.mobile_proxy.adb import AdbClient

        adb = AdbClient()
        mock_res = MagicMock()
        mock_res.stdout = "serial123 tcp:8080 tcp:8080\notherdev tcp:9090 tcp:9090\n"
        with patch.object(adb, "_run", return_value=mock_res):
            self.assertTrue(adb.is_forwarded("serial123", 8080))
            self.assertFalse(adb.is_forwarded("serial123", 9090))
            self.assertFalse(adb.is_forwarded("serial123", 8081))


    def test_parse_proc_net_dev(self) -> None:
        sample_proc = """
Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
    lo: 1234567      120    0    0    0     0          0         0  1234567      120    0    0    0     0       0          0
 wlan0: 9999999      500    0    0    0     0          0         0  8888888      400    0    0    0     0       0          0
rmnet_data0: 10485760 1000    0    0    0     0          0         0  2097152      500    0    0    0     0       0          0
v4-rmnet_data0: 5242880  500    0    0    0     0          0         0  1048576      250    0    0    0     0       0          0
ccmni0: 1048576  100    0    0    0     0          0         0   524288       50    0    0    0     0       0          0
        """.strip()

        parsed = parse_proc_net_dev(sample_proc)
        # Should sum rmnet_data0 (10485760 rx, 2097152 tx) + ccmni0 (1048576 rx, 524288 tx)
        # Should skip lo, wlan0, and v4-rmnet_data0
        self.assertEqual(parsed["rx_bytes"], 10485760 + 1048576)
        self.assertEqual(parsed["tx_bytes"], 2097152 + 524288)
        self.assertEqual(parsed["total_bytes"], (10485760 + 1048576) + (2097152 + 524288))


if __name__ == "__main__":
    unittest.main()
