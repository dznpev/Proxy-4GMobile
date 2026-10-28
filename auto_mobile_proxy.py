import os
import subprocess
import time
import threading
import sys
import atexit
import requests
from http.server import HTTPServer, BaseHTTPRequestHandler

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

HTTP_PORT = 8080       # Port Proxy HTTP trên PC (127.0.0.1:8080)
CONTROL_PORT = 8081    # Port web control local (để gọi lệnh xoay IP từ tool khác)

BIN_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bin")
ARM64_BIN = os.path.join(BIN_DIR, "proxy_arm64.bin")
ARM32_BIN = os.path.join(BIN_DIR, "proxy_arm32.bin")
REMOTE_PATH = "/data/local/tmp/mini_proxy"

class DeviceManager:
    def __init__(self):
        self.device_id = None
        self.is_connected = False
        self.current_ip = None
        self.is_cleaned_up = False

    def run_adb(self, cmd: str, timeout: int = 10) -> str:
        prefix = f"adb -s {self.device_id} " if self.device_id else "adb "
        try:
            result = subprocess.run(prefix + cmd, shell=True, capture_output=True, text=True, timeout=timeout)
            return result.stdout.strip()
        except Exception:
            return ""

    def get_connected_devices(self):
        try:
            res = subprocess.run("adb devices", shell=True, capture_output=True, text=True, timeout=5)
            lines = res.stdout.strip().splitlines()[1:]
            devices = []
            for line in lines:
                parts = line.split()
                if len(parts) >= 2:
                    devices.append({"id": parts[0], "status": parts[1]})
            return devices
        except Exception:
            return []

    def get_device_abi(self) -> str:
        abi = self.run_adb("shell getprop ro.product.cpu.abi")
        return abi if abi else "arm64-v8a"

    def setup_proxy(self):
        self.is_cleaned_up = False
        print(f"\n[+] Đang cấu hình Native Proxy (KHÔNG CẦN CÀI APP) cho thiết bị {self.device_id}...")
        
        # 1. Xác định kiến trúc CPU để chọn binary phù hợp
        abi = self.get_device_abi()
        print(f"    -> Kiến trúc CPU của điện thoại: {abi}")
        chosen_bin = ARM64_BIN if "arm64" in abi.lower() else ARM32_BIN
        
        if not os.path.exists(chosen_bin):
            print(f"[X] Không tìm thấy file nhị phân: {chosen_bin}")
            return

        # 2. Dừng tiến trình cũ nếu đang chạy trên điện thoại
        self.run_adb("shell pkill -f mini_proxy")
        time.sleep(0.5)

        # 3. Đẩy binary vào thư mục tạm /data/local/tmp/ trên Android
        print(f"    -> Đang đồng bộ daemon proxy sang Android (/data/local/tmp)...")
        self.run_adb(f"push \"{chosen_bin}\" {REMOTE_PATH}")
        self.run_adb(f"shell chmod 755 {REMOTE_PATH}")

        # 4. Khởi chạy binary ngầm trên Android
        print(f"    -> Đang khởi chạy daemon proxy trên Android (port {HTTP_PORT})...")
        # Dùng nohup với chuyển hướng đầy đủ để không bị block ADB
        self.run_adb(f'shell "nohup {REMOTE_PATH} -port {HTTP_PORT} </dev/null >/dev/null 2>&1 &"')
        time.sleep(1.5)

        # 5. Forward port từ PC -> Android qua cáp USB
        self.run_adb(f"forward tcp:{HTTP_PORT} tcp:{HTTP_PORT}")
        print(f"    -> Đã ánh xạ Port: 127.0.0.1:{HTTP_PORT} -> Android:{HTTP_PORT}")

        # 6. Kiểm tra kết nối Internet 4G
        time.sleep(1)
        self.check_status()

    def check_status(self):
        proxies = {
            "http": f"http://127.0.0.1:{HTTP_PORT}",
            "https": f"http://127.0.0.1:{HTTP_PORT}",
        }
        try:
            res = requests.get("http://ip-api.com/json", proxies=proxies, timeout=6)
            if res.status_code == 200:
                data = res.json()
                if data.get("status") == "success":
                    self.current_ip = data.get("query")
                    isp = data.get("isp", "N/A")
                    city = data.get("city", "N/A")
                    print(f"[OK] 4G PROXY ĐÃ HOẠT ĐỘNG HOÀN TOÀN!")
                    print(f"     * IP Public : {self.current_ip}")
                    print(f"     * Nhà mạng  : {isp} ({city})")
                    print(f"     * Proxy URL : http://127.0.0.1:{HTTP_PORT}")
                    print(f"     * API xoay IP: http://127.0.0.1:{CONTROL_PORT}/rotate")
                    return True
            else:
                print(f"[!] Lỗi HTTP {res.status_code}: {res.text.strip()}")
        except Exception as e:
            print(f"[!] Chưa lấy được IP qua Proxy ({e}). Đang tự động kiểm tra lại daemon...")
            # Kiểm tra xem daemon có đang chạy không, nếu tắt thì bật lại
            check_running = self.run_adb("shell pidof mini_proxy")
            if not check_running:
                print("    -> Khởi động lại mini_proxy daemon...")
                self.run_adb(f'shell "nohup {REMOTE_PATH} -port {HTTP_PORT} </dev/null >/dev/null 2>&1 &"')
        return False

    def rotate_ip(self):
        if not self.is_connected:
            print("[X] Chưa cắm điện thoại, không thể xoay IP!")
            return False

        print("\n[*] Đang xoay IP (Bật/Tắt chế độ máy bay qua ADB)...")
        self.run_adb("shell cmd connectivity airplane-mode enable")
        time.sleep(2.5)
        self.run_adb("shell cmd connectivity airplane-mode disable")
        
        print("[*] Đang chờ 4G cấp IP mới...")
        time.sleep(5)

        # Đảm bảo daemon vẫn sống sau khi bật lại mạng
        check_running = self.run_adb("shell pidof mini_proxy")
        if not check_running:
            self.run_adb(f'shell "nohup {REMOTE_PATH} -port {HTTP_PORT} </dev/null >/dev/null 2>&1 &"')
            time.sleep(1)

        self.check_status()
        return True

    def cleanup(self):
        if self.device_id and not self.is_cleaned_up:
            self.is_cleaned_up = True
            print("\n[*] Đang dọn dẹp và tắt hoàn toàn daemon proxy trên điện thoại...")
            self.run_adb("shell pkill -f mini_proxy")
            self.run_adb(f"forward --remove tcp:{HTTP_PORT}")
            print("[OK] Đã tắt daemon proxy và giải phóng port.")

