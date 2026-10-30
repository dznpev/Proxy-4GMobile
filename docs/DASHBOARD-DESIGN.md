# Đặc tả thiết kế dashboard 4G Mobile Proxy

## 1. Bối cảnh và mục tiêu

**Ý định thiết kế:** một bảng điều khiển kỹ thuật, token-driven, ưu tiên nội dung, giúp người vận hành proxy 4G nhận ra trạng thái thiết bị trong vài giây và thực hiện xoay IP an toàn bằng bàn phím hoặc chuột.

- Đối tượng: kỹ sư vận hành, developer automation, người dùng MMO cần theo dõi IP.
- Bề mặt: dashboard cục bộ (không phải trang marketing), chạy ở `127.0.0.1:8081`.
- Mục tiêu:
  - Trạng thái thiết bị, proxy và IP phải rõ ràng ở cấp độ đầu tiên.
  - Mọi thao tác nguy hiểm (xóa dữ liệu, khởi động lại daemon) phải có xác nhận.
  - Đạt WCAG 2.2 AA, ưu tiên bàn phím, không phụ thuộc màu sắc đơn thuần.
  - Frontend React 19 + TypeScript, build bằng Vite; font và asset tự lưu, CSP không cho inline script/style.
- Nguồn yêu cầu: `DESIGN.md` tại thư mục gốc.
- Triển khai: `frontend/src/` (React), CSS trong `frontend/src/styles/`, backend phục vụ `frontend/dist`.

## 2. Token và nền tảng thiết kế

### 2.1 Typography

| Token | Giá trị | Dùng cho |
| --- | --- | --- |
| `font.family.primary` | Be Vietnam Pro | Toàn bộ giao diện |
| `font.family.stack` | Be Vietnam Pro, Inter, -apple-system, BlinkMacSystemFont, sans-serif | Fallback |
| `font.size.xs` | 10px | Eyebrow, nhãn log, metadata nhỏ |
| `font.size.sm` | 11px | Gợi ý, mô tả phụ |
| `font.size.md` | 12px | Nội dung mặc định, bảng |
| `font.size.lg` | 13px | Base body (theo DESIGN.md) |
| `font.size.xl` | 14px | Tiêu đề card, trạng thái xoay |
| `font.size.2xl` | 16px | Tiêu đề phụ, dialog |
| `font.size.3xl` | 30px | Tiêu đề trang |
| `font.weight.base` | 400 | Body |
| `lineHeight.base` | 19.5px | Body |

Quy tắc:

- Base body **must** dùng 13px / 19.5px; chỉ dùng 12px cho vùng dữ liệu dày đặc như bảng và mô tả phụ.
- Tiêu đề trang **must** dùng 30px, weight 600, line-height 1.15.
- Không dùng font weight dưới 400 cho nội dung; nhãn nhỏ dùng 500–600.
- Monospace **must** dùng cho IP, serial, URL, lệnh và log.

### 2.2 Màu sắc

| Token | Giá trị | Dùng cho |
| --- | --- | --- |
| `color.text.primary` | `#18181b` | Tiêu đề, dữ liệu chính |
| `color.text.secondary` | `#52525b` | Nội dung phụ |
| `color.text.tertiary` | `#8a8a93` | Metadata, placeholder |
| `color.surface.muted` | `#ffffff` | Card |
| `color.surface.base` | `#000000` | Sidebar, log console |
| `color.surface.raised` | `#fafafa` | Vùng nhấn nhẹ, code block |
| `color.border.default` | `#e5e7eb` | Viền card, bảng |
| `color.border.strong` | `#e4e4e7` | Viền button secondary |

Màu ngữ nghĩa (semantic) cho trạng thái:

- Success: nền/viền/chữ lấy từ token `success-*`; dùng cho “Đang hoạt động”, “Thành công”, “Bật”.
- Warning: dùng cho thiết bị chưa kết nối, daemon dừng, cảnh báo có thể xử lý.
- Danger: dùng cho lỗi thiết bị, xoay thất bại, hành động xóa.
- Info: dùng cho tiến trình đang chạy và trạng thái trung tính có thông tin.

Quy tắc:

