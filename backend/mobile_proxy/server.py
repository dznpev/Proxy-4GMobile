"""Local HTTP server for the dashboard and JSON API."""

from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

from .config import APP_NAME, APP_VERSION, WEB_DIR, AppConfig
from .i18n import get_message
from .service import BusyError, MobileProxyService, NotConnectedError, ServiceError

STATIC_TYPES = {
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".json": "application/json; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
}

SECURITY_HEADERS = {
    "Content-Security-Policy": (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self'; "
        "font-src 'self'; "
        "img-src 'self' data:; "
        "connect-src 'self'; "
        "form-action 'self'; "
        "base-uri 'none'; "
        "frame-ancestors 'none'; "
        "object-src 'none'"
    ),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}

MAX_BODY_BYTES = 64 * 1024


class _BadRequest(Exception):
    def __init__(self, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.status = status


class _ThreadingServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


class _DashboardHandler(BaseHTTPRequestHandler):
    server_version = f"MobileProxy/{APP_VERSION}"
    sys_version = ""
    protocol_version = "HTTP/1.1"
    service: MobileProxyService
    config: AppConfig
    web_dir: Path

    # -- HTTP verbs -----------------------------------------------------
    def do_GET(self) -> None:  # noqa: N802
        try:
            parsed = urlparse(self.path)
            path = unquote(parsed.path)
            if path in ("/", "/device", "/history", "/logs", "/settings"):
                self._serve_index()
            elif path == "/favicon.svg":
                self._serve_file(self.web_dir / "favicon.svg", "image/svg+xml")
            elif path.startswith("/assets/"):
                self._serve_asset(path)
            elif path == "/api/status":
                self._json(200, self.service.status())
            elif path == "/api/logs":
                query = parse_qs(parsed.query)
                after = _query_int(query, "after", 0)
                limit = min(max(_query_int(query, "limit", 300), 1), 500)
                self._json(
                    200, self.service.events.snapshot(after=after, limit=limit)
                )
            elif path == "/api/history":
                self._json(200, self.service.history_payload())
            elif path == "/api/settings":
                self._json(200, self.service.settings_payload())
            elif path == "/api/health":
                self._json(
                    200,
                    {
                        "ok": True,
                        "app": APP_NAME,
                        "version": APP_VERSION,
                        "demo": self.service.demo,
                    },
                )
            elif path.startswith("/api/"):
                self._json_error(404, "not_found", "Không tìm thấy API.")
            else:
                self._not_found()
        except (BrokenPipeError, ConnectionResetError):
            return
        except Exception as exc:  # pragma: no cover - defensive
            self._handle_unexpected(exc)

    def do_POST(self) -> None:  # noqa: N802
        try:
            path = unquote(urlparse(self.path).path)
            body = self._read_json_body()
            if path == "/api/rotate":
                rotation = self.service.rotate(trigger="manual")
                self._json(202, {"ok": True, "rotation": rotation})
            elif path == "/api/check":
                status = self.service.refresh_network()
                self._json(200, {"ok": True, "status": status})
            elif path == "/api/settings":
                payload = self.service.update_settings(body)
                self._json(200, {"ok": True, **payload})
            elif path == "/api/history/clear":
                payload = self.service.clear_history()
                self._json(200, {"ok": True, **payload})
            elif path == "/api/logs/clear":
                payload = self.service.clear_logs()
                self._json(200, {"ok": True, **payload})
            elif path == "/api/usage/reset":
                payload = self.service.reset_today_usage()
                self._json(200, {"ok": True, **payload})
            elif path == "/api/device/reconnect":
                payload = self.service.reconnect_device()
                self._json(202, {"ok": True, **payload})
            elif path == "/api/device/battery/charge":
                enabled = body.get("enabled", True)
                payload = self.service.set_device_charging(bool(enabled))
                self._json(200, payload)
            elif path == "/api/proxy/restart":
                payload = self.service.restart_proxy()
                self._json(202, {"ok": True, **payload})
            elif path.startswith("/api/"):
                lang = getattr(self.service, "language", "en")
                self._json_error(404, "not_found", get_message("api.not_found", lang))
            else:
                self._not_found()
        except (BrokenPipeError, ConnectionResetError):
            return
        except _BadRequest as exc:
            self._json_error(exc.status, "invalid_request", str(exc))
        except (BusyError, NotConnectedError) as exc:
            self._json_error(exc.http_status, exc.code, str(exc))
        except ServiceError as exc:
            self._json_error(exc.http_status, exc.code, str(exc))
        except ValueError as exc:
            self._json_error(422, "validation_error", str(exc))
        except Exception as exc:  # pragma: no cover - defensive
            self._handle_unexpected(exc)

    def do_PATCH(self) -> None:  # noqa: N802
        """PATCH is an alias of POST for partial settings updates."""
        try:
            path = unquote(urlparse(self.path).path)
            if path == "/api/settings":
                self.do_POST()
            elif path.startswith("/api/"):
                self._discard_request_body()
                lang = getattr(self.service, "language", "en")
                self._json_error(404, "not_found", get_message("api.not_found", lang))
            else:
                self._discard_request_body()
                self._not_found()
        except (BrokenPipeError, ConnectionResetError):
            return
        except Exception as exc:  # pragma: no cover - defensive
            self._handle_unexpected(exc)

    # -- Static files ---------------------------------------------------
    def _serve_index(self) -> None:
        self._serve_file(
            self.web_dir / "index.html",
            "text/html; charset=utf-8",
            cache="no-store",
        )

    def _serve_asset(self, path: str) -> None:
        relative = path[len("/assets/") :]
        base = (self.web_dir / "assets").resolve()
        try:
            target = (base / relative).resolve()
        except (OSError, ValueError):
            self._not_found()
            return
        if not target.is_relative_to(base) or not target.is_file():
            self._not_found()
            return
        content_type = STATIC_TYPES.get(target.suffix.lower())
        if not content_type:
            self._not_found()
            return
        cache = "public, max-age=86400" if target.suffix == ".woff2" else "no-cache"
        self._serve_file(target, content_type, cache=cache)

    def _serve_file(self, target: Path, content_type: str, *, cache: str = "no-store") -> None:
        try:
            payload = target.read_bytes()
        except OSError:
            self._json_error(500, "asset_missing", "Không tìm thấy tài nguyên giao diện.")
            return
        self._send(200, content_type, payload, cache=cache)

    # -- Request/response helpers --------------------------------------
    def _read_json_body(self) -> dict[str, Any]:
        raw_length = self.headers.get("Content-Length", "0")
        try:
            length = int(raw_length)
        except ValueError as exc:
            raise _BadRequest("Content-Length không hợp lệ.") from exc
        if length < 0 or length > MAX_BODY_BYTES:
            raise _BadRequest("Nội dung yêu cầu quá lớn.", status=413)
        raw = self.rfile.read(length) if length else b""
        if not raw.strip():
            return {}
        try:
            body = json.loads(raw)
        except ValueError as exc:
            raise _BadRequest("JSON không hợp lệ.") from exc
        if not isinstance(body, dict):
            raise _BadRequest("Nội dung yêu cầu phải là một đối tượng JSON.")
        return body

    def _discard_request_body(self) -> None:
        """Drain an unread body so HTTP/1.1 keep-alive connections stay in sync.

        Used on paths that reject the request without parsing its payload. If the
        body cannot be drained safely, close the connection instead of leaving
        unread bytes that the next request would interpret as a request line.
        """
        if self.headers.get("Transfer-Encoding"):
            self.close_connection = True
            return
        raw_length = self.headers.get("Content-Length", "0")
        try:
            length = int(raw_length)
        except ValueError:
            self.close_connection = True
            return
        if length <= 0:
            return
        if length > MAX_BODY_BYTES:
            self.close_connection = True
            return
        self.rfile.read(length)

    def _json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(
            payload, ensure_ascii=False, allow_nan=False, separators=(",", ":")
        ).encode("utf-8")
        self._send(
            status,
            "application/json; charset=utf-8",
            body,
            cache="no-store",
        )

    def _json_error(self, status: int, code: str, message: str) -> None:
        self._json(
            status,
            {"ok": False, "error": {"code": code, "message": message}},
        )

    def _send(
        self, status: int, content_type: str, body: bytes, *, cache: str
    ) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", cache)
        for name, value in SECURITY_HEADERS.items():
            self.send_header(name, value)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _not_found(self) -> None:
        body = (
            '<!doctype html><html lang="vi"><meta charset="utf-8">'
            "<title>404</title><body><h1>404</h1>"
            '<p>Không tìm thấy trang.</p>'
            '<p><a href="/">Mở dashboard</a></p></body></html>'
        ).encode("utf-8")
        self._send(404, "text/html; charset=utf-8", body, cache="no-store")

    def _handle_unexpected(self, exc: Exception) -> None:
        try:
            self.service.events.add(
                "error", f"Lỗi máy chủ dashboard: {exc}", source="api"
            )
        except Exception:
            pass
        try:
            self._json_error(500, "internal_error", "Lỗi nội bộ của dashboard.")
        except (BrokenPipeError, ConnectionResetError):
            pass

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A002
        return


def _query_int(query: dict[str, list[str]], name: str, default: int) -> int:
    try:
        return int(query.get(name, [str(default)])[0])
    except (TypeError, ValueError):
        return default


class DashboardServer:
    def __init__(
        self,
        service: MobileProxyService,
        config: AppConfig,
        *,
        web_dir: Path = WEB_DIR,
    ) -> None:
        self.service = service
        self.config = config
        self.web_dir = web_dir
        handler = type(
            "BoundDashboardHandler",
            (_DashboardHandler,),
            {
                "service": service,
                "config": config,
                "web_dir": web_dir,
            },
        )
        self.httpd = _ThreadingServer(
            (config.control_host, config.control_port), handler
        )
        self._thread: threading.Thread | None = None

    @property
    def port(self) -> int:
        return int(self.httpd.server_address[1])

    @property
    def url(self) -> str:
        host = (
            "127.0.0.1"
            if self.config.control_host in ("0.0.0.0", "::")
            else self.config.control_host
        )
        return f"http://{host}:{self.port}"

    def start(self) -> None:
        if self._thread is not None:
            return
        if self.config.control_host not in ("127.0.0.1", "localhost", "::1"):
            self.service.events.add(
                "warning",
                "Dashboard đang mở ngoài loopback và không có xác thực. "
                "Chỉ dùng trong mạng tin cậy.",
                source="api",
            )
        self._thread = threading.Thread(
            target=self.httpd.serve_forever,
            kwargs={"poll_interval": 0.2},
            name="dashboard-http",
            daemon=True,
        )
        self._thread.start()
        self.service.events.add(
            "success", f"Dashboard: {self.url}", source="api"
        )

    def stop(self) -> None:
        if self._thread is None:
            self.httpd.server_close()
            return
        self.httpd.shutdown()
        self.httpd.server_close()
        self._thread.join(timeout=3)
        self._thread = None
