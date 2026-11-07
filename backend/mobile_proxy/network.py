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


DEFAULT_LOOKUP_ENDPOINTS: list[dict[str, str]] = [
    {
        "url": IP_LOOKUP_URL,
        "type": "ip-api",
    },
    {
        "url": "http://ipwho.is/",
        "type": "ipwhois",
    },
    {
        "url": "http://api.ipify.org?format=json",
        "type": "ipify",
    },
]


class NetworkChecker:
    def __init__(self, url: str = IP_LOOKUP_URL, timeout: float = 8.0) -> None:
        self.url = url
        self.timeout = timeout

    def check(self, proxy_port: int) -> NetworkInfo:
        proxy_url = f"http://127.0.0.1:{proxy_port}"
        proxies = {"http": proxy_url, "https": proxy_url}

        # If caller passed a custom non-default URL, only check that specific URL
        if self.url != IP_LOOKUP_URL:
            endpoints = [{"url": self.url, "type": "custom"}]
        else:
            endpoints = DEFAULT_LOOKUP_ENDPOINTS

        last_error = "Không xác minh được IP qua proxy."
        started = time.perf_counter()

        for index, endpoint in enumerate(endpoints):
            target_url = endpoint["url"]
            endpoint_type = endpoint["type"]
            # Distribute timeout across providers if multiple exist
            req_timeout = self.timeout if len(endpoints) == 1 else min(self.timeout, 5.0)

            try:
                response = requests.get(target_url, proxies=proxies, timeout=req_timeout)
            except requests.RequestException as exc:
                err_msg = _friendly_error(exc)
                last_error = err_msg
                # If connection to the local proxy port failed entirely, fallbacks won't help
                if "Không kết nối được tới proxy trên máy tính" in err_msg:
                    raise NetworkError(err_msg) from exc
                continue

            # Detect Go mini_proxy internal error response (e.g. DNS / cell network not ready)
            if response.status_code == 503 and (
                "dial tcp" in response.text
                or "no such host" in response.text
                or "unreachable" in response.text
            ):
                raise NetworkError("Proxy chưa có kết nối Internet (4G đang kết nối lại).")

            if response.status_code != 200:
                last_error = f"Máy chủ kiểm tra IP trả về HTTP {response.status_code}."
                continue

            try:
                data: dict[str, Any] = response.json()
            except ValueError:
                last_error = "Máy chủ kiểm tra IP trả về dữ liệu không hợp lệ."
                continue

            info = _parse_provider_data(data, endpoint_type, started)
            if info is not None:
                return info

            last_error = str(data.get("message") or "Không lấy được IP công khai.")

        raise NetworkError(last_error)


def _parse_provider_data(
    data: dict[str, Any], endpoint_type: str, started: float
) -> NetworkInfo | None:
    latency = max(1, round((time.perf_counter() - started) * 1000))
    now = time.time()

    if endpoint_type in ("ip-api", "custom"):
        if data.get("status") == "success" and data.get("query"):
            return NetworkInfo(
                ip=str(data["query"]),
                isp=str(data.get("isp") or "Không xác định"),
                city=str(data.get("city") or ""),
                region=str(data.get("regionName") or ""),
                country=str(data.get("country") or ""),
                latency_ms=latency,
                checked_at=now,
            )

    if endpoint_type == "ipwhois":
        if data.get("success") is True and data.get("ip"):
            conn = data.get("connection") or {}
            isp = conn.get("isp") or data.get("isp") or "Không xác định"
            return NetworkInfo(
                ip=str(data["ip"]),
                isp=str(isp),
                city=str(data.get("city") or ""),
                region=str(data.get("region") or ""),
                country=str(data.get("country") or ""),
                latency_ms=latency,
                checked_at=now,
            )

    if endpoint_type == "ipify":
        if data.get("ip"):
            return NetworkInfo(
                ip=str(data["ip"]),
                isp="Không xác định",
                city="",
                region="",
                country="",
                latency_ms=latency,
                checked_at=now,
            )

    return None


def _friendly_error(exc: requests.RequestException) -> str:
    text = str(exc)
    lowered = text.lower()
    if "timed out" in lowered or "timeout" in lowered:
        return "Hết thời gian chờ khi kiểm tra IP qua proxy."
    if "proxy" in lowered and (
        "refused" in lowered
        or "cannot connect" in lowered
        or "failed to establish" in lowered
        or "max retries exceeded" in lowered
    ):
        return "Không kết nối được tới proxy trên máy tính."
    if "proxy" in lowered:
        return "Không kết nối được tới proxy trên máy tính."
    if "connection" in lowered:
        return "Proxy chưa có kết nối Internet."
    return f"Không kiểm tra được IP công khai: {text}"
