# Auto 4G Mobile Proxy qua ADB (Zero App - Không cần cài App trên điện thoại)

Giải pháp biến điện thoại Android 4G thành Proxy di động chất lượng cao **hoàn toàn tự động** khi cắm cáp USB vào máy tính mà **không cần cài đặt bất kỳ ứng dụng nào từ Google Play Store hay file APK lên điện thoại**.

---

## 1. Cơ chế hoạt động (Zero-App Architecture)

* **Không cần Root, không cần cài app**: Tương tự như cách `scrcpy` hoạt động, khi máy tính nhận diện điện thoại qua ADB, tool sẽ tự động nạp một tiến trình daemon proxy tĩnh siêu nhẹ (được biên dịch sẵn bằng Go) vào thư mục tạm `/data/local/tmp/mini_proxy` trên Android và chạy ngầm.
* **Tự động forward port**: Ánh xạ cổng `8080` qua cáp USB.
* **Cung cấp Web API xoay IP**: Khi cần đổi IP mới, tool tự động toggle chế độ máy bay (Airplane mode) qua ADB mà không cần chạm vào điện thoại.

---

## 2. Chuẩn bị (Chỉ cần làm 1 lần trên điện thoại)

1. Cắm cáp USB nối điện thoại với máy tính.
2. Bật **Gỡ lỗi USB (USB Debugging)**:
   * Vào `Cài đặt` $\rightarrow$ `Thông tin điện thoại` $\rightarrow$ Chạm 7 lần vào `Số bản dựng (Build number)`.
   * Vào `Cài đặt` $\rightarrow$ `Tùy chọn cho nhà phát triển` $\rightarrow$ Bật `Gỡ lỗi USB (USB Debugging)`.
   * Khi màn hình hiện thông báo hỏi ủy quyền, chọn **"Luôn cho phép từ máy tính này"**.

---

## 3. Cách sử dụng

Mở terminal chạy lệnh:
```bash
python auto_mobile_proxy.py
```

* **Khi cắm cáp USB**: Tool tự động phát hiện, đẩy daemon proxy sang điện thoại, kết nối và in ra IP 4G Public + nhà mạng.
* **Địa chỉ Proxy**: `http://127.0.0.1:8080` (Dùng cho trình duyệt, curl, Python requests, automation tool...).
* **Khi rút cáp USB**: Tool tự động trở về chế độ chờ, không bị văng lỗi.

---

## 4. Xoay IP (Rotate IP)

1. **Console**: Nhập phím `r` và bấm Enter.
2. **API (Dành cho tool cào/MMO)**:
   * Gọi HTTP GET: `http://127.0.0.1:8081/rotate`
   * Phản hồi mẫu:
     ```json
     {"status": "success", "ip": "113.185.45.12"}
     ```