- Màu **must** đi kèm nhãn hoặc icon; không truyền đạt trạng thái chỉ bằng màu.
- Chữ trên nền sáng **must** đạt tương phản tối thiểu 4.5:1; chữ lớn đạt 3:1.
- Không dùng raw hex trong component mới; khai báo biến semantic trong `:root` trước.

### 2.3 Spacing, radius, shadow, motion

- Spacing **must** lấy từ thang `--space-1` … `--space-14`; các giá trị 12px trở lên là phần mở rộng có chủ đích cho layout, không dùng làm ngoại lệ component.
- Radius: `7px` (xs), `8px` (sm), `9px` (md), `10px` (lg), `12px` (xl), `9999px` (pill).
- Shadow: chỉ dùng `--shadow-1` cho card và `--shadow-overlay` cho overlay/dialog/toast.
- Motion: 150ms (instant) cho hover/active; 200ms (fast) cho drawer, dialog, toast. Tôn trọng `prefers-reduced-motion`: tắt spin/animation không cần thiết.

### 2.4 Layout

- Sidebar desktop: 240px; main content tối đa 1120px, căn giữa.
- Topbar cao 62px, sticky; nội dung cuộn bên dưới.
- Breakpoints: 1280px (grid co), 1120px (hero/split một cột), 1024px (sidebar thành drawer), 800px (form một cột), 640px (bảng gọn, hiện status pill), 520px (action topbar thu vào popover, stat một cột).
- Touch target **must** tối thiểu 24×24 CSS px; nav mobile và button chính nên đạt 44px chiều cao.

## 3. Quy tắc component

### 3.1 App shell và sidebar

**Cấu trúc:** brand → nav “Không gian làm việc” → trạng thái dịch vụ + phiên bản.

- Variants: desktop cố định; mobile drawer có scrim.
- States:
  - Default: nav item chữ trắng mờ trên nền đen.
  - Hover: nền trắng 8–10%, chữ sáng hơn.
  - Focus-visible: outline 2px màu focus ring, offset 2px.
  - Active/current: nền trắng 10%, chữ trắng, vạch accent bên trái.
  - Disabled: không áp dụng cho nav.
- Keyboard:
  - `Tab` đi qua brand, từng nav item, nút đóng (mobile).
  - `Enter`/`Space` kích hoạt link.
  - `Escape` đóng drawer và trả focus về nút mở.
  - Focus **must** bị giữ trong drawer khi mở; phần ngoài drawer dùng `inert`.
- Pointer/touch: chạm nav đóng drawer; chạm scrim đóng drawer.
- Responsive: dưới 1024px drawer trượt từ trái; nav item cao 44px.
- Edge case: tiêu đề dài **must** wrap hoặc ellipsis có `title`; không đẩy vỡ sidebar.

### 3.2 Topbar

- Anatomy: nút menu (mobile) → eyebrow + tiêu đề trang → status pill → Làm mới → Xoay IP.
- States: status pill có neutral/success/warning/danger/info; button có hover/focus/active/disabled/loading.
- Keyboard: thứ tự tab theo DOM; `aria-label` cho button icon; `aria-expanded` cho menu.
- Responsive: label “Làm mới”/“Xoay IP” **must** luôn hiển thị ở nơi người dùng bấm; dưới 640px ẩn status pill để nhường chỗ (trạng thái vẫn còn trong sidebar/session card); dưới 520px, hai action thu vào popover “Thao tác nhanh” (trigger 44×44, mỗi action là button full-width có icon + label, lý do không khả dụng hiển thị ngay dưới). Popover đóng bằng Escape/chạm ngoài/chọn action, trả focus về trigger.
- Loading: icon refresh quay; button có `aria-busy="true"` và bị disable trong lúc gửi.

### 3.3 Card

- Anatomy: eyebrow (tuỳ chọn) → tiêu đề → nội dung → footer.
- Variants: card thường, card phẳng (`card-flush`) cho log, card trạng thái, card xoay IP.
- States: default; hover không bắt buộc (card không phải button); focus chỉ áp dụng cho phần tử bên trong.
- Spacing: padding 20px desktop, 16px mobile; card-head margin-bottom 16px; footer border-top 1px.
- Nội dung dài **must** wrap (`overflow-wrap: anywhere` cho URL/IP); card **must** có `min-width: 0` trong grid.
- Empty state: dùng `.empty-state` hoặc `.empty-inline`, có tiêu đề + mô tả + hành động nếu phù hợp.

