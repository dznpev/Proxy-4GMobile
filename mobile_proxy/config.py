"""Runtime configuration for the 4G mobile proxy tool."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

APP_NAME = "4G Mobile Proxy"
APP_VERSION = "2.0.0"

ROOT_DIR = Path(__file__).resolve().parent.parent
BIN_DIR = ROOT_DIR / "bin"
WEB_DIR = ROOT_DIR / "web"
DEFAULT_DATA_DIR = ROOT_DIR / "data"

REMOTE_BIN = "/data/local/tmp/mini_proxy"
IP_LOOKUP_URL = (
    "http://ip-api.com/json/"
    "?fields=status,message,country,regionName,city,isp,query"
)


@dataclass(frozen=True)
class AppConfig:
    """Frozen application configuration.

    Values come from CLI flags first, then environment variables, then the
    defaults below. The control server binds to loopback by default because it
    exposes device-control actions without authentication.
    """

    proxy_port: int = 8080
    control_port: int = 8081
    control_host: str = "127.0.0.1"
    data_dir: Path = DEFAULT_DATA_DIR
    adb_path: str = "adb"
    demo: bool = False

    @property
    def history_path(self) -> Path:
        return self.data_dir / "history.json"

    @property
    def settings_path(self) -> Path:
        return self.data_dir / "settings.json"

    @property
    def proxy_url(self) -> str:
        return f"http://127.0.0.1:{self.proxy_port}"

    @property
    def dashboard_url(self) -> str:
        host = "127.0.0.1" if self.control_host in ("0.0.0.0", "::") else self.control_host
        return f"http://{host}:{self.control_port}"

    @classmethod
    def from_env(cls) -> "AppConfig":
        return cls(
            proxy_port=_env_int("PROXY_HTTP_PORT", 8080),
            control_port=_env_int("PROXY_CONTROL_PORT", 8081),
            control_host=os.environ.get("PROXY_CONTROL_HOST", "127.0.0.1"),
            data_dir=Path(os.environ.get("PROXY_DATA_DIR", DEFAULT_DATA_DIR)),
            adb_path=os.environ.get("PROXY_ADB", "adb"),
        )


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default
