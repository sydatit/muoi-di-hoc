# Deploy Google Apps Script (Form đăng ký)

## 1. Dán code

1. Mở Google Sheet dùng để lưu đăng ký (hoặc tạo Sheet mới).
2. **Extensions → Apps Script**.
3. Xóa code mặc định, dán toàn bộ nội dung file [`Code.gs`](./Code.gs).
4. (Tuỳ chọn) Thay `TELEGRAM_BOT_TOKEN` và `TELEGRAM_CHAT_ID` bằng giá trị thật.
5. **Save**.

## 2. Deploy Web App

1. Trong Apps Script: **Deploy → New deployment**.
2. Chọn loại **Web app**.
3. Cấu hình:
   - **Execute as:** `Me`
   - **Who has access:** `Anyone` (để form public gửi được từ trình duyệt)
4. **Deploy**, cấp quyền Google khi được hỏi.
5. Copy URL dạng `https://script.google.com/macros/s/.../exec`.

> Mỗi lần sửa code sau này: **Deploy → Manage deployments → Edit (bút chì) → Version: New version → Deploy** để cập nhật cùng URL, hoặc tạo deployment mới nếu muốn URL mới.

## 3. Nối frontend

Gửi URL `/exec` mới lại cho repo. Thay biến `webAppUrl` trong `index.html` (hàm gửi form) bằng URL đó.

## 4. Kiểm tra

1. (Tuỳ chọn) Chạy hàm `testAppendSampleRow` trong editor → kiểm tra Sheet có dòng mẫu + tiêu đề.
2. Submit form thật trên website.
3. Kiểm tra Sheet có đủ cột mới và (nếu đã cấu hình) Telegram có tin nhắn.