### 3.4 Button

- Variants: primary (accent), secondary (viền), ghost, danger, icon-button.
- States **must** có: default, hover, focus-visible, active, disabled, loading.
- Keyboard: `Enter`/`Space`; focus ring 2px, offset 2px; không bỏ outline.
- Loading: disable để tránh gửi lặp; icon quay hoặc spinner; giữ nguyên nhãn.
- Touch: min-height 36px desktop, 44px cho hành động chính trên mobile.
- Không dùng button chỉ có icon mà thiếu `aria-label`/`title`.

### 3.5 Badge và status

- Badge: pill nhỏ 22px, icon 12px + nhãn.
- Status pill: 28px, dot 6px + nhãn.
- Tone: neutral, success, warning, danger, info.
- Quy tắc: nhãn **must** mô tả trạng thái cụ thể (“Daemon đã dừng”), không chỉ “Lỗi”.
- Live update: status pill và trạng thái xoay dùng `role="status"`/`aria-live="polite"`; chỉ cập nhật text khi giá trị thay đổi để tránh đọc lặp.

### 3.6 Switch

- Anatomy: label + mô tả + track/thumb; input checkbox thật, ẩn trực quan nhưng vẫn focus được.
- States: off, on, hover, focus-visible, disabled, loading (disable trong lúc gửi).
- Keyboard: `Space` toggle; label bấm được; accessible name lấy từ label/`aria-labelledby`.
- Touch: toàn bộ hàng label có thể bấm; track tối thiểu 36×20px.
- Không tự đổi trạng thái nếu server từ chối; phải rollback và thông báo.

### 3.7 Bảng dữ liệu

- Anatomy: caption ẩn, header `th scope="col"`, body, empty state.
- States: row hover nhẹ; không có row selected.
- Responsive: `.table-wrap` cuộn ngang; trên mobile ẩn cột nhà mạng ở bảng “Lần xoay gần đây”; bảng lịch sử đầy đủ giữ cuộn ngang.
- Nội dung dài: IP/serial dùng monospace; cell **must** wrap hoặc cuộn, không làm vỡ layout.
- Empty: thông điệp + hành động “Xoay IP ngay” khi chưa có dữ liệu; khi lọc rỗng thì ẩn hành động xoay.

### 3.8 Log console

- Anatomy: danh sách `ol` → thời gian, level, message; nền đen, chữ sáng.
- Levels: debug/info/success/warning/error có màu riêng, kèm nhãn chữ.
- States: empty, filtered-empty, auto-scroll on/off.
- Keyboard: filter và search là input chuẩn; checkbox “Tự cuộn” focus được.
- Responsive: cột thời gian/level co lại; message wrap (`overflow-wrap: anywhere`).
- Hiệu năng: giới hạn 500 dòng; chỉ render lại khi có dữ liệu/filter thay đổi.

### 3.9 Form field

- Anatomy: label → input/select → help text → error text.
- States: default, hover, focus-visible, invalid (`aria-invalid="true"` + viền danger), disabled.
- Keyboard: label liên kết bằng `for`; lỗi được công bố qua `role="alert"`; focus chuyển về field lỗi khi submit.
- Validation: chu kỳ **must** là số nguyên 2–1440; thông báo lỗi bằng tiếng Việt, nêu cách sửa.
- Không dùng placeholder thay cho label.

### 3.10 Banner, toast, dialog

**Banner**

- Vị trí đầu main; variants danger/warning/info.
- `role="alert"` cho lỗi dịch vụ; `role="status"` cho cảnh báo thiết bị.
- Có hành động retry/link rõ ràng; không tự biến mất khi lỗi còn tồn tại.

**Toast**

- Góc dưới phải; tối đa 4 toast; tự đóng sau 6–8 giây, hover tạm dừng.
- Tone success/warning/error/info; error dùng `role="alert"`, còn lại `role="status"`.
- Có nút đóng với `aria-label`; nội dung không chứa HTML từ server.

