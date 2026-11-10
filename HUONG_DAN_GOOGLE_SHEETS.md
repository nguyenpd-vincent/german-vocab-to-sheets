# Deutsch Lens — Thêm vào từ vựng trong Google Sheets

## Tính năng mới
Tra từ → chọn mục từ đúng → bấm **＋ Thêm vào từ vựng**.
Dữ liệu được thêm cuối tab đã cấu hình, không sửa các dòng cũ:
A Từ vựng | B Phiên âm | C Nghĩa tiếng Anh | D Từ đồng nghĩa / gần nghĩa | E Đặt câu.
Cột E lưu tối đa 3 ví dụ của kết quả tra cứu hiện tại, kèm EN/VN nếu có. Không phải câu tự tạo. Khi chọn một mục từ liên quan trong danh sách, ví dụ vẫn thuộc từ bạn đã tra; hãy kiểm tra độ phù hợp.
Các trường không có dữ liệu được để trống. Wortfamilie không lưu vì mẫu chỉ có 5 cột.
So trùng theo từ ở cột A, không phân biệt hoa/thường và khoảng trắng thừa; giữ nguyên mạo từ. Từ trùng không thêm, không cập nhật nghĩa. Chặn bấm lặp và khóa ghi đồng thời. Nếu mạng lỗi sau khi ghi, bấm lại không thêm trùng.

## Kết nối một lần (không cần API key Google hoặc AI)
1. Mở file Google Sheets của bạn → chọn tab đích, ví dụ DE-CN → sao chép link đầy đủ có gid.
2. Hàng đầu A1:E1 cần đúng thứ tự:
   - Từ vựng
   - Phiên âm
   - Nghĩa tiếng Anh
   - Từ đồng nghĩa / gần nghĩa
   - Đặt câu
   Tab hoàn toàn trống sẽ được tạo hàng tiêu đề khi thêm từ đầu tiên. Các cột F trở đi không được ghi.
3. Vào Extensions / Tiện ích mở rộng → Apps Script. Dán nội dung file Code.gs (cùng thư mục với extension) vào Code.gs, lưu.
4. Project Settings (bánh răng) → Script properties → Add script property, thêm:
   - SPREADSHEET_ID: phần nằm giữa /d/ và /edit trong URL.
   - SHEET_GID: số gid của tab, trong mẫu của bạn là 800479445. Lấy số thực tế từ link, không dùng tên tab thay số.
   - SHARED_SECRET: tự tạo chuỗi ngẫu nhiên ít nhất 32 ký tự. Đây là khóa riêng cho Sheets, KHÔNG dùng token Faztaa. Có thể tạo bằng trình quản lý mật khẩu. Không chia sẻ khóa.
5. Deploy → New deployment → Web app:
   - Execute as: Me (tài khoản có quyền sửa file).
   - Who has access: Anyone.
   - Deploy, xác nhận quyền Google yêu cầu; chỉ tiếp tục nếu đó là project do chính bạn vừa tạo. Nếu tài khoản Workspace không cho chọn Anyone, quản trị viên cần cho phép hoặc cần phương án OAuth khác.
   Web app có thể nhận request công khai, nhưng mã chỉ cho phép ghi khi đúng khóa, đúng spreadsheet và đúng gid đã cấu hình. Không công khai hay chia sẻ file Sheets.
6. Sao chép Web app URL kết thúc /exec, không dùng /dev.
7. Cập nhật extension lên bản mới nhất: thay toàn bộ file trong thư mục extension cũ bằng file từ thư mục german-lookup mới → Reload extension → tải lại website.
8. Mở ⚙ extension. Điền Web App URL, Khóa kết nối Sheets, Link sheet và tab đích. Bấm Lưu cấu hình, cho phép hai tên miền Google Script.
9. Bấm **Kiểm tra sheet / tên tab**. Nút này KHÔNG ghi dòng thử, chỉ xác nhận kết nối và tên tab.
10. Tra một từ → bấm **＋ Thêm vào từ vựng**. Chỉ khi server xác nhận thành công mới hiện Đã thêm + tab + số dòng. Bạn có thể đổi tab bằng cách thay SHEET_GID trên server và link trong extension; bấm kiểm tra lại.

## Lưu ý
- Không gửi token Faztaa tới Google. Chỉ gửi khóa Sheets, ID đích và 5 ô của từ bạn chọn khi bấm Thêm. Không gửi toàn bộ trang hay nội dung chat.
- Khóa lưu ở trusted storage của extension, không đưa vào trang web. Xóa khóa hoặc đổi Script property để thu hồi kết nối.
- Apps Script có hạn mức Google và phụ thuộc quyền tài khoản; không có máy chủ trả phí riêng. Chỉ thêm cuối bảng, không xóa/sửa từ cũ.
- Lỗi HTTP hoặc phản hồi không phải JSON: kiểm tra deployment /exec, quyền Anyone, đã Lưu cấu hình và cấp quyền extension.
- Sửa mã Apps Script sau deploy: Deploy → Manage deployments → Edit → New version → Deploy.
- Ghi sai sheet/gid sẽ bị chặn. Sai hàng tiêu đề sẽ bị chặn trước khi thêm từ.
- Đã kiểm tra logic bằng mock, ánh xạ 5 cột, chống trùng, khóa kết nối và cú pháp; chưa triển khai trên tài khoản Google của bạn. ZIP không chứa kết nối đã hoạt động sẵn.
