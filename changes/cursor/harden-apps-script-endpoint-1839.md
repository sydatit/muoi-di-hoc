# Thay đổi: Vá bảo mật endpoint Apps Script (Giai đoạn 1)

## Mục tiêu

Thực hiện Giai đoạn 1 của kế hoạch trong `changes/cursor/security-audit-plan-1839.md` — xử lý 5 lỗi bảo mật nằm hoàn toàn trong Apps Script, không đụng tới front-end:

| Lỗi | Mức độ | Nội dung |
| --- | --- | --- |
| #1 | Nghiêm trọng | Formula injection vào Google Sheet |
| #5 | Cao | Không validate phía server, không giới hạn kích thước dữ liệu |
| #6 | Cao | Token Telegram nằm trong mã nguồn repo public |
| #8 | Trung bình | Trả chi tiết lỗi nội bộ về cho client |
| #10 | Trung bình | `getActiveSheet()` ghi nhầm tab + thiếu khoá ghi đồng thời |

## File thay đổi

- `google-apps-script/Code.gs` — toàn bộ phần vá
- `README.md` — cập nhật hướng dẫn deploy (Script Properties, tên sheet đăng ký)

## Tóm tắt thay đổi

### 1. Chống formula injection (`sanitizeCell_`)

Thêm `sanitizeCell_(value, maxLength)` chạy trước mọi lần ghi Sheet:

- Xoá ký tự điều khiển (tab, CR… thành khoảng trắng) rồi `trim()`, nên không thể lách bằng cách chèn khoảng trắng/tab trước dấu `=`.
- Chuỗi mở đầu bằng `=`, `+`, `-`, `@` được thêm dấu nháy đơn `'` để Sheets ép về text thay vì biên dịch thành công thức.
- Cắt độ dài: 500 ký tự cho trường thường, 2000 cho ô văn bản dài (câu hỏi chuyên gia, referrer, path).

Áp cho cả 3 đường ghi: `normalizeRow_()`, `appendVisit_()`, `deviceColumns_()`.

Cố ý **không** dùng `.map(sanitizeCell_)` vì `Array.map` truyền thêm tham số index vào vị trí `maxLength` — cell thứ 1 sẽ bị cắt còn 1 ký tự. Mọi lời gọi đều bọc trong hàm ẩn danh hoặc gọi tường minh.

### 2. Validate phía server (`validateRegistration_`)

Kiểm tra trước khi ghi, sai thì từ chối và không đụng vào Sheet. Ràng buộc **soi gương đúng bằng** validate phía client trong `app.js` để không từ chối nhầm người dùng thật:

| Trường | Ràng buộc |
| --- | --- |
| `fullName` | không rỗng, tối đa 100 ký tự |
| `phone` | `/^0[35789]\d{8}$/` sau khi bỏ khoảng trắng, `.` và `-` |
| `age` | số từ 10 đến 100 |
| `youtubeExperience` | không rỗng |
| `acknowledgement` | `true` / `"true"` / `"Đã hiểu"` |

`youtubeExperience` chỉ kiểm tra không rỗng chứ không so với danh sách option cố định — nếu sau này sửa option trong `index.html` mà quên sửa script thì đăng ký thật vẫn không bị chặn.

### 3. Token Telegram chuyển sang Script Properties

Xoá hai hằng số `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` khỏi file. Đọc qua `PropertiesService.getScriptProperties()`. Chưa cấu hình thì ghi log cảnh báo và bỏ qua, luồng lưu Sheet không bị ảnh hưởng (giữ nguyên hành vi cũ).

### 4. Không rò rỉ lỗi nội bộ

`doPost` không còn trả `error.toString()`. Chi tiết lỗi (kèm stack) ghi vào `console.error` để xem trong Executions log; client chỉ nhận thông báo chung.

Lỗi `JSON.parse` cũng được bắt riêng thay vì rơi xuống catch tổng.