**Dialog xác nhận**

- Dùng `<dialog>` native; tiêu đề + mô tả + Hủy/Xác nhận.
- Focus mặc định vào **Hủy** với hành động nguy hiểm; `Escape` đóng và trả `false`.
- Click ngoài không đóng (tránh mất ngữ cảnh); không dùng dialog cho thông báo không cần quyết định.

## 4. Accessibility và tiêu chí nghiệm thu

Mục tiêu: **WCAG 2.2 AA**.

Các tiêu chí kiểm thử được:

1. **Bàn phím**: mọi chức năng truy cập được bằng `Tab`, `Shift+Tab`, `Enter`, `Space`, `Escape`; không có bẫy focus ngoài drawer.
2. **Focus visible**: mọi phần tử tương tác có outline rõ, tối thiểu 2px, offset 2px; kiểm tra bằng phím Tab, không dùng chuột.
3. **Tên truy cập**: button icon có `aria-label`; input có label; checkbox switch có `aria-labelledby`; link có text mô tả đích.
4. **Tương phản**: text thường ≥ 4.5:1; text lớn ≥ 3:1; trạng thái disabled vẫn đọc được nhưng không cần tương phản như text thường.
5. **Không chỉ dùng màu**: badge/status có nhãn chữ; log level có nhãn chữ; lỗi form có text.
6. **Live region**: trạng thái dịch vụ, trạng thái xoay, toast, lỗi form được công bố; không cập nhật live region mỗi 2,5 giây nếu nội dung không đổi.
7. **Target size**: target tối thiểu 24×24; khuyến nghị 44×44 cho nav mobile và action chính.
8. **Zoom/reflow**: 200% zoom không mất nội dung; 320px width không cuộn ngang toàn trang (bảng được cuộn trong container).
9. **Reduced motion**: `prefers-reduced-motion: reduce` tắt animation spin/toast/dialog không thiết yếu.
10. **Ngôn ngữ**: `<html lang="vi">`; thông báo lỗi và nhãn bằng tiếng Việt nhất quán.
11. **Dialog**: có `aria-labelledby`, `aria-describedby`; focus được quản lý; đóng bằng `Escape`.
12. **Bảng**: có caption (ẩn), `th` có `scope`; dữ liệu đọc theo hàng/cột rõ ràng.

## 5. Nội dung và giọng điệu

- Ngắn, chủ động, tập trung vào hành động và trạng thái.
- Dùng thuật ngữ nhất quán: “thiết bị”, “daemon proxy”, “xoay IP”, “nhà mạng”, “phiên”.
- Không dùng từ mơ hồ: “Có lỗi” → “Daemon proxy đã dừng”; “Thất bại” → “Không xác minh được IP sau khi xoay”.
- Ví dụ nhãn tốt:
  - “Proxy đang chạy”, “Daemon proxy đã dừng”, “Thiết bị chưa ủy quyền”.
  - “Xoay IP ngay”, “Kiểm tra lại”, “Khởi động lại daemon”.
  - “Đã lưu lúc 14:32:10”, “Chưa lưu thay đổi”.
- Ví dụ tránh:
  - “OK”, “Lỗi”, “Thực hiện”, “Bấm vào đây”.
  - Câu đùa hoặc viết tắt không cần thiết trong thông báo lỗi.

## 6. Anti-pattern và điều cấm

- **Cấm** dùng inline style hoặc inline script: CSP hiện tại chặn; mọi style phải nằm trong các file CSS tại `frontend/src/styles/`.
- **Cấm** thêm màu hex trực tiếp trong component; phải định nghĩa token semantic.
- **Cấm** bỏ `:focus-visible` hoặc dùng `outline: none` mà không thay thế.
- **Cấm** dùng `div` giả button/link; dùng đúng phần tử ngữ nghĩa.
- **Cấm** thông báo trạng thái chỉ bằng chấm màu.
- **Cấm** tự động xoay IP khi chưa có thiết bị hoặc daemon; phải disable kèm lý do.
- **Cấm** xóa lịch sử/nhật ký mà không xác nhận.
- **Cấm** hiển thị HTML/chuỗi từ API bằng `innerHTML`; dùng `textContent`.
- **Cấm** dùng font/asset từ CDN khi CSP chỉ cho `'self'`.
- **Cấm** tạo layout mobile bằng cách ẩn nội dung quan trọng không có phương án thay thế.

