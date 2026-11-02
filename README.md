# Attendance Calculator

Công cụ cá nhân giúp tự kiểm tra ngày dự định nghỉ có vượt mốc báo trước hay không, đồng thời dự báo điểm chuyên cần còn lại.

Ứng dụng chạy hoàn toàn phía trình duyệt. Dữ liệu nhập chỉ được lưu trong `localStorage` trên thiết bị của người dùng và không được gửi tới máy chủ hay bất kỳ bên nào.

## Tính năng

- Điểm hiện tại mặc định: **96/100** (có thể chỉnh).
- Kiểm tra đi trễ, về sớm, nghỉ nửa ngày và nghỉ từ 1 ngày trở lên.
- Hiển thị ngày lễ chính thức của Việt Nam trên lịch, tách riêng lịch nghỉ bù/hoán đổi **tham khảo**.
- Danh sách ngày lễ theo năm đang xem; nhấn vào dịp lễ để chuyển nhanh tháng, chú thích kỳ nghỉ dự kiến trùng ngày lễ.
- Có **Ngày Văn hóa Việt Nam 24/11** từ 2026; ngày âm lịch Tết/Giỗ Tổ chỉ đưa vào khi có dữ liệu năm đã xác minh.
- Tự tính mốc báo trước: 2 ngày / 1 tuần / 1 tháng / 2 tháng.
- Dự báo mức trừ **0 / 1 / 2 điểm**.
- Hiển thị điểm sau dự kiến và Mức vi phạm 1–5.
- Tự xác định kỳ điểm hiện tại: 01/12–31/05 hoặc 01/06–30/11.
- Lưu điểm, tình huống và ngày dự định nghỉ trong `localStorage`. **Mốc tính tự lấy ngày hiện tại của thiết bị khi mở trang**, không giữ ngày cũ qua lần tải trang mới.
- Lịch tự mở **tháng hiện tại**, ngay cả khi đã lưu ngày nghỉ tương lai; có thể dùng nút "Về ngày đã chọn" để quay đến tháng dự kiến nghỉ.
- Ngày đã chọn trong quá khứ được chuyển sang ngày dự kiến hợp lệ gần nhất; ngày tương lai do người dùng chủ động chọn vẫn được giữ nguyên.
- Khi để tab mở qua ngày mới, ngày tham chiếu tự cập nhật khi quay lại tab (trừ khi đang chỉnh thủ công mốc tính trong phiên).
- UI responsive xây dựng bằng **Tailwind CSS v4**.
- **Date picker bằng Flatpickr v4.6.13** (MIT, ghim phiên bản): ô Mốc tính, Ngày đang chọn, Ngày kết thúc dùng lịch tiếng Việt, hiển thị dd/mm/yyyy; ô Chọn tháng dùng plugin MonthSelect để chọn tháng/năm. Giá trị xử lý bên trong luôn ISO `YYYY-MM-DD` / `YYYY-MM`.
- Chặn ngày quá khứ và T7/CN/ngày lễ khi chọn **ngày bắt đầu**. Ngày kết thúc có thể nằm cuối tuần vì khoảng nghỉ nhiều ngày được tính theo ngày lịch.
- Tải qua jsDelivr, **có fallback native date/month input** nếu CDN hoặc plugin không khả dụng; không cần bundler/npm trong production. Có kiểm thử tự động cho khởi tạo, đồng bộ lựa chọn và fallback.
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

## Ngày nghỉ lễ Việt Nam

Danh mục độc lập với chính sách từng doanh nghiệp, không có dữ liệu nội bộ công ty:

- **Ngày cố định theo luật:** Tết Dương lịch 01/01, 30/04, 01/05, Quốc khánh 02/09 và Ngày Văn hóa Việt Nam 24/11 (từ 2026).
- **Ngày theo âm lịch đã xác minh:** Giỗ Tổ Hùng Vương (10/03 âm) 26/04/2026, 16/04/2027; lịch Tết Nguyên đán **khối cơ quan nhà nước** năm 2026 và 2027.
- **Lịch tham khảo:** ngày liền kề Quốc khánh đã công bố cho cơ quan nhà nước, ngày nghỉ bù / hoán đổi đã xác minh. Hiển thị tách màu, không khẳng định bắt buộc áp dụng cho mọi doanh nghiệp.
- **Các năm khác:** chỉ hiển thị ngày dương lịch cố định. Không tự suy đoán lịch âm hoặc lịch nghỉ bù chưa xác nhận.
- Các kỳ nghỉ có thể có ngày nghỉ hằng tuần nằm giữa; ngày lễ được hiển thị trên calendar và trong bảng danh sách sắp tới.
- Trên calendar, **ngày lễ chính thức** có nền đỏ hồng, biểu tượng ngôi sao và tên ngày lễ; **lịch khối nhà nước tham khảo** có nền xanh dương, biểu tượng lịch.
- **Thứ Bảy và Chủ nhật** mặc định là ngày nghỉ với ô màu tím/tím xanh riêng, hiện "NGÀY NGHỈ" thay vì "AN TOÀN"; ngày lễ trùng cuối tuần luôn ưu tiên kiểu ngày lễ.
- Khi một ngày **đã qua**, ô lịch sử dụng duy nhất màu xám trung tính (kể cả T7/CN và ngày lễ), không có icon màu, hover hay marker chọn.
- **Không thể quay về tháng trước tháng hiện tại**: nút mũi tên trái bị khóa ở tháng hiện tại, nhập tháng quá khứ vào bộ chọn tháng/năm sẽ bị từ chối; cả link ngày lễ lẫn nút "Ngày đã chọn" cũng không thể mở lịch cũ.
- **Chọn nhanh** ngay trên lịch: "Ngày an toàn gần nhất" (ngày đủ hạn báo trước), "+7 ngày", "+14 ngày" (bỏ qua cuối tuần và ngày lễ chính thức). Chuyển tháng để xem không thay đổi ngày nghỉ đã chọn.
- **Bố cục lịch gọn hơn:** chỉ để các thao tác thực sự dùng thường xuyên ngay trên lịch; nút chọn tháng/năm, "Tháng này" và "Ngày đã chọn" nằm trong menu "Chọn tháng". Mũi tên phải chuyển sang tháng kế tiếp, không có nút "Tháng sau" trùng lặp.
- Thanh thông tin lịch chỉ hiển thị **ngày dự kiến nghỉ** và **hạn đăng ký**, thay vì lặp lại toàn bộ chú giải màu.
- Sidebar ngày lễ mặc định chỉ hiển thị **3 mục gần nhất**, có nút mở rộng danh sách. Quy tắc báo trước và lưu ý lịch được thu gọn bằng `details`.
- Các tháng chỉ cần 4–5 tuần sẽ không render hàng thứ 6 thừa; menu chọn tháng không bị cắt bởi viền calendar.