Tiện thể gọn luôn `doGet`: chỉ trả `{ "status": "ok" }` thay vì mô tả cấu trúc API (lỗi #12 mức thấp, cùng nhóm rò rỉ thông tin).

### 5. Đích ghi xác định + khoá ghi đồng thời

- Thêm `REGISTRATIONS_SHEET_NAME = "Registrations"`. `getRegistrationsSheet_()` ưu tiên sheet đúng tên; **không tìm thấy thì lùi về sheet đầu tiên**, đúng bằng đích mà `getActiveSheet()` đang ghi hôm nay. Cố ý không tự tạo sheet mới để tránh tách dữ liệu đăng ký ra hai nơi ở các deployment đang chạy.
- `withSheetLock_()` bọc mọi thao tác ghi bằng `LockService.getScriptLock()` (chờ tối đa 20 giây). Lấy khoá thất bại thì trả lỗi để người dùng gửi lại, không ghi nửa vời.
- Lời gọi Telegram nằm **ngoài** khoá vì đó là request mạng chậm, không nên giữ khoá ghi.

## Không nằm trong phạm vi PR này

- Lỗi #9 (escape Telegram Markdown dễ vỡ) — vẫn giữ nguyên `parse_mode: "Markdown"`, để dành cho PR sau đúng theo kế hoạch.
- Lỗi #2 (endpoint công khai, chưa có Turnstile/rate-limit) — Giai đoạn 3.
- Lỗi #3, #4 (ghim CDN + SRI, security header) — Giai đoạn 2.

## Kiểm tra

Đã chạy unit test bằng Node cho toàn bộ script, stub các global của Apps Script (`SpreadsheetApp`, `PropertiesService`, `LockService`, `UrlFetchApp`, `ContentService`). **82/82 case pass**, gồm:

- `=IMAGE(...)`, `=IMPORTXML(...)`, `+1+1`, `-1+1`, `@SUM(A1:A9)`, `=cmd|'/c calc'!A1` đều bị ép về text bằng tiền tố `'` — kể cả khi chèn tab/CR/khoảng trắng phía trước.
- Chạy sanitize hai lần cho cùng một giá trị không sinh ra hai dấu nháy (idempotent).
- Chuỗi 60.000 ký tự bị cắt còn 500 (hoặc 2000 với ô văn bản dài).
- Giá trị bình thường (tên tiếng Việt có dấu, SĐT, `390x844`, URL) không bị đụng tới.
- SĐT hợp lệ `0901234567`, `090 123 4567`, `090-123-4567`, `090.123.4567` được chấp nhận; `0123456789`, `090123456`, `+84901234567`, rỗng bị từ chối. Tuổi biên 10 và 100 được chấp nhận, 9 và 101 bị chặn.
- `normalizeRow_` trả đúng 21 cột khớp `SHEET_HEADERS`, `appendVisit_` trả đúng 12 cột khớp `VISITS_HEADERS`.
- Có case riêng canh bẫy `.map(sanitizeCell_)`: kiểm tra cột 2/3/4 không bị cắt cụt.
- Đăng ký sai dữ liệu thì **không có dòng nào được ghi vào Sheet**.
- Khi `appendRow` ném lỗi: client chỉ nhận `"Không thể xử lý yêu cầu. Vui lòng thử lại sau."`, không lộ chi tiết; và khoá ghi vẫn được nhả nên request kế tiếp ghi bình thường.
- Chưa set Script Properties thì không gọi Telegram API lần nào; set rồi thì gọi đúng 1 lần với token lấy từ Properties.

### Kiểm tra thủ công sau khi deploy

1. Dán `Code.gs` mới → Save → Deploy → Manage deployments → Edit → New version. URL không đổi nên `app.js` giữ nguyên.
2. (Nếu dùng Telegram) Project Settings → Script Properties → thêm `TELEGRAM_BOT_TOKEN` và `TELEGRAM_CHAT_ID`.
3. Gửi một đăng ký thật từ trang → dòng mới xuất hiện đúng sheet đăng ký cũ, toast báo thành công.
4. Gửi một đăng ký với Họ tên là `=IMAGE("https://example.com/x.png")` → ô trong Sheet phải hiện đúng chuỗi text, không render ảnh, không thành công thức.
5. Kiểm tra sheet `Visits` vẫn nhận visit beacon bình thường.
