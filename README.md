# Attendance Calculator

Trang web tĩnh giúp kiểm tra một ngày dự định xin nghỉ có vi phạm thời hạn thông báo chuyên cần hay không, đồng thời dự báo điểm chuyên cần còn lại.

## Tính năng

- Điểm hiện tại mặc định: **96/100** (có thể chỉnh).
- Kiểm tra đi trễ, về sớm, nghỉ nửa ngày và nghỉ từ 1 ngày trở lên.
- Tự tính deadline xin phép theo quy định: 2 ngày / 1 tuần / 1 tháng / 2 tháng.
- Dự báo mức trừ **0 / 1 / 2 điểm**.
- Hiển thị điểm sau dự kiến và Mức vi phạm 1–5.
- Tự xác định kỳ đánh giá hiện tại: 01/12–31/05 hoặc 01/06–30/11.
- Lưu dữ liệu gần nhất trong `localStorage` của trình duyệt.
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

- Đầu mỗi kỳ đánh giá reset về 100 điểm.
- 2 điểm: đi trễ/về sớm/vắng mặt mà liên lạc cùng ngày hoặc không liên lạc; hoặc vắng mặt >1 ngày không đúng quy định.
- 1 điểm: các vi phạm chuyên cần còn lại.
- Lấy mức điểm cao nhất cho một lần sử dụng.
- Đi trễ/về sớm/nghỉ 1/2 ngày: có kế hoạch khi báo trước ít nhất 2 ngày.
- Nghỉ từ 1 ngày: báo trước 1 tuần.
- Nghỉ từ 1 tuần: báo trước 1 tháng.
- Nghỉ từ 1 tháng: báo trước 2 tháng.
- Mức vi phạm: M1 77–88, M2 65–76, M3 53–64, M4 41–52, M5 ≤40; 89–100 chưa hình thành Mức 1.

## Lưu ý triển khai

Workflow GitHub Pages được cấu hình để deploy khi merge/push lên `main`. Trong repository settings, Pages cần chọn **GitHub Actions** làm source nếu chưa được bật.

## Lưu ý nghiệp vụ

Bộ tài liệu không nói rõ mọi mốc “ngày” là ngày lịch hay ngày làm việc. Phiên bản này dùng **ngày lịch**. Với việc tự phân loại “từ 1 tháng”, ứng dụng dùng ngưỡng 30 ngày; deadline theo tháng vẫn trừ theo tháng lịch và clamp ngày cuối tháng.
