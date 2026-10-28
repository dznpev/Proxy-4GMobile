# 4G Mobile Proxy · Dashboard quản lý

Biến điện thoại Android 4G thành proxy HTTP trên máy tính qua ADB — **không cài APK, không cần root**. Phiên bản 2.0 bổ sung dashboard cục bộ để theo dõi thiết bị, xoay IP, xem lịch sử và cấu hình lịch tự động.

```text
Điện thoại Android ──USB/ADB──► daemon mini_proxy ──► 127.0.0.1:8080
                                              │
Máy tính ──► Dashboard + JSON API ────────────┘  127.0.0.1:8081
```

## Tính năng

- **Zero-app**: đẩy daemon Go có sẵn trong `backend/bin/` tới `/data/local/tmp/mini_proxy`, không cài ứng dụng lên điện thoại.
- **Dashboard 5 trang**: Tổng quan, Thiết bị, Lịch sử IP, Nhật ký, Cài đặt.
- **Xoay IP thủ công hoặc tự động** theo chu kỳ 5–1440 phút, hỗ trợ chế độ máy bay hoặc bật/tắt dữ liệu di động.
- **Theo dõi trực tiếp** IP công khai, nhà mạng, vị trí, độ trễ và tiến trình xoay theo từng bước.
- **Lịch sử + nhật ký cục bộ** lưu trong thư mục `data/` (đã gitignore), tối đa 100 lần xoay và 500 dòng nhật ký.
- **Tương thích API cũ**: giữ nguyên `GET /status` và `GET /rotate` cho tool automation hiện có.
- **Chế độ demo**: xem và kiểm thử toàn bộ giao diện mà không cần điện thoại.

## Yêu cầu

- Windows, macOS hoặc Linux; Python **3.11+**.
- Android Platform Tools (`adb`) có trong `PATH`.
- Điện thoại Android đã bật **Gỡ lỗi USB** và ủy quyền cho máy tính.
- Gói Python trong `requirements.txt` (`requests`).
- Node.js **20+** và npm khi cần phát triển hoặc build giao diện.

Cài đặt:

```bash
python -m pip install -r requirements.txt
```

Kiểm tra ADB:

```bash
adb devices
# phải thấy trạng thái "device", không phải "unauthorized"
```

## Chạy ứng dụng

```bash
python auto_mobile_proxy.py
```

Mở dashboard tại **http://127.0.0.1:8081** (hoặc thêm `--open` để tự mở trình duyệt). Proxy HTTP nằm tại **http://127.0.0.1:8080**.

Dashboard phục vụ bản build tĩnh trong `frontend/dist`. Sau khi clone repo, build giao diện một lần:

```bash
cd frontend
npm install
npm run build
cd ..
```

Sau đó chạy backend như trên.

### Chế độ demo

Không cần điện thoại, dùng dữ liệu mô phỏng để xem giao diện:

```bash
python auto_mobile_proxy.py --demo --open
```

### Tùy chọn dòng lệnh

| Tùy chọn | Mặc định | Mô tả |
| --- | --- | --- |
| `--demo` | tắt | Mô phỏng thiết bị, IP và tiến trình xoay. |
| `--proxy-port` | `8080` | Cổng proxy HTTP trên máy tính. |
| `--control-port` | `8081` | Cổng dashboard và API. |
| `--host` | `127.0.0.1` | Địa chỉ bind dashboard. Chỉ đổi khi hiểu rủi ro bảo mật. |
| `--adb` | `adb` | Đường dẫn tới lệnh ADB. |
| `--data-dir` | `data/` | Nơi lưu `settings.json` và `history.json`. |
| `--headless` | tắt | Không đọc lệnh từ bàn phím. |
| `--open` | tắt | Tự mở dashboard trong trình duyệt. |
| `--version` | — | In phiên bản. |

Có thể cấu hình bằng biến môi trường: `PROXY_HTTP_PORT`, `PROXY_CONTROL_PORT`, `PROXY_CONTROL_HOST`, `PROXY_DATA_DIR`, `PROXY_ADB`.

### Lệnh console

Khi chạy tương tác, nhập:

- `r` — bắt đầu xoay IP.
- `c` — kiểm tra lại kết nối/IP.
- `q` — thoát và dọn daemon trên điện thoại.

## Dashboard

| Trang | Nội dung |
| --- | --- |
| **Tổng quan** | Trạng thái phiên, IP hiện tại, tiến trình xoay, thống kê, lịch sử gần đây, nhật ký gần đây. |
| **Thiết bị** | Serial, model, Android, kiến trúc, ADB, daemon, forward cổng; kết nối lại và khởi động lại daemon. |
| **Lịch sử IP** | Bảng đầy đủ các lần xoay, lọc thành công/thất bại, xóa lịch sử. |
| **Nhật ký** | 500 dòng gần nhất, lọc theo mức độ, tìm kiếm, tự cuộn, xóa nhật ký. |
| **Cài đặt** | Bật/tắt tự động, chu kỳ phút, phương thức xoay, thông tin API và thư mục dữ liệu. |

Giao diện dùng React 19 + TypeScript + Vite 7, giữ hash routing (`#/overview`, `#/device`, ...). Font **Be Vietnam Pro** được tự lưu trong `frontend/public/assets/fonts/` (kèm `OFL.txt`).

### Phát triển giao diện

Chạy backend ở một cửa sổ:

```bash
python auto_mobile_proxy.py --demo
```

Chạy Vite ở cửa sổ khác:

```bash
cd frontend
npm install
npm run dev
```

