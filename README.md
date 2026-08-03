# Muối Đi Học

Landing page giới thiệu chương trình **Muối Đi Học** — dự án dạy nghề phi lợi nhuận cho cộng đồng, tổ chức bởi [Hạt Muối Yêu Thương](https://github.com/sydatit/muoi-di-hoc).

Trang web trình bày chương trình đào tạo tiếp theo (ví dụ: YouTube — từ ý tưởng đến thu nhập), giới thiệu dự án, và cho phép học viên đăng ký tham gia qua form trên site.

## Công nghệ sử dụng

Dự án là website tĩnh (HTML / CSS / JavaScript), không cần build step. Các thư viện bên ngoài được nạp qua CDN:

| Thư viện | Mục đích | Giấy phép |
| --- | --- | --- |
| [Tailwind CSS](https://tailwindcss.com/) | Utility CSS | MIT |
| [Lucide](https://lucide.dev/) | Icon | ISC |
| [Google Fonts](https://fonts.google.com/) (Montserrat, Dancing Script) | Typography | OFL |

## Cài đặt và chạy

Không cần cài dependency bằng npm. Chỉ cần clone repo và phục vụ các file tĩnh.

### 1. Clone

```bash
git clone https://github.com/sydatit/muoi-di-hoc.git
cd muoi-di-hoc
```

### 2. Chạy local

**Cách nhanh:** mở file `index.html` trực tiếp bằng trình duyệt.

**Hoặc dùng HTTP server** (khuyến nghị, tránh giới hạn CORS khi gửi form):

```bash
# Python 3
python -m http.server 8080
```

```bash
# Node.js (nếu đã cài)
npx --yes serve -l 8080
```

Sau đó mở trình duyệt tại `http://localhost:8080`.

### Cấu trúc chính

- `index.html` — markup trang
- `styles.css` — style bổ sung
- `app.js` — tương tác UI, scroll theo section, form đăng ký, visit beacon
- `assets/` — logo và hình ảnh
- `google-apps-script/Code.gs` — mẫu Apps Script ghi Visits + Registrations

## Tracking visit & đăng ký (Google Sheet)

Landing gửi sự kiện lên Google Apps Script Web App:

| `eventType` | Khi nào | Sheet |
| --- | --- | --- |
| `visit` | Mỗi session vào trang (1 lần / tab session) | **Visits** |
| `registration` | Submit form thành công | **Registrations** |

Khách vào mà không đăng ký = visitor có trên **Visits** nhưng không có trên **Registrations** (đối chiếu `visitorId`).

### Tracking thiết bị (mobile / tablet / desktop)

Cả 2 loại sự kiện đều gửi kèm 6 cột thiết bị, được ghi vào cuối mỗi sheet:

| Cột | Ví dụ | Ghi chú |
| --- | --- | --- |
| Loại thiết bị | `Mobile` / `Tablet` / `Desktop` | Nhận diện theo user agent; iPad chạy iPadOS 13+ (user agent giống macOS) được nhận ra qua `maxTouchPoints` |
| Hệ điều hành | `iOS`, `iPadOS`, `Android`, `Windows`, `macOS` | |
| Trình duyệt | `Chrome`, `Safari`, `Facebook (in-app)` | Nhận diện in-app browser: Facebook, Messenger, Instagram, Zalo, TikTok, Line |
| Màn hình (Screen) | `390x844` | `screen.width x screen.height` |
| Viewport | `390x664` | Kích thước thật lúc gửi event |
| Hướng màn hình | `Portrait` / `Landscape` | |

Sheet đang có dữ liệu sẽ tự được bổ sung tiêu đề cho các cột mới ở lần ghi đầu tiên sau khi deploy — không cần sửa tay và không ảnh hưởng cột cũ.

Bảng dev console (góc phải trang, bấm icon để mở) hiển thị sẵn loại thiết bị / hệ điều hành / trình duyệt / viewport để kiểm tra nhanh trước khi xem sheet.

### Deploy Apps Script

1. Mở Google Sheet → Extensions → Apps Script
2. Dán nội dung [`google-apps-script/Code.gs`](google-apps-script/Code.gs) → Save
3. Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone)
4. Nếu URL đổi, cập nhật `WEB_APP_URL` trong `app.js`

### Cấu hình Telegram (tuỳ chọn)

Token **không** đặt trong `Code.gs` — repo là public, commit nhầm một lần là bot bị chiếm. Script đọc token từ Script Properties:

1. Apps Script Editor → Project Settings → Script Properties → Add script property
2. Thêm `TELEGRAM_BOT_TOKEN` và `TELEGRAM_CHAT_ID`

Chưa cấu hình thì script bỏ qua bước gửi Telegram và vẫn lưu Google Sheet bình thường.

### Sheet đăng ký

Script ghi đăng ký vào sheet tên `Registrations`. Nếu không có sheet nào tên như vậy, nó ghi vào **sheet đầu tiên** của bảng tính (giữ nguyên đích ghi của các bản deploy cũ) và không tự tạo sheet mới. Muốn đổi tên khác thì sửa hằng `REGISTRATIONS_SHEET_NAME` trong `Code.gs`.

### Dữ liệu người dùng gửi lên

Mọi giá trị đều được khử trước khi ghi Sheet: chuỗi mở đầu bằng `=`, `+`, `-`, `@` được thêm dấu nháy đơn để Sheets hiểu là text thay vì biên dịch thành công thức, và bị cắt tối đa 500 ký tự (2000 với ô văn bản dài). Đăng ký còn được validate lại phía server (họ tên, số điện thoại, tuổi, kinh nghiệm, xác nhận) — sai thì không ghi Sheet.

### Công thức tab Stats (gợi ý)

Giả sử cột B = VisitorId trên cả hai sheet:

```
Tổng session visit   =COUNTA(Visits!B:B)-1
Unique visitor       =COUNTA(UNIQUE(Visits!B2:B))
Số đăng ký           =COUNTA(Registrations!B:B)-1
Chưa đăng ký         =COUNTA(UNIQUE(FILTER(Visits!B2:B, COUNTIF(Registrations!B:B, Visits!B2:B)=0)))
Conversion           =IFERROR(COUNTA(UNIQUE(Registrations!B2:B))/COUNTA(UNIQUE(Visits!B2:B)), 0)
```

Thống kê visit theo thiết bị (cột G của sheet **Visits** là Loại thiết bị):

```
=QUERY(Visits!G2:G, "select Col1, count(Col1) where Col1 is not null group by Col1 label count(Col1) 'Số visit'")
```

## Giấy phép

Dự án này được phân phối theo giấy phép **GNU General Public License phiên bản 3 (GPLv3)**.

Bạn được tự do sử dụng, sửa đổi và chia sẻ mã nguồn theo các điều khoản của GPLv3. Bản đầy đủ của giấy phép: [https://www.gnu.org/licenses/gpl-3.0.html](https://www.gnu.org/licenses/gpl-3.0.html).
