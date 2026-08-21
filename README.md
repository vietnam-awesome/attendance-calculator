# Attendance Calculator

Công cụ cá nhân giúp tự kiểm tra ngày dự định nghỉ có vượt mốc báo trước hay không, đồng thời dự báo điểm chuyên cần còn lại.

Ứng dụng chạy hoàn toàn phía trình duyệt. Dữ liệu nhập chỉ được lưu trong `localStorage` trên thiết bị của người dùng và không được gửi tới máy chủ hay bất kỳ bên nào.

## Tính năng

- Điểm hiện tại mặc định: **96/100** (có thể chỉnh).
- Kiểm tra đi trễ, về sớm, nghỉ nửa ngày và nghỉ từ 1 ngày trở lên.
- Tự tính mốc báo trước: 2 ngày / 1 tuần / 1 tháng / 2 tháng.
- Dự báo mức trừ **0 / 1 / 2 điểm**.
- Hiển thị điểm sau dự kiến và Mức vi phạm 1–5.
- Tự xác định kỳ điểm hiện tại: 01/12–31/05 hoặc 01/06–30/11.
- Lưu lựa chọn gần nhất trong `localStorage` của trình duyệt.
- Không cần backend, framework hay API.

## Chạy local

```bash
python3 -m http.server 8080
```

Mở `http://localhost:8080`.

## Kiểm tra code

```bash
npm run check
npm test
```

## Quy tắc chính được mã hóa

- Đầu mỗi kỳ điểm reset về 100 điểm.
- 2 điểm: đi trễ/về sớm/nghỉ mà đến cùng ngày mới báo hoặc không báo trước; hoặc nghỉ >1 ngày nhưng không đủ thời hạn.
- 1 điểm: các trường hợp còn lại có báo trước nhưng chưa đủ thời hạn.
- Lấy mức trừ cao nhất cho một tình huống.
- Đi trễ/về sớm/nghỉ 1/2 ngày: báo trước ít nhất 2 ngày.
- Nghỉ từ 1 ngày: báo trước 1 tuần.
- Nghỉ từ 1 tuần: báo trước 1 tháng.
- Nghỉ từ 1 tháng: báo trước 2 tháng.
- Mức điểm: M1 77–88, M2 65–76, M3 53–64, M4 41–52, M5 ≤40; 89–100 chưa hình thành Mức 1.

## Preview PR

Mỗi Pull Request tự động có comment **PR Preview** chứa link chạy đúng code tại commit hiện tại của PR. Link preview được cập nhật mỗi khi push commit mới.

## Triển khai

Workflow GitHub Pages được cấu hình để deploy khi merge/push lên `main`. Trong repository settings, Pages cần chọn **GitHub Actions** làm source nếu chưa được bật.

## Lưu ý cách tính

Các mốc thời gian hiện dùng **ngày lịch**. Khi tự phân loại “từ 1 tháng”, ứng dụng dùng ngưỡng 30 ngày; deadline theo tháng vẫn trừ theo tháng lịch và clamp ngày cuối tháng.

Kết quả chỉ phục vụ tự tham khảo theo bộ quy tắc đã cấu hình trong ứng dụng.
