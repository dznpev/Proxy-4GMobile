#!/usr/bin/env python3
"""4G Mobile Proxy — zero-app mobile proxy with a local dashboard.

Run:
    python auto_mobile_proxy.py
    python auto_mobile_proxy.py --demo   # UI preview without a phone

The phone is controlled over ADB. The Go proxy daemon is pushed to
/data/local/tmp on the device; no APK is installed.
"""

from __future__ import annotations

import argparse
import signal
import sys
import threading
import time
import webbrowser
from pathlib import Path

try:
    from mobile_proxy.config import APP_NAME, APP_VERSION, AppConfig
    from mobile_proxy.server import DashboardServer
    from mobile_proxy.service import MobileProxyService, ServiceError
except ModuleNotFoundError as exc:  # pragma: no cover - user environment
    if exc.name == "requests":
        sys.stderr.write(
            "Thiếu thư viện 'requests'. Cài đặt bằng:\n"
            "    python -m pip install -r requirements.txt\n"
        )
        raise SystemExit(1) from exc
    raise

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass


def build_parser() -> argparse.ArgumentParser:
    base = AppConfig.from_env()
    parser = argparse.ArgumentParser(
        prog="auto_mobile_proxy.py",
        description="Biến điện thoại Android 4G thành proxy HTTP qua ADB, kèm dashboard quản lý.",
    )
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Chạy dữ liệu mô phỏng để xem dashboard mà không cần điện thoại.",
    )
    parser.add_argument(
        "--proxy-port",
        type=int,
        default=base.proxy_port,
        help=f"Cổng proxy HTTP trên máy tính (mặc định: {base.proxy_port}).",
    )
    parser.add_argument(
        "--control-port",
        type=int,
        default=base.control_port,
        help=f"Cổng dashboard/API (mặc định: {base.control_port}).",
    )
    parser.add_argument(
        "--host",
        default=base.control_host,
        help=f"Địa chỉ bind dashboard (mặc định: {base.control_host}).",
    )
    parser.add_argument(
        "--adb",
        default=base.adb_path,
        help=f"Đường dẫn lệnh ADB (mặc định: {base.adb_path}).",
    )
    parser.add_argument(
        "--data-dir",
        default=str(base.data_dir),
        help=f"Thư mục lưu cài đặt và lịch sử (mặc định: {base.data_dir}).",
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        help="Không đọc lệnh từ bàn phím; chỉ chạy dashboard và tiến trình nền.",
    )
    parser.add_argument(
        "--open",
        action="store_true",
        dest="open_browser",
        help="Tự mở dashboard trong trình duyệt mặc định.",
    )
    parser.add_argument(
        "--version", action="version", version=f"{APP_NAME} {APP_VERSION}"
    )
    return parser


def build_config(args: argparse.Namespace) -> AppConfig:
    return AppConfig(
        proxy_port=args.proxy_port,
        control_port=args.control_port,
        control_host=args.host,
        data_dir=Path(args.data_dir).expanduser().resolve(),
        adb_path=args.adb,
        demo=args.demo,
    )


def validate_config(config: AppConfig, parser: argparse.ArgumentParser) -> None:
    for label, value in (
        ("--proxy-port", config.proxy_port),
        ("--control-port", config.control_port),
    ):
        if not 1 <= value <= 65535:
            parser.error(f"{label} phải nằm trong khoảng 1-65535.")
    if config.proxy_port == config.control_port:
        parser.error("--proxy-port và --control-port phải khác nhau.")


def print_banner(server: DashboardServer, config: AppConfig, demo: bool) -> None:
    print("=" * 68)
    print(f"  {APP_NAME} · v{APP_VERSION}" + ("  [DEMO]" if demo else ""))
    print("=" * 68)
    print(f"  Dashboard   : {server.url}")
    print(f"  Proxy HTTP  : {config.proxy_url}")
    print(f"  Dữ liệu     : {config.data_dir}")
    print("-" * 68)
    print("  Lệnh: r = xoay IP · c = kiểm tra kết nối · q = thoát")
    print("=" * 68, flush=True)


def console_loop(service: MobileProxyService, stop_event: threading.Event) -> None:
    while not stop_event.is_set():
        try:
            command = input("proxy> ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            break

        if command in ("q", "quit", "exit"):
            break
        if command == "r":
            try:
                service.rotate(trigger="manual")
                print("[*] Đã bắt đầu xoay IP. Theo dõi tiến trình trên dashboard.")
            except ServiceError as exc:
                print(f"[X] {exc}")
        elif command == "c":
            try:
                service.refresh_network()
                print("[OK] Đã cập nhật trạng thái kết nối.")
            except ServiceError as exc:
                print(f"[X] {exc}")
        elif command in ("h", "help", "?"):
            print("  r = xoay IP · c = kiểm tra kết nối · q = thoát")
        elif command:
            print("[!] Lệnh không hợp lệ. Gõ h để xem trợ giúp.")


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    validate_config(build_config(args), parser)
    config = build_config(args)

    service = MobileProxyService(
        config,
        demo=config.demo,
        time_scale=0.35 if config.demo else 1.0,
    )
    try:
        server = DashboardServer(service, config)
    except OSError as exc:
        print(
            f"[X] Không mở được dashboard tại {config.control_host}:{config.control_port}: {exc}",
            file=sys.stderr,
        )
        print("    Kiểm tra cổng đã bị chiếm hay chưa rồi thử lại.", file=sys.stderr)
        return 1

    stop_event = threading.Event()

    def request_stop(signum: int, frame: object) -> None:
        stop_event.set()

    for signal_name in ("SIGINT", "SIGTERM", "SIGBREAK"):
        signal_value = getattr(signal, signal_name, None)
        if signal_value is not None:
            try:
                signal.signal(signal_value, request_stop)
            except (OSError, ValueError):
                pass

    try:
        service.start()
        server.start()
        print_banner(server, config, config.demo)
        if args.open_browser:
            threading.Timer(0.6, lambda: webbrowser.open(server.url)).start()

        if args.headless or not sys.stdin.isatty():
            print("[*] Chế độ headless. Nhấn Ctrl+C để dừng.", flush=True)
            while not stop_event.is_set():
                time.sleep(0.5)
        else:
            console_loop(service, stop_event)
    except KeyboardInterrupt:
        pass
    finally:
        print("\n[*] Đang dừng ứng dụng...", flush=True)
        server.stop()
        service.stop(cleanup=True)
        print("[OK] Đã dừng.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
