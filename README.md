# Attendance Calculator

Công cụ cá nhân giúp tự kiểm tra ngày dự định nghỉ có vượt mốc báo trước hay không, đồng thời dự báo điểm chuyên cần còn lại.

Ứng dụng chạy hoàn toàn phía trình duyệt. Dữ liệu nhập chỉ được lưu trong `localStorage` trên thiết bị của người dùng và không được gửi tới máy chủ hay bất kỳ bên nào.

## Tính năng

- Điểm hiện tại mặc định: **96/100** (có thể chỉnh).
- Kiểm tra đi trễ, về sớm, nghỉ nửa ngày và nghỉ từ 1 ngày trở lên.
- Đối chiếu riêng quy tắc **phép năm** và **nghỉ hè đặc biệt RCVN** (không lẫn với NG point).
- Nhận biết kỳ nghỉ hè nối phép năm hoặc kỳ nghỉ lễ Nhà nước (kể cả nối qua cuối tuần).
- Kiểm tra điều kiện nghỉ hè: thời gian 01/06–31/10, tối đa 5 ngày làm việc, đủ 6 tháng chính thức, dùng một lần/năm, không đang bàn giao, hạn đăng ký 1–2 tháng và phê duyệt.
- Tự tính mốc báo trước: 2 ngày / 1 tuần / 1 tháng / 2 tháng.
- Dự báo mức trừ **0 / 1 / 2 điểm**.
- Hiển thị điểm sau dự kiến và Mức vi phạm 1–5.
- Tự xác định kỳ điểm hiện tại: 01/12–31/05 hoặc 01/06–30/11.
- Lưu lựa chọn gần nhất trong `localStorage` của trình duyệt.
- UI responsive xây dựng bằng **Tailwind CSS v4**.
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

## Phép năm và nghỉ hè RCVN

Nguồn: **SAIGON-RC_RCVN_Annual_Holiday_有給休暇使用規則.xlsx**, hai sheet:
- `Chế_độ_nghỉ_hè`, sửa đổi **01/05/2025**.
- `Phép_năm`, hiệu lực **01/01/2021**.

Đây là công cụ **tự kiểm tra**, không phải hệ thống duyệt phép. Kết quả **0 điểm trừ** không có nghĩa là đơn đã được chấp thuận.

### Phép năm thông thường

- 12 ngày/năm với người làm đủ 12 tháng trong điều kiện bình thường; người làm chưa đủ năm được hưởng tương ứng, cộng 1 ngày cho mỗi 5 năm làm việc.
- Phép chưa dùng được sử dụng đến **31/03** năm sau; cách ghi nhận phép trong thời gian thử việc, tháng làm việc và khi nghỉ việc có quy tắc riêng trong file HR.
- Được đăng ký nghỉ nối dịp lễ nhưng **phải xin theo quy định và được cấp quản lý chấp thuận** (mục 9a–c).
- Kết hợp phép của năm trước và năm sau dịp Tết cần được phê duyệt; riêng cách trừ phép dịp Tết là **phép năm mới trước, rồi năm cũ, phần thiếu tính không lương** (mục 9–10).
- Công cụ không tự tính số phép được hưởng, vì thiếu dữ liệu về hợp đồng, thâm niên và giờ công từng tháng.

### Nghỉ hè đặc biệt

- Tối đa **5 ngày làm việc liên tiếp**, một lần/năm, ngoài phép năm; chỉ dùng **01/06–31/10**.
- Đã là nhân viên chính thức đủ **6 tháng** trước khi bắt đầu nghỉ.
- Nhân viên/Leader/BSE/Section Chief: đăng ký trước **1 tháng**; Chief/Manager: **2 tháng**.
- Bắt buộc được quản lý có thẩm quyền phê duyệt (Chief trở lên); lịch nghỉ có thể bị từ chối do dự án, nhân sự trùng lịch hoặc đang bàn giao.
- **Về nguyên tắc không chấp nhận** nối thêm phép năm với nghỉ hè nếu không có lý do bất khả kháng.
- **Về cơ bản không chấp nhận** nối nghỉ hè với ngày lễ Nhà nước (ví dụ 02/09).
- Nghỉ hè sai quy định có thể bị từ chối chế độ đặc biệt; ngày đã nghỉ được xem xét trừ phép năm còn lại hoặc nghỉ không lương.

Giao diện yêu cầu nhập **khoảng ngày lễ thực tế** thay vì gán cứng ngày nghỉ bù/hoán đổi của Nhà nước. Việc nối qua thứ Bảy, Chủ nhật cũng được tính là liên tiếp. Số ngày làm việc của nghỉ hè được **ước tính theo thứ Hai–thứ Sáu**; HR có thể điều chỉnh theo lịch làm việc thực tế.

Các cảnh báo chính sách là **trạng thái riêng**: `restricted`, `review`, `approved` theo thông tin người dùng cung cấp. Không có mức trừ chuyên cần tự động bổ sung chỉ vì kết hợp nghỉ hoặc chưa được duyệt.

## Preview PR

Mỗi Pull Request tự động có comment **PR Preview** chứa link chạy đúng code tại commit hiện tại của PR. Link preview được cập nhật mỗi khi push commit mới.

## UI

Giao diện dùng Tailwind CSS v4 theo hướng mobile-first: form tối giản, kết quả nổi bật, card responsive và các nút chọn nhanh ngày nghỉ.

## Triển khai

Workflow GitHub Pages được cấu hình để deploy khi merge/push lên `main`. Trong repository settings, Pages cần chọn **GitHub Actions** làm source nếu chưa được bật.

## Lưu ý cách tính

Các mốc thời gian hiện dùng **ngày lịch**. Khi tự phân loại “từ 1 tháng”, ứng dụng dùng ngưỡng 30 ngày; deadline theo tháng vẫn trừ theo tháng lịch và clamp ngày cuối tháng.

Kết quả chỉ phục vụ tự tham khảo theo bộ quy tắc đã cấu hình trong ứng dụng.
