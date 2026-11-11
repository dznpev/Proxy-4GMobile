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
    from backend.mobile_proxy.config import APP_NAME, APP_VERSION, AppConfig
    from backend.mobile_proxy.i18n import get_message
    from backend.mobile_proxy.server import DashboardServer
    from backend.mobile_proxy.service import MobileProxyService, ServiceError
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
        description="Turn an Android 4G phone into an HTTP proxy over ADB with a local dashboard.",
    )
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Run in demo mode with simulated device and IP (no phone required).",
    )
    parser.add_argument(
        "--proxy-port",
        type=int,
        default=base.proxy_port,
        help=f"HTTP proxy port on the host (default: {base.proxy_port}).",
    )
    parser.add_argument(
        "--control-port",
        type=int,
        default=base.control_port,
        help=f"Dashboard and API port (default: {base.control_port}).",
    )
    parser.add_argument(
        "--host",
        default=base.control_host,
        help=f"Dashboard bind address (default: {base.control_host}).",
    )
    parser.add_argument(
        "--adb",
        default=base.adb_path,
        help=f"Path to ADB executable (default: {base.adb_path}).",
    )
    parser.add_argument(
        "--data-dir",
        default=str(base.data_dir),
        help=f"Directory for settings and history (default: {base.data_dir}).",
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        help="Run without interactive console input; run dashboard and background service only.",
    )
    parser.add_argument(
        "--open",
        action="store_true",
        dest="open_browser",
        help="Automatically open the dashboard in default browser.",
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


def print_banner(
    server: DashboardServer, config: AppConfig, demo: bool, lang: str = "en"
) -> None:
    dash_label = get_message("cli.banner.dashboard", lang).ljust(12)
    proxy_label = get_message("cli.banner.proxy", lang).ljust(12)
    data_label = get_message("cli.banner.data", lang).ljust(12)
    commands_text = get_message("cli.banner.commands", lang)
    print("=" * 68)
    print(f"  {APP_NAME} · v{APP_VERSION}" + ("  [DEMO]" if demo else ""))
    print("=" * 68)
    print(f"  {dash_label}: {server.url}")
    print(f"  {proxy_label}: {config.proxy_url}")
    print(f"  {data_label}: {config.data_dir}")
    print("-" * 68)
    print(f"  {commands_text}")
    print("=" * 68, flush=True)


def console_loop(service: MobileProxyService, stop_event: threading.Event) -> None:
    while not stop_event.is_set():
        lang = service.language
        try:
            command = input("proxy> ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            break

        if command in ("q", "quit", "exit"):
            break
        if command == "r":
            try:
                service.rotate(trigger="manual")
                print(get_message("cli.rotate.started", lang))
            except ServiceError as exc:
                print(f"[X] {exc}")
        elif command == "c":
            try:
                service.refresh_network()
                print(get_message("cli.check.updated", lang))
            except ServiceError as exc:
                print(f"[X] {exc}")
        elif command in ("h", "help", "?"):
            print(f"  {get_message('cli.banner.commands', lang)}")
        elif command:
            print(get_message("cli.command.invalid", lang))


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
    if config.demo:
        service.seed_demo_history()
    try:
        server = DashboardServer(service, config)
    except OSError as exc:
        lang = service.language
        error_msg = get_message(
            "cli.server_error",
            lang,
            host=config.control_host,
            port=config.control_port,
            error=exc,
        )
        print(error_msg, file=sys.stderr)
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
        print_banner(server, config, config.demo, lang=service.language)
        if args.open_browser:
            threading.Timer(0.6, lambda: webbrowser.open(server.url)).start()

        if args.headless or not sys.stdin.isatty():
            print(get_message("cli.headless", service.language), flush=True)
            while not stop_event.is_set():
                time.sleep(0.5)
        else:
            console_loop(service, stop_event)
    except KeyboardInterrupt:
        pass
    finally:
        print(get_message("cli.stopping", service.language), flush=True)
        server.stop()
        service.stop(cleanup=True)
        print(get_message("cli.stopped", service.language), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
