"""Bilingual (English/Vietnamese) message catalog for backend event logs.

The catalog is intentionally dependency-free: every user-facing string emitted
by :mod:`backend.mobile_proxy.service` lives here so the active language can be
switched without touching the service logic.
"""

from __future__ import annotations

from typing import Any

DEFAULT_LANGUAGE = "en"
SUPPORTED_LANGUAGES = ("en", "vi")

MESSAGES: dict[str, dict[str, str]] = {
    "en": {
        # Application lifecycle
        "app.starting": "Starting {app} v{version}.",
        "app.demo_mode": "DEMO mode is on: device and IP are simulated.",
        "app.cleanup_done": (
            "Stopped the proxy daemon and released the port on the phone."
        ),
        "app.cleanup_failed": "Could not clean up the device: {error}",
        # ADB / device discovery
        "adb.missing": (
            "ADB was not found in PATH. Install Android Platform Tools to continue."
        ),
        "adb.missing_waiting": (
            "ADB was not found in PATH. Waiting for Android Platform Tools."
        ),
        "adb.command_missing": "The adb command was not found on this computer.",
        "adb.found": "ADB found.",
        "adb.unauthorized_error": "The device has not authorized USB debugging.",
        "adb.unauthorized": (
            "The device is not authorized. Tap 'Allow USB debugging' on the "
            "phone screen."
        ),
        "adb.failed": (
            "Could not run ADB. Check Android Platform Tools in PATH."
        ),
        "adb.monitor_error": "Device monitoring error: {error}",
        "device.busy_retry": "The device is busy. Try connecting again.",
        "device.busy_skip": (
            "The device is handling another operation. Skipping this connection "
            "attempt."
        ),
        "device.reconnect_requested": "Reconnecting the device on request.",
        "device.reconnect_retry": "Retrying device connection...",
        "device.detected": "Android device detected: {serial}",
        "device.summary": (
            "Device: {model} · Android {android} · {abi} · {root_status}"
        ),
        "device.disconnected": (
            "Device disconnected. Waiting for the USB cable to be reconnected..."
        ),
        "device.reconnecting": "Reconnecting the device.",
        "common.unknown": "Unknown",
        "common.rooted": "Rooted",
        "common.not_rooted": "Not rooted",
        # Proxy daemon
        "proxy.unresponsive_restarting": (
            "The proxy daemon is not responding. Restarting..."
        ),
        "proxy.binary_missing": "Proxy binary not found: {name}",
        "proxy.stopping_old": "Stopping existing proxy daemon...",
        "proxy.syncing": "Syncing the proxy daemon to the phone...",
        "proxy.start_failed_device": (
            "The proxy daemon could not start on the phone."
        ),
        "proxy.session_ready": "Proxy session is ready on {model}.",
        "proxy.setup_failed": "Could not set up the proxy: {error}",
        "proxy.starting": "Starting the proxy daemon on port {port}...",
        "proxy.running": "Proxy daemon is running (PID {pid}).",
        "proxy.not_running": "The proxy daemon is not running after startup.",
        "proxy.start_failed": "Could not start the proxy daemon: {error}",
        "proxy.stopped_after_network_restarting": (
            "The proxy daemon stopped after the network change. Restarting..."
        ),
        "proxy.restart_failed_rotation": (
            "Could not restart the proxy daemon after IP rotation."
        ),
        "proxy.restarting": "Restarting the proxy daemon.",
        "proxy.busy_restart": (
            "The device is handling another operation. The daemon cannot be "
            "restarted yet."
        ),
        "proxy.restart_requested": "Restarting the proxy daemon on request.",
        "proxy.restarted": "Proxy daemon restarted.",
        "proxy.restart_failed": "Could not restart the proxy daemon.",
        # Network verification
        "network.device_disconnected": "The device has disconnected.",
        "network.verify_failed": "Could not verify the IP: {error}",
        "network.unknown_error": "Unknown error while checking the IP: {error}",
        "network.public_ip": "Public IP: {ip} · {isp} · {city}",
        "network.check_failed": "Could not check the connection.",
        # Battery
        "battery.critical": (
            "Critical warning: battery temperature {temp}°C exceeds 45°C! "
            "Disabling charging for protection."
        ),
        "battery.warning": (
            "Warning: battery temperature is high ({temp}°C > 40°C). Keep the "
            "phone in a well-ventilated place."
        ),
        "battery.charging_on": "Re-enable battery charging",
        "battery.charging_off": "Temporarily stop battery charging",
        "battery.charging_action": "{action} for the device ({serial}).",
        # IP rotation
        "rotation.idle": "No IP rotation in this session yet.",
        "rotation.preparing": "Preparing IP rotation...",
        "rotation.trigger_auto": "automatic",
        "rotation.trigger_api": "via API",
        "rotation.trigger_manual": "manual",
        "rotation.started": "Starting IP rotation ({trigger}).",
        "rotation.start_failed_detail": (
            "Could not start the rotation process: {error}"
        ),
        "rotation.airplane_on": "Enabling airplane mode...",
        "rotation.data_off": "Disabling mobile data...",
        "rotation.airplane_off": (
            "Disabling airplane mode, waiting for the 4G network..."
        ),
        "rotation.data_on": (
            "Re-enabling mobile data, waiting for the 4G network..."
        ),
        "rotation.waiting": "Waiting for the carrier to assign a new IP...",
        "rotation.verifying": "Verifying the public IP...",
        "rotation.no_ip": "Could not obtain an IP after rotation.",
        "rotation.retry_verify": (
            "Could not verify the IP ({error}). Retrying attempt "
            "{attempt}/{attempts}."
        ),
        "rotation.same_ip_retry": (
            "The carrier assigned the same old IP. Retrying rotation..."
        ),
        "rotation.success": "IP rotated successfully: {ip}",
        "rotation.unchanged": "The IP after rotation is still {ip}",
        "rotation.success_log": (
            "IP rotation succeeded: {old_ip} → {ip} · {isp}."
        ),
        "rotation.same_ip_final": (
            "The carrier still assigned the old IP ({ip}) after 2 attempts."
        ),
        "rotation.failed": "IP rotation failed.",
        "rotation.failed_log": "IP rotation failed: {error}",
        # History and settings
        "history.save_failed": "Could not save the IP rotation history: {error}",
        "history.cleared": "IP rotation history cleared.",
        "settings.auto_rotate_enabled": (
            "Automatic IP rotation enabled every {minutes} minutes."
        ),
        "settings.auto_rotate_disabled": "Automatic IP rotation disabled.",
        "settings.interval_changed": (
            "Automatic rotation interval: {minutes} minutes."
        ),
        "settings.method_airplane": "airplane mode",
        "settings.method_data": "mobile data on/off",
        "settings.method_changed": "Rotation method: {method}.",
        "settings.language_changed": "Language changed to {language}.",
        "auto_rotate.failed": "Could not rotate the IP automatically: {error}",
        "auto_rotate.schedule_error": (
            "Automatic rotation schedule error: {error}"
        ),
        # Data usage and logs
        "usage.reset": "Today's 4G data usage statistics were reset.",
        "usage.warning": (
            "Used {percent}% ({used} GB / {limit} GB) of today's 4G data."
        ),
        "usage.exceeded": (
            "Today's 4G data limit has been reached ({limit} GB)! Watch out for "
            "extra charges."
        ),
        "logs.cleared": "Activity log cleared.",
        # Service errors
        "errors.not_connected": "No Android device is connected.",
        "errors.device_not_detected": "No Android device detected.",
        "errors.rotating": (
            "IP rotation in progress. Please wait for it to finish."
        ),
        "errors.checking_network": "Checking the connection.",
        "errors.device_busy": "The device is handling another operation.",
        "errors.rotation_running": "Another IP rotation is already running.",
        "errors.daemon_not_running": (
            "The proxy daemon is not running. Reconnect the device before "
            "rotating the IP."
        ),
        "errors.rotation_start_failed": (
            "Could not start the IP rotation process."
        ),
        "errors.app_stopping": "The application is stopping.",
        "errors.device_connecting": "The device is connecting.",
        # CLI console
        "cli.banner.dashboard": "Dashboard",
        "cli.banner.proxy": "Proxy HTTP",
        "cli.banner.data": "Data dir",
        "cli.banner.commands": "Commands: r = rotate IP · c = check connection · q = quit",
        "cli.rotate.started": "[*] IP rotation started. Track progress on the dashboard.",
        "cli.check.updated": "[OK] Connection status updated.",
        "cli.command.invalid": "[!] Invalid command. Type h for help.",
        "cli.server_error": "[X] Could not start dashboard at {host}:{port}: {error}\n    Check if the port is already in use and try again.",
        "cli.headless": "[*] Headless mode. Press Ctrl+C to stop.",
        "cli.stopping": "\n[*] Stopping application...",
        "cli.stopped": "[OK] Stopped.",
    },
    "vi": {
        # Application lifecycle
        "app.starting": "Khởi động {app} v{version}.",
        "app.demo_mode": "Chế độ DEMO đang bật: thiết bị và IP đều được mô phỏng.",
        "app.cleanup_done": (
            "Đã dừng daemon proxy và giải phóng cổng trên điện thoại."
        ),
        "app.cleanup_failed": "Không dọn dẹp được thiết bị: {error}",
        # ADB / device discovery
        "adb.missing": (
            "Không tìm thấy ADB trong PATH. Cài Android Platform Tools để tiếp tục."
        ),
        "adb.missing_waiting": (
            "Không tìm thấy ADB trong PATH. Đang chờ Android Platform Tools."
        ),
        "adb.command_missing": "Không tìm thấy lệnh adb trên máy tính.",
        "adb.found": "Đã tìm thấy ADB.",
        "adb.unauthorized_error": "Thiết bị chưa được ủy quyền gỡ lỗi USB.",
        "adb.unauthorized": (
            "Thiết bị chưa được ủy quyền. Bấm 'Cho phép gỡ lỗi USB' trên màn "
            "hình điện thoại."
        ),
        "adb.failed": (
            "Không chạy được ADB. Kiểm tra Android Platform Tools trong PATH."
        ),
        "adb.monitor_error": "Lỗi giám sát thiết bị: {error}",
        "device.busy_retry": "Thiết bị đang bận. Hãy thử kết nối lại.",
        "device.busy_skip": (
            "Thiết bị đang xử lý thao tác khác. Bỏ qua lần kết nối này."
        ),
        "device.reconnect_requested": "Đang kết nối lại thiết bị theo yêu cầu.",
        "device.reconnect_retry": "Đang thử kết nối lại thiết bị...",
        "device.detected": "Phát hiện thiết bị Android: {serial}",
        "device.summary": (
            "Thiết bị: {model} · Android {android} · {abi} · {root_status}"
        ),
        "device.disconnected": (
            "Đã ngắt kết nối thiết bị. Đang chờ cắm lại cáp USB..."
        ),
        "device.reconnecting": "Đang kết nối lại thiết bị.",
        "common.unknown": "Không xác định",
        "common.rooted": "Đã Root",
        "common.not_rooted": "Chưa Root",
        # Proxy daemon
        "proxy.unresponsive_restarting": (
            "Daemon proxy không phản hồi. Đang khởi động lại..."
        ),
        "proxy.binary_missing": "Không tìm thấy nhị phân proxy: {name}",
        "proxy.stopping_old": "Đang dừng daemon proxy cũ...",
        "proxy.syncing": "Đang đồng bộ daemon proxy sang điện thoại...",
        "proxy.start_failed_device": (
            "Daemon proxy không khởi động được trên điện thoại."
        ),
        "proxy.session_ready": "Phiên proxy đã sẵn sàng trên {model}.",
        "proxy.setup_failed": "Không thiết lập được proxy: {error}",
        "proxy.starting": (
            "Đang khởi động daemon proxy trên cổng {port}..."
        ),
        "proxy.running": "Daemon proxy đang chạy (PID {pid}).",
        "proxy.not_running": "Daemon proxy không chạy sau khi khởi động.",
        "proxy.start_failed": "Không khởi động được daemon proxy: {error}",
        "proxy.stopped_after_network_restarting": (
            "Daemon proxy đã dừng sau khi đổi mạng. Đang khởi động lại..."
        ),
        "proxy.restart_failed_rotation": (
            "Không thể khởi động lại daemon proxy sau khi xoay IP."
        ),
        "proxy.restarting": "Đang khởi động lại daemon proxy.",
        "proxy.busy_restart": (
            "Thiết bị đang xử lý thao tác khác. Chưa thể khởi động lại daemon."
        ),
        "proxy.restart_requested": (
            "Đang khởi động lại daemon proxy theo yêu cầu."
        ),
        "proxy.restarted": "Đã khởi động lại daemon proxy.",
        "proxy.restart_failed": "Không khởi động lại được daemon proxy.",
        # Network verification
        "network.device_disconnected": "Thiết bị đã ngắt kết nối.",
        "network.verify_failed": "Không xác minh được IP: {error}",
        "network.unknown_error": "Lỗi không xác định khi kiểm tra IP: {error}",
        "network.public_ip": "IP công khai: {ip} · {isp} · {city}",
        "network.check_failed": "Không kiểm tra được kết nối.",
        # Battery
        "battery.critical": (
            "Cảnh báo nguy hiểm: Nhiệt độ pin {temp}°C vượt ngưỡng 45°C! "
            "Đang ngắt sạc bảo vệ."
        ),
        "battery.warning": (
            "Cảnh báo: Nhiệt độ pin tăng cao ({temp}°C > 40°C). Hãy chú ý vị "
            "trí đặt máy thoáng mát."
        ),
        "battery.charging_on": "Bật lại sạc pin",
        "battery.charging_off": "Ngắt sạc pin tạm thời",
        "battery.charging_action": "{action} cho thiết bị ({serial}).",
        # IP rotation
        "rotation.idle": "Chưa xoay IP trong phiên này.",
        "rotation.preparing": "Đang chuẩn bị xoay IP...",
        "rotation.trigger_auto": "tự động",
        "rotation.trigger_api": "qua API",
        "rotation.trigger_manual": "thủ công",
        "rotation.started": "Bắt đầu xoay IP ({trigger}).",
        "rotation.start_failed_detail": (
            "Không bắt đầu được tiến trình xoay: {error}"
        ),
        "rotation.airplane_on": "Bật chế độ máy bay...",
        "rotation.data_off": "Tắt dữ liệu di động...",
        "rotation.airplane_off": (
            "Tắt chế độ máy bay, chờ mạng 4G..."
        ),
        "rotation.data_on": (
            "Bật lại dữ liệu di động, chờ mạng 4G..."
        ),
        "rotation.waiting": "Đang chờ nhà mạng cấp IP mới...",
        "rotation.verifying": "Đang xác minh IP công khai...",
        "rotation.no_ip": "Không lấy được IP sau khi xoay.",
        "rotation.retry_verify": (
            "Chưa xác minh được IP ({error}). Thử lại lần "
            "{attempt}/{attempts}."
        ),
        "rotation.same_ip_retry": (
            "Nhà mạng cấp lại cùng IP cũ. Đang thử xoay lại..."
        ),
        "rotation.success": "Đã xoay IP thành công: {ip}",
        "rotation.unchanged": "IP sau khi xoay vẫn là {ip}",
        "rotation.success_log": (
            "Xoay IP thành công: {old_ip} → {ip} · {isp}."
        ),
        "rotation.same_ip_final": (
            "Nhà mạng vẫn cấp IP cũ ({ip}) sau 2 lần thử."
        ),
        "rotation.failed": "Xoay IP thất bại.",
        "rotation.failed_log": "Xoay IP thất bại: {error}",
        # History and settings
        "history.save_failed": "Không lưu được lịch sử xoay IP: {error}",
        "history.cleared": "Đã xóa lịch sử xoay IP.",
        "settings.auto_rotate_enabled": (
            "Đã bật xoay IP tự động mỗi {minutes} phút."
        ),
        "settings.auto_rotate_disabled": "Đã tắt xoay IP tự động.",
        "settings.interval_changed": "Chu kỳ xoay tự động: {minutes} phút.",
        "settings.method_airplane": "chế độ máy bay",
        "settings.method_data": "bật/tắt dữ liệu di động",
        "settings.method_changed": "Phương thức xoay: {method}.",
        "settings.language_changed": "Đã đổi ngôn ngữ sang {language}.",
        "auto_rotate.failed": "Không thể xoay IP tự động: {error}",
        "auto_rotate.schedule_error": "Lỗi lịch xoay tự động: {error}",
        # Data usage and logs
        "usage.reset": "Đã đặt lại thống kê dung lượng data 4G hôm nay.",
        "usage.warning": (
            "Đã sử dụng {percent}% ({used} GB / {limit} GB) dữ liệu 4G trong "
            "ngày."
        ),
        "usage.exceeded": (
            "Đã chạm trần giới hạn dữ liệu 4G trong ngày ({limit} GB)! Chú ý "
            "phát sinh cước."
        ),
        "logs.cleared": "Đã xóa nhật ký hoạt động.",
        # Service errors
        "errors.not_connected": "Chưa có thiết bị Android nào được kết nối.",
        "errors.device_not_detected": "Chưa phát hiện thiết bị Android.",
        "errors.rotating": "Đang xoay IP. Vui lòng chờ hoàn tất.",
        "errors.checking_network": "Đang kiểm tra kết nối.",
        "errors.device_busy": "Thiết bị đang xử lý thao tác khác.",
        "errors.rotation_running": "Đang có một lần xoay IP khác chạy.",
        "errors.daemon_not_running": (
            "Daemon proxy chưa chạy. Hãy kết nối lại thiết bị trước khi xoay IP."
        ),
        "errors.rotation_start_failed": (
            "Không bắt đầu được tiến trình xoay IP."
        ),
        "errors.app_stopping": "Ứng dụng đang dừng.",
        "errors.device_connecting": "Thiết bị đang được kết nối.",
        # CLI console
        "cli.banner.dashboard": "Dashboard",
        "cli.banner.proxy": "Proxy HTTP",
        "cli.banner.data": "Dữ liệu",
        "cli.banner.commands": "Lệnh: r = xoay IP · c = kiểm tra kết nối · q = thoát",
        "cli.rotate.started": "[*] Đã bắt đầu xoay IP. Theo dõi tiến trình trên dashboard.",
        "cli.check.updated": "[OK] Đã cập nhật trạng thái kết nối.",
        "cli.command.invalid": "[!] Lệnh không hợp lệ. Gõ h để xem trợ giúp.",
        "cli.server_error": "[X] Không mở được dashboard tại {host}:{port}: {error}\n    Kiểm tra cổng đã bị chiếm hay chưa rồi thử lại.",
        "cli.headless": "[*] Chế độ headless. Nhấn Ctrl+C để dừng.",
        "cli.stopping": "\n[*] Đang dừng ứng dụng...",
        "cli.stopped": "[OK] Đã dừng.",
    },
}


def get_message(key: str, lang: str = DEFAULT_LANGUAGE, **kwargs: Any) -> str:
    """Return the localized message for ``key``.

    Unknown languages fall back to English. Unknown keys are returned verbatim
    so a missing catalog entry can never crash an operation. Keyword arguments
    are interpolated into ``{placeholder}`` slots; a mismatch leaves the
    template untouched.
    """

    catalog = MESSAGES.get(lang) or MESSAGES[DEFAULT_LANGUAGE]
    template = catalog.get(key)
    if template is None:
        template = MESSAGES[DEFAULT_LANGUAGE].get(key, key)
    if not kwargs:
        return template
    try:
        return template.format(**kwargs)
    except (KeyError, IndexError, ValueError):
        return template
