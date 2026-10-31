"""HTTP-level tests for the dashboard and compatibility API."""

from __future__ import annotations

import json
import re
import tempfile
import time
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from backend.mobile_proxy.config import WEB_DIR, AppConfig
from backend.mobile_proxy.server import DashboardServer
from backend.mobile_proxy.service import MobileProxyService


class DashboardServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.temporary = tempfile.TemporaryDirectory()
        cls.config = AppConfig(
            proxy_port=18090,
            control_port=0,
            data_dir=Path(cls.temporary.name),
            demo=True,
        )
        cls.service = MobileProxyService(
            cls.config,
            demo=True,
            echo_logs=False,
            time_scale=0.01,
        )
        cls.service.start()
        cls.server = DashboardServer(cls.service, cls.config)
        cls.server.start()
        cls.port = cls.server.port

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.stop()
        cls.service.stop()
        cls.temporary.cleanup()

    def request(
        self,
        path: str,
        *,
        method: str = "GET",
        payload: dict | None = None,
    ) -> tuple[int, dict[str, str], bytes]:
        data = json.dumps(payload).encode("utf-8") if payload is not None else None
        headers = {"Content-Type": "application/json"} if data else {}
        request = Request(
            f"http://127.0.0.1:{self.port}{path}",
            data=data,
            headers=headers,
            method=method,
        )
        try:
            with urlopen(request, timeout=10) as response:
                return response.status, dict(response.headers), response.read()
        except HTTPError as exc:
            try:
                return exc.code, dict(exc.headers), exc.read()
            finally:
                exc.close()

    def json_request(
        self,
        path: str,
        *,
        method: str = "GET",
        payload: dict | None = None,
    ) -> tuple[int, dict]:
        status, _, body = self.request(path, method=method, payload=payload)
        return status, json.loads(body)

    def test_dashboard_index_and_assets_are_served(self) -> None:
        index_path = WEB_DIR / "index.html"
        if not index_path.exists():
            self.skipTest("frontend/dist chưa được build (chạy: cd frontend && npm run build)")

        status, headers, body = self.request("/")
        self.assertEqual(status, 200)
        self.assertIn("text/html", headers["Content-Type"])
        self.assertIn(b"4G Mobile Proxy", body)

        html = body.decode("utf-8")
        script = re.search(r'src="(/assets/[^"]+\.js)"', html)
        stylesheet = re.search(r'href="(/assets/[^"]+\.css)"', html)
        self.assertIsNotNone(script, "index.html thiếu script bundle")
        self.assertIsNotNone(stylesheet, "index.html thiếu stylesheet bundle")

        status, headers, asset = self.request(script.group(1))
        self.assertEqual(status, 200)
        self.assertIn("text/javascript", headers["Content-Type"])
        self.assertGreater(len(asset), 1000)

        for path in (stylesheet.group(1), "/favicon.svg", "/assets/fonts/OFL.txt"):
            status, _, _ = self.request(path)
            self.assertEqual(status, 200, path)

    def test_security_headers_are_present(self) -> None:
        _, headers, _ = self.request("/")
        csp = headers["Content-Security-Policy"]
        self.assertIn("default-src 'self'", csp)
        self.assertIn("script-src 'self'", csp)
        self.assertIn("font-src 'self'", csp)
        self.assertNotIn("unsafe-inline", csp)
        self.assertEqual(headers["X-Frame-Options"], "DENY")
        self.assertEqual(headers["X-Content-Type-Options"], "nosniff")

    def test_status_payload_contract(self) -> None:
        status, payload = self.json_request("/api/status")
        self.assertEqual(status, 200)
        for key in (
            "app",
            "device",
            "proxy",
            "network",
            "rotation",
            "auto_rotate",
            "settings",
            "stats",
            "history",
            "server_time",
        ):
            self.assertIn(key, payload)
        self.assertEqual(payload["device"]["status"], "ready")
        self.assertEqual(payload["app"]["data_dir"], self.temporary.name)
        self.assertEqual(payload["proxy"]["port"], 18090)

    def test_settings_update_and_validation_error(self) -> None:
        status, payload = self.json_request(
            "/api/settings",
            method="POST",
            payload={
                "auto_rotate_enabled": True,
                "auto_rotate_interval_min": 20,
                "rotate_method": "airplane",
            },
        )
        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["settings"]["auto_rotate_interval_min"], 20)

        status, payload = self.json_request(
            "/api/settings",
            method="POST",
            payload={"auto_rotate_interval_min": 1},
        )
        self.assertEqual(status, 422)
        self.assertEqual(payload["error"]["code"], "validation_error")

    def test_rotation_endpoint_and_history(self) -> None:
        status, payload = self.json_request("/api/rotate", method="POST", payload={})
        self.assertEqual(status, 202)
        self.assertTrue(payload["ok"])
        self.assertTrue(payload["rotation"]["running"])

        deadline = time.time() + 10
        rotation = payload["rotation"]
        while time.time() < deadline:
            _, current = self.json_request("/api/status")
            rotation = current["rotation"]
            if not rotation["running"]:
                break
            time.sleep(0.05)

        self.assertFalse(rotation["running"])
        self.assertEqual(rotation["status"], "success")

        status, history = self.json_request("/api/history")
        self.assertEqual(status, 200)
        self.assertEqual(len(history["items"]), 1)
        self.assertEqual(history["items"][0]["status"], "success")

    def test_logs_and_legacy_endpoints(self) -> None:
        status, logs = self.json_request("/api/logs?after=0&limit=10")
        self.assertEqual(status, 200)
        self.assertIn("items", logs)
        self.assertIn("last_id", logs)
        self.assertLessEqual(len(logs["items"]), 10)

        status, legacy = self.json_request("/status")
        self.assertEqual(status, 200)
        self.assertEqual(set(legacy), {"connected", "ip"})
        self.assertTrue(legacy["connected"])

    def test_battery_charge_control_endpoint(self) -> None:
        status, payload = self.json_request(
            "/api/device/battery/charge", method="POST", payload={"enabled": False}
        )
        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        self.assertTrue(payload["battery"]["charging_disabled"])

        status, payload = self.json_request(
            "/api/device/battery/charge", method="POST", payload={"enabled": True}
        )
        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        self.assertFalse(payload["battery"]["charging_disabled"])

    def test_usage_reset_endpoint(self) -> None:
        status, payload = self.json_request("/api/usage/reset", method="POST", payload={})
        self.assertEqual(status, 200)
        self.assertTrue(payload["ok"])
        self.assertIn("data_usage", payload)
        self.assertEqual(payload["data_usage"]["today_total_bytes"], 0)

    def test_unknown_api_returns_json_error(self) -> None:
        status, payload = self.json_request("/api/nope")
        self.assertEqual(status, 404)
        self.assertEqual(payload["error"]["code"], "not_found")


if __name__ == "__main__":
    unittest.main()