- Ô chọn ngày nghỉ đặt ngày tối thiểu là **hôm nay**; nếu nhập tay một ngày cũ, công cụ báo lỗi thay vì dự báo điểm.
- Ngày từ tháng trước/tháng sau chỉ là **ô lấp lịch**, không được chọn và không hiển thị chấm mốc tính, ngày đang chọn, viền focus hoặc gợi ý. Nút "Về ngày đã chọn" vẫn đưa người dùng đến đúng tháng có ngày đã chọn.
- Ngày nghỉ cuối tuần không thể được chọn trên lịch để tính điểm chuyên cần, và được loại khỏi gợi ý ngày nghỉ an toàn gần nhất. Các ngày lễ chính thức cũng không được đề xuất làm ngày cần xin phép.
- Nếu nhập thủ công ngày bắt đầu rơi vào T7/CN, công cụ nhắc rằng đó là ngày nghỉ định kỳ thay vì tính mức trừ điểm. Lịch mặc định **làm việc từ thứ Hai đến thứ Sáu**, không đại diện mọi doanh nghiệp.
- Di chuột hoặc focus bàn phím vào ngày lễ để xem **tooltip chi tiết** (tên, ngày, loại lễ, ghi chú); trên điện thoại có thể chạm để xem. Tooltip được gắn vào body nên không bị cắt ở biên calendar.
- **Không tự động trừ ngày lễ khỏi số ngày xin phép / điểm chuyên cần**, vì lịch doanh nghiệp và cơ chế nghỉ bù có thể khác. Chỉ có cảnh báo thông tin khi chọn kỳ nghỉ trùng lễ.

Nguồn công khai:

- [Bộ luật Lao động 2019, Điều 112](https://vanban.org/van-ban/bo-luat-lao-dong-2019-45-2019-qh14/dieu-112)
- [Ngày Văn hóa Việt Nam 24/11 — Cổng TTĐT Chính phủ](https://xaydungchinhsach.chinhphu.vn/ngay-24-11-hang-nam-la-ngay-van-hoa-viet-nam-nguoi-lao-dong-duoc-nghi-huong-nguyen-luong-119260113152642414.htm)
- [Lịch Tết và Quốc khánh 2026 — Cổng TTĐT Chính phủ](https://baochinhphu.vn/bo-noi-vu-thong-bao-lich-nghi-tet-am-lich-va-nghi-le-quoc-khanh-nam-2026-102251017095507785.htm)
- [Lịch Tết và Quốc khánh 2027 — Cổng TTĐT Chính phủ](https://xaydungchinhsach.chinhphu.vn/de-xuat-2-phuong-an-nghi-tet-nguyen-dan-2027-tet-dinh-mui-11926080513033257.htm)

## Preview PR

Mỗi Pull Request tự động có comment **PR Preview** chứa link chạy đúng code tại commit hiện tại của PR. Link preview được cập nhật mỗi khi push commit mới.

## UI

Giao diện dùng Tailwind CSS v4 theo hướng mobile-first: form tối giản, kết quả nổi bật, card responsive và các nút chọn nhanh ngày nghỉ.

## Triển khai

Workflow GitHub Pages được cấu hình để deploy khi merge/push lên `main`. Trong repository settings, Pages cần chọn **GitHub Actions** làm source nếu chưa được bật.

## Lưu ý cách tính

Mốc báo trước vẫn tính **ngày lịch**; khi chọn khoảng nghỉ nhiều ngày, số ngày hiện được phân loại theo **độ dài ngày lịch**, chưa tự trừ ngày cuối tuần khỏi độ dài kỳ nghỉ. Điều này không ảnh hưởng đến việc tô màu ngày nghỉ cuối tuần trên calendar.

Các mốc thời gian hiện dùng **ngày lịch**. Khi tự phân loại “từ 1 tháng”, ứng dụng dùng ngưỡng 30 ngày; deadline theo tháng vẫn trừ theo tháng lịch và clamp ngày cuối tháng.

Kết quả chỉ phục vụ tự tham khảo theo bộ quy tắc đã cấu hình trong ứng dụng.