## 7. Checklist QA

### Hiển thị

- [ ] 5 trang hiển thị đúng tiêu đề, eyebrow, `document.title`, nav active.
- [ ] Không có cuộn ngang toàn trang ở 320px, 390px, 768px, 1024px, 1440px.
- [ ] Bảng cuộn trong `.table-wrap`; cột nhà mạng ẩn đúng ở bảng gần đây trên mobile.
- [ ] Empty state hiển thị cho lịch sử trống, lọc rỗng, nhật ký trống, lọc log rỗng.
- [ ] Toast không che action chính quá lâu; có nút đóng.

### Tương tác

- [ ] Xoay IP thành công cập nhật IP, tiến trình, lịch sử, thống kê và toast.
- [ ] Xoay IP thất bại hiển thị lỗi, giữ dữ liệu cũ và không treo button.
- [ ] Bật/tắt tự động cập nhật badge, thời điểm tiếp theo và rollback khi lỗi.
- [ ] Lưu cài đặt hợp lệ; chặn chu kỳ ngoài 2–1440; hiển thị lỗi cạnh field.
- [ ] Kết nối lại thiết bị và khởi động lại daemon có phản hồi trạng thái.
- [ ] Xóa lịch sử/nhật ký mở dialog, Hủy không thay đổi dữ liệu.
- [ ] Copy địa chỉ proxy và lệnh curl hoạt động, có toast xác nhận.
- [ ] Làm mới thủ công không tạo request chồng lấp; polling vẫn tiếp tục.

### Bàn phím và screen reader

- [ ] Tab qua toàn bộ nav, topbar, card action, form, bảng, log filter.
- [ ] Focus ring hiển thị trên nền sáng, nền tối và trong dialog.
- [ ] `Escape` đóng drawer/dialog; focus trở về phần tử mở.
- [ ] Drawer mobile dùng `inert` khi đóng; không tab được vào nav ẩn.
- [ ] Switch có tên đọc được; checkbox “Tự cuộn” đọc được.
- [ ] Status pill, trạng thái xoay, toast, lỗi form được công bố qua live region.

### Kỹ thuật

- [ ] `python -m unittest discover -s backend/tests -v` pass.
- [ ] `npm run typecheck` và `npm run build` trong `frontend/` pass.
- [ ] `python -m compileall -q auto_mobile_proxy.py backend` pass.
- [ ] Lighthouse Accessibility = 100; không có lỗi label/name mismatch.
- [ ] CSP không có `unsafe-inline`; không tải asset ngoài `'self'`.
- [ ] `prefers-reduced-motion` tắt animation; không có layout shift lớn khi polling.

## 8. Ghi chú triển khai

- Component dùng token trong `frontend/src/styles/tokens.css`; CSS chia theo `base`, `layout`, `controls`, `cards`, `data`, `forms`, `overlays`, `responsive` và import từ `index.css`.
- Shell, sidebar, topbar và các control/overlay chính dùng Tailwind + primitive trong `frontend/src/components/ui/`; `@layer legacy` chỉ còn các primitive layout/form/log chưa migrate (`.page-lead`, `.grid-*`, `.field`, `.toolbar`, `.log-*`).
- Kiến trúc React: `HashRouter` → `ToastProvider` → `ConfirmProvider` → `DashboardProvider` → `AppShell`; các trang đọc trạng thái chung qua `useDashboard`.
- Logic polling 2,5 giây khi tab hiển thị, 10 giây khi ẩn; request status/logs được dedupe.
- Dữ liệu từ API render qua JSX (React tự escape), không dùng `innerHTML`.
- Trạng thái server là nguồn sự thật; UI chỉ tối ưu hiển thị và rollback khi request thất bại.
- Mật độ component tham chiếu từ `DESIGN.md`: 40 link, 11 button, 8 card, 3 navigation, 1 input, 1 table. Dashboard mở rộng có chủ đích (5 nav item, nhiều card/table hơn) nhưng vẫn giữ cùng token, spacing và quy tắc trạng thái.
