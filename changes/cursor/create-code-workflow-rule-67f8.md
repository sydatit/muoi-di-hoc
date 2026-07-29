# Thay đổi: Cursor rule quy trình code & Git

## Mục tiêu

Thêm rule Cursor để agent luôn:
1. Tạo file MD mô tả phần sẽ thay đổi trước khi code
2. Chỉ commit và tạo nhánh — không tự merge khi chưa được phép

## File thay đổi

- `.cursor/rules/code-workflow.mdc` — rule `alwaysApply: true`
- `changes/cursor/create-code-workflow-rule-67f8.md` — file mô tả này

## Tóm tắt

Rule đặt convention `changes/<tên-nhánh>.md`, liệt kê nội dung tối thiểu và cấm merge/push nhánh chính trừ khi user cho phép rõ ràng.

## Kiểm tra

Mở Cursor → Rules; rule "Bắt buộc ghi file MD mô tả thay đổi..." xuất hiện với `alwaysApply: true`.
