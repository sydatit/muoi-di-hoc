# Thay đổi: Bỏ cột Ngôn ngữ và User Agent khỏi tracking thiết bị

## Mục tiêu

Giảm dữ liệu tracking — không ghi `language` và `userAgent` vào Google Sheet nữa.

## File thay đổi

- `app.js` — bỏ `language`, `userAgent` khỏi `deviceProfile` và `getDeviceSnapshot()`
- `google-apps-script/Code.gs` — bỏ 2 cột khỏi `DEVICE_HEADERS` / `deviceColumns_()`, cập nhật comment
- `README.md` — cập nhật bảng mô tả (6 cột thiết bị thay vì 8)

## Tóm tắt

Payload visit/registration vẫn gửi 6 trường thiết bị: loại, OS, trình duyệt, màn hình, viewport, hướng. Sheet mới deploy sẽ có 6 cột; sheet đã có 8 cột cũ giữ nguyên (2 cột cuối không được ghi thêm dữ liệu mới).

## Kiểm tra

Gửi visit beacon → payload không còn `language` / `userAgent`; Apps Script ghi đúng 6 cột thiết bị.