dev_mgr = DeviceManager()
atexit.register(dev_mgr.cleanup)

class ControlApiHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/rotate":
            success = dev_mgr.rotate_ip()
            self.send_response(200 if success else 500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            status_text = "success" if success else "failed"
            self.wfile.write(f'{{"status": "{status_text}", "ip": "{dev_mgr.current_ip}"}}'.encode("utf-8"))
        elif self.path == "/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(f'{{"connected": {str(dev_mgr.is_connected).lower()}, "ip": "{dev_mgr.current_ip}"}}'.encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        return

def start_api_server():
    server = HTTPServer(("127.0.0.1", CONTROL_PORT), ControlApiHandler)
    server.serve_forever()

def adb_monitor_loop():
    print("=" * 65)
    print("  AUTO 4G MOBILE PROXY (ZERO APP - KHÔNG CẦN CÀI APP ANDROID)")
    print("=" * 65)
    print(f"[*] Đang lắng nghe cắm cáp USB Android qua ADB...")
    print(f"[*] Thao tác nhanh: Gõ 'r' + Enter để xoay IP, 'q' để thoát.")
    print("=" * 65)

    last_status = None
    while True:
        devices = dev_mgr.get_connected_devices()
        active_device = None

        for d in devices:
            if d["status"] == "device":
                active_device = d["id"]
                break
            elif d["status"] == "unauthorized":
                if last_status != "unauthorized":
                    print("\n[!] Thiết bị chưa được ủy quyền! Bấm 'Cho phép gỡ lỗi USB' trên màn hình điện thoại.")
                    last_status = "unauthorized"

        if active_device:
            if not dev_mgr.is_connected or dev_mgr.device_id != active_device:
                dev_mgr.device_id = active_device
                dev_mgr.is_connected = True
                last_status = "connected"
                print(f"\n[+] PHÁT HIỆN ĐIỆN THOẠI: {active_device}")
                dev_mgr.setup_proxy()
        else:
            if dev_mgr.is_connected:
                print(f"\n[-] ĐÃ RÚT CÁP ĐIỆN THOẠI! Đang chờ cắm lại...")
                dev_mgr.is_connected = False
                dev_mgr.device_id = None
                dev_mgr.current_ip = None
                last_status = "disconnected"

        time.sleep(2)

def console_input_loop():
    while True:
        try:
            cmd = input().strip().lower()
            if cmd == "r":
                dev_mgr.rotate_ip()
            elif cmd == "c":
                dev_mgr.check_status()
            elif cmd == "q":
                print("\nDừng chương trình.")
                sys.exit(0)
        except (EOFError, KeyboardInterrupt):
            sys.exit(0)

if __name__ == "__main__":
    threading.Thread(target=start_api_server, daemon=True).start()
    threading.Thread(target=adb_monitor_loop, daemon=True).start()
    console_input_loop()
