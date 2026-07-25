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

### Deploy Apps Script

1. Mở Google Sheet → Extensions → Apps Script
2. Dán nội dung [`google-apps-script/Code.gs`](google-apps-script/Code.gs) → Save
3. Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone)
4. Nếu URL đổi, cập nhật `WEB_APP_URL` trong `app.js`
5. Đổi `REGISTRATIONS_SHEET_NAME` trong script nếu sheet đăng ký hiện tại không tên `Registrations`

### Công thức tab Stats (gợi ý)

Giả sử cột B = VisitorId trên cả hai sheet:

```
Tổng session visit   =COUNTA(Visits!B:B)-1
Unique visitor       =COUNTA(UNIQUE(Visits!B2:B))
Số đăng ký           =COUNTA(Registrations!B:B)-1
Chưa đăng ký         =COUNTA(UNIQUE(FILTER(Visits!B2:B, COUNTIF(Registrations!B:B, Visits!B2:B)=0)))
Conversion           =IFERROR(COUNTA(UNIQUE(Registrations!B2:B))/COUNTA(UNIQUE(Visits!B2:B)), 0)
```

## Giấy phép

Dự án này được phân phối theo giấy phép **GNU General Public License phiên bản 3 (GPLv3)**.

Bạn được tự do sử dụng, sửa đổi và chia sẻ mã nguồn theo các điều khoản của GPLv3. Bản đầy đủ của giấy phép: [https://www.gnu.org/licenses/gpl-3.0.html](https://www.gnu.org/licenses/gpl-3.0.html).
