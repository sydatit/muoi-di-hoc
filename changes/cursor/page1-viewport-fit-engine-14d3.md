# Thay đổi: Phase 2 — Viewport Metrics Engine + Fit Engine cho Page 1

Triển khai Phase 2 của plan `changes/cursor/plan-page1-responsive-video-14d3.md`.

## Mục tiêu

Bỏ các ngưỡng cứng quyết định "vừa màn hay không", thay bằng đo thật chiều cao nội dung so với chiều cao khả dụng, theo đúng kiến trúc trong tài liệu phân tích: **layout theo width (CSS), fit/scroll theo height + content height (JS)**.

## File thay đổi

- `app.js` — thêm viewport metrics engine + fit engine, xóa `SHORT_VIEWPORT_HEIGHT` và media query `(max-width: 639px)` khỏi logic quyết định
- `styles.css` — thêm nhóm rule `html.p1-unlocked` để mở khoá ngân sách chiều cao của Page 1

## Tóm tắt thay đổi

### 1. Viewport metrics engine

`readViewportMetrics()` đọc width/height (ưu tiên `visualViewport`), tính `aspectRatio`, `orientation` (từ hình học, không tin dữ liệu tracking) và `profile` (`mobile` < 768 ≤ `tablet` < 1200 ≤ `desktop`).

`publishViewportMetrics()` đẩy ra DOM để CSS và debug dùng được, thay vì đẻ thêm `@media`:

- `<html data-vp-profile="mobile|tablet|desktop">`
- `<html data-vp-orient="portrait|landscape|square">`
- `--avail-h` = chiều cao viewport trừ header (Phase 3 sẽ dùng để tính `--p1-scale`)

### 2. Fit engine

Ba trạng thái trên `<html data-p1-fit>`:

| Trạng thái | Nghĩa | Hệ quả |
|---|---|---|
| `fit` | Nội dung vừa một màn | Giữ layout một-màn, `fp-noscroll` bật |
| `scroll-section` | Tràn vừa phải (< 2× màn) | Mở khoá chiều cao tự nhiên, cuộn trong section, vẫn snap giữa các trang |
| `scroll-page` | Tràn nặng (≥ 2× màn) | Chuyển sang cuộn tài liệu bình thường (`fp-responsive`) |

Hai tín hiệu phát hiện tràn:

1. **Chiều cao layout thật** vượt quá chiều cao khả dụng — bắt được desktop/tablet nơi không có clamp.
2. **Chữ bị cắt** trong các khối bắt buộc phải hiện đủ (`.p1-desc`, `.p1-title`, card thời gian/địa điểm, card thành tựu). Đây là tín hiệu **bắt buộc** với mobile: layout mobile ép nội dung vừa màn bằng ngân sách phần trăm nên nó **không bao giờ tràn** — nó **cắt**. Card chuyên gia bị loại khỏi danh sách vì ảnh cố tình tràn ra ngoài card, luôn báo overflow giả ở mọi viewport.

Vài điểm khiến engine ổn định:

- **Đo ở layout thật, không đo ở layout mở khoá.** Bản mở khoá ép video về 16:9 và bỏ `max-height`, trong khi thiết kế desktop cố tình giới hạn chiều cao video — đo kiểu đó khiến `1366×768` và `1024×768` bị hiểu nhầm là tràn. Bản mở khoá giờ chỉ dùng để **chấm mức độ** tràn (chọn giữa `scroll-section` và `scroll-page`).
- **Không dao động**: kết quả được cache theo `${width}x${height}`, chỉ tính lại khi viewport đổi thật hoặc khi gọi `force`. Việc kiểm tra chữ bị cắt luôn chạy trong layout đã khoá (tạm gỡ class rồi trả lại, đồng bộ nên không có khung hình nào bị vẽ ra giữa chừng).
- Đo lại sau khi `document.fonts.ready` vì web font làm đổi chiều cao.
- Resize/orientationchange/visualViewport được gom về một lần đo mỗi frame.

### 3. Sửa lỗi fullPage bỏ qua `setResponsive`

fullPage xác định nó có đang ở chế độ responsive hay không bằng cách kiểm tra class trên `<body>`. Nếu mình gán class trước rồi mới gọi API thì lệnh bị bỏ qua im lặng, `fp-enabled` vẫn còn và trang **không cuộn được**. Giờ API luôn được gọi trước, và trạng thái quyết định trước khi fullPage khởi tạo sẽ được bàn giao lại ngay sau khi build xong.

### 4. Đã xóa

- `SHORT_VIEWPORT_HEIGHT = 650` và điều kiện `width >= 640` — ngưỡng này bỏ sót mobile hoàn toàn, nên máy như `414×630` không bao giờ được xử lý.
- `pageOneMobileFitMq` `(max-width: 639px)` — `fp-noscroll` giờ bật/tắt theo kết quả đo.

## Kết quả trên test matrix

Đo 25 viewport đại diện (mobile/tablet/desktop + các cặp cùng width khác height). Toàn bộ nội dung Page 1, Page 2, Page 3 đều tới được, không có tràn ngang:

| Viewport | Trước | Sau |
|---|---|---|
| `414×630` | Mất hẳn một dòng mô tả | `scroll-section`, hiện đủ chữ |
| `360×650` | Cắt 8px dòng mô tả | `scroll-section`, hiện đủ chữ |
| `320×568` | Cắt chữ trong card thời gian | `scroll-section` |
| `1280×603`, `1366×607` | Cuộn cả trang (`fp-responsive`) | `fit` — vừa gọn một màn, giữ snap |
| `768×1024` (iPad dọc) | Cuộn trong section | `scroll-section` (giữ nguyên) |
| `1536×864`, `1920×854` | Cuộn trong section | `scroll-section` (giữ nguyên) |
| `390×844` và các máy rộng rãi | Một màn | `fit` (giữ nguyên) |

## Đã kiểm tra

Playwright trên trang thật, YouTube IFrame API được mock (YouTube chặn phát video trong môi trường tự động).

- **Fit engine — 17/17 check**: metrics đúng theo viewport; máy rộng giữ layout một-màn; máy thấp mở khoá và cuộn trong section, dòng mô tả bị cắt hiện lại được; viewport nhỏ chuyển sang cuộn trang và cuộn thật; quay lại `fit` khi viewport rộng ra; **cùng một viewport nhưng thêm 400px nội dung thì trạng thái đổi** (chứng minh quyết định đến từ nội dung chứ không từ con số cứng); đo lặp 6 lần không dao động; `orientationchange` giữ trạng thái hợp lệ.
- **Regression Phase 1 — 18/18 check** vẫn pass.
- Page 2 và Page 3: kiểm tra ở 7 viewport, 0 trường hợp nội dung không tới được.

## Cách kiểm tra thủ công

```bash
python3 -m http.server 8000   # http://localhost:8000
```

Mở DevTools, chỉnh kích thước cửa sổ và xem `data-p1-fit` trên thẻ `<html>` đổi giữa `fit` / `scroll-section` / `scroll-page`. Ở `414×630` phải thấy đủ hai dòng "Biến ý tưởng thành nội dung giá trị và / xây dựng kênh Youtube để tạo thu nhập bền vững."

## Chưa làm (Phase 3)

Dọn 8 media query phụ thuộc `max-height` cứng và thay ngân sách phần trăm bằng `--p1-scale` tính từ `--avail-h`. Sau khi làm xong Phase 3, nhiều viewport hiện đang rơi vào `scroll-section` sẽ quay lại `fit` vì layout co giãn mượt hơn thay vì cắt chữ.