Mở **http://127.0.0.1:5173**; Vite proxy các request `/api`, `/status`, `/rotate` sang backend `127.0.0.1:8081`. Kiểm tra kiểu và build production bằng `npm run typecheck` / `npm run build`.

## API cục bộ

Dashboard và API chỉ lắng nghe trên loopback và **không có xác thực**. Không mở cổng này ra Internet.

| Phương thức | Đường dẫn | Mô tả |
| --- | --- | --- |
| `GET` | `/api/status` | Toàn bộ trạng thái dashboard. |
| `GET` | `/api/logs?after=<id>&limit=<n>` | Nhật ký tăng dần. |
| `GET` | `/api/history` | Lịch sử xoay và thống kê. |
| `GET` | `/api/settings` | Cài đặt hiện tại và tùy chọn hợp lệ. |
| `POST` | `/api/rotate` | Bắt đầu xoay IP, trả `202` ngay. |
| `POST` | `/api/check` | Kiểm tra lại IP qua proxy. |
| `POST` | `/api/settings` | Cập nhật cài đặt. |
| `POST` | `/api/history/clear` | Xóa lịch sử. |
| `POST` | `/api/logs/clear` | Xóa nhật ký. |
| `POST` | `/api/device/reconnect` | Kết nối lại thiết bị. |
| `POST` | `/api/proxy/restart` | Khởi động lại daemon proxy. |
| `GET` | `/api/health` | Kiểm tra nhanh dịch vụ. |

Ví dụ:

```bash
curl http://127.0.0.1:8081/api/status
curl -X POST http://127.0.0.1:8081/api/rotate
curl -x http://127.0.0.1:8080 https://api.ipify.org
```

### API tương thích

```bash
# Trạng thái kết nối và IP hiện tại
curl http://127.0.0.1:8081/status
# {"connected": true, "ip": "113.161.52.18"}

# Xoay IP và chờ kết quả (dành cho tool automation cũ)
curl http://127.0.0.1:8081/rotate
# {"status": "success", "ip": "14.187.144.203"}
```

`GET /rotate` chờ tối đa 120 giây và trả `500` nếu xoay thất bại.

## Cài đặt và dữ liệu

- `data/settings.json`: `auto_rotate_enabled`, `auto_rotate_interval_min` (5–1440), `rotate_method` (`airplane` hoặc `data`).
- `data/history.json`: tối đa 100 bản ghi, mới nhất trước.
- Lịch tự động chỉ chạy khi thiết bị đang kết nối; sau mỗi lần xoay, lần tiếp theo được tính lại theo chu kỳ.

Có thể đổi thư mục dữ liệu bằng `--data-dir` hoặc `PROXY_DATA_DIR`. Thư mục `data/` mặc định đã nằm trong `.gitignore`.

## Cấu trúc dự án

```text
auto_mobile_proxy.py       # CLI + vòng đời ứng dụng
backend/
  __init__.py
  mobile_proxy/
    config.py              # cấu hình, đường dẫn (frontend/dist)
    events.py              # nhật ký có giới hạn
    adb.py                 # wrapper ADB
    network.py             # kiểm tra IP qua proxy
    storage.py             # lưu cài đặt/lịch sử
    demo.py                # backend mô phỏng
    service.py             # thiết bị, xoay IP, lịch tự động
    server.py              # HTTP server, API, static, CSP
  bin/                     # daemon proxy ARM32/ARM64
  proxy_daemon/main.go     # mã nguồn daemon Go
  tests/                   # unittest cho storage, service, HTTP API
frontend/
  index.html               # entry của Vite
  src/main.tsx             # bootstrap React
  src/app/                 # router, shell, providers, hooks
  src/components/          # layout và component dùng chung
  src/pages/               # 5 trang dashboard
  src/api/                 # client + kiểu dữ liệu API
  src/lib/                 # hằng số, format, trạng thái
  src/styles/              # token/base/layout/component/responsive
  public/assets/fonts/     # Be Vietnam Pro + OFL
  dist/                    # build output (đã gitignore)
docs/DASHBOARD-DESIGN.md   # đặc tả thiết kế dashboard
```

## Kiểm thử

```bash
python -m unittest discover -s backend/tests -v
```

Bộ test dùng backend demo, không cần điện thoại hay mạng ngoài. Kiểm tra thêm cú pháp và bản build giao diện:

```bash
python -m compileall -q auto_mobile_proxy.py backend
cd frontend
npm run typecheck
npm run build
```

## Xử lý sự cố

- **`unauthorized`**: mở khóa điện thoại, chấp nhận hộp thoại “Luôn cho phép từ máy tính này”.
- **Không tìm thấy ADB**: cài Android Platform Tools và thêm thư mục chứa `adb` vào `PATH`.
- **Daemon không chạy**: vào **Thiết bị** → **Khởi động lại daemon**; nếu vẫn lỗi, bấm **Kết nối lại**.
- **Không có Internet**: kiểm tra Wi-Fi đã tắt, còn sóng/dung lượng 4G và chế độ máy bay đã tắt sau khi xoay.
- **Cổng bận**: đổi cổng bằng `--proxy-port` / `--control-port` hoặc dừng tiến trình đang chiếm cổng.

## Bảo mật

- Dashboard điều khiển thiết bị **không có đăng nhập**. Mặc định chỉ bind `127.0.0.1`.
- Nếu dùng `--host 0.0.0.0`, chỉ làm trong mạng tin cậy và tự bổ sung lớp xác thực/reverse proxy.
- Server gửi CSP chặn script/style inline, `X-Frame-Options: DENY`, `nosniff` và các header giảm thiểu rủi ro khác.
- Không commit thư mục `data/` vì có thể chứa lịch sử IP và cấu hình cá nhân.
