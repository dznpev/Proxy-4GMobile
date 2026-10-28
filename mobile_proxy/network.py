"""Public-IP verification through the local proxy."""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

import requests

from .config import IP_LOOKUP_URL


class NetworkError(RuntimeError):
    """Raised when the public IP cannot be verified through the proxy."""


@dataclass(frozen=True)
class NetworkInfo:
    ip: str
    isp: str
    city: str
    region: str
    country: str
    latency_ms: int
    checked_at: float


class NetworkChecker:
    def __init__(self, url: str = IP_LOOKUP_URL, timeout: float = 8.0) -> None:
        self.url = url
        self.timeout = timeout

    def check(self, proxy_port: int) -> NetworkInfo:
        proxy_url = f"http://127.0.0.1:{proxy_port}"
        proxies = {"http": proxy_url, "https": proxy_url}
        started = time.perf_counter()
        try:
            response = requests.get(self.url, proxies=proxies, timeout=self.timeout)
        except requests.RequestException as exc:
            raise NetworkError(_friendly_error(exc)) from exc

        if response.status_code != 200:
            raise NetworkError(f"Máy chủ kiểm tra IP trả về HTTP {response.status_code}.")

        try:
            data: dict[str, Any] = response.json()
        except ValueError as exc:
            raise NetworkError("Máy chủ kiểm tra IP trả về dữ liệu không hợp lệ.") from exc

        if data.get("status") != "success" or not data.get("query"):
            message = data.get("message") or "Không lấy được IP công khai."
            raise NetworkError(str(message))

        latency = max(1, round((time.perf_counter() - started) * 1000))
        return NetworkInfo(
            ip=str(data["query"]),
            isp=str(data.get("isp") or "Không xác định"),
            city=str(data.get("city") or ""),
            region=str(data.get("regionName") or ""),
            country=str(data.get("country") or ""),
            latency_ms=latency,
            checked_at=time.time(),
        )


def _friendly_error(exc: requests.RequestException) -> str:
    text = str(exc)
    lowered = text.lower()
    if "timed out" in lowered or "timeout" in lowered:
        return "Hết thời gian chờ khi kiểm tra IP qua proxy."
    if "proxy" in lowered:
        return "Không kết nối được tới proxy trên máy tính."
    if "connection" in lowered:
        return "Proxy chưa có kết nối Internet."
    return f"Không kiểm tra được IP công khai: {text}"
