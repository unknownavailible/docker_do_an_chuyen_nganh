# Hướng dẫn kiểm thử Kanban trên Docker

Tài liệu này dùng cho môi trường trong `docker-compose.yml`: Moodle 4.3.12, plugin `mod_kanban`, block `block_buttonkb`, MariaDB và dịch vụ `cron`. Chạy các lệnh PowerShell tại thư mục gốc dự án (nơi có `docker-compose.yml`).

## 1. Kiểm tra môi trường

```powershell
docker compose up -d
docker compose ps
```

`moodle` và `cron` cần ở trạng thái `Up`; `db` cần ở trạng thái `healthy`. Mở URL trong `MOODLE_WWWROOT` của file `.env` (mặc định là `http://localhost:8080`) và xác nhận đã cài Kanban qua **Site administration → Notifications**.

## 2. PHPUnit: kiểm tra API, quyền và dữ liệu

Khởi tạo bộ bảng kiểm thử với tiền tố riêng sau lần cài đầu hoặc sau khi tạo lại container Moodle từ image mới:

```powershell
docker compose exec -T moodle php admin/tool/phpunit/cli/init.php
```

Chạy toàn bộ suite Kanban:

```powershell
docker compose exec -T moodle php vendor/bin/phpunit --testsuite mod_kanban_testsuite
```

Chạy riêng nhóm kiểm tra WIP khi cần:

```powershell
docker compose exec -T moodle php vendor/bin/phpunit --testsuite mod_kanban_testsuite --filter test_wip_limit
```

Kết quả được xác nhận trên image Docker hiện tại: **20 tests, 100 assertions, PASS**. Suite bao gồm quyền nhóm, tạo/di chuyển card, WIP, file đính kèm, Assignment, Privacy API và thông báo. Kết quả của một lần chạy mới phải được đọc từ dòng `OK (...)` và mã thoát `0`; số liệu trên là mốc tham chiếu, không thay thế lần kiểm thử mới.

## 3. Behat: kiểm tra hành vi giao diện

Khởi động Selenium Chrome và tạo site Behat riêng:

```powershell
docker compose --profile test up -d selenium
docker compose exec -T moodle php admin/tool/behat/cli/init.php --disable-composer
```

Chạy bốn kịch bản của Kanban:

```powershell
docker compose exec -T moodle php admin/tool/behat/cli/run.php --profile=chrome --feature=/var/www/html/mod/kanban/tests/behat/mod_kanban.feature
```

Các kịch bản kiểm tra quyền Group A/B, di chuyển card, giới hạn WIP và thao tác của giảng viên. Kết quả được xác nhận trên image Docker hiện tại: **4 scenarios, 22 steps, PASS**. Sau khi chạy xong, dừng Selenium để tiết kiệm tài nguyên:

```powershell
docker compose --profile test stop selenium
```

PHPUnit và Behat dùng tiền tố database và thư mục dữ liệu riêng với site chính. Không dùng `docker compose down -v` để dọn test vì lệnh đó cũng xóa dữ liệu Moodle chính.

## 4. Thử thông báo card gần tới hạn

Thông báo **“Cảnh báo hạn hoàn thành Kanban”** được gửi tới người được giao card khi tất cả điều kiện sau đúng:

- Đã bật thông báo Kanban trong **Site administration → Plugins → Activity modules → Kanban**.
- Card có người được giao, có hạn hoàn thành, còn ở cột chưa hoàn tất.
- Thời điểm chạy tác vụ còn **không quá 48 giờ** tới hạn, hoặc card đã quá hạn.
- Card chưa có lịch sử ghi nhận loại thông báo đó. Mỗi loại cảnh báo chỉ gửi một lần cho mỗi card.

Cách thử trên site QA đã tạo:

1. Đăng nhập tài khoản giảng viên `teacher1`, mở `Kanban QA Board` trong khóa học `Kanban QA`.
2. Chọn **Group A**, sửa thẻ `QA Group A - prepare report`; đặt **Hạn hoàn thành** vào ngày mai và giữ người được giao là `hocsinh1`. Để thẻ ở cột **To Do** hoặc **In Progress**.
3. Lưu thẻ. Việc sửa thẻ có thể gửi ngay thông báo **cập nhật công việc**; đây không phải cảnh báo gần hạn.
4. Chờ lần chạy kế tiếp của tác vụ (mục 5), hoặc chạy thủ công:

```powershell
docker compose exec -T moodle php admin/cli/scheduled_task.php '--execute=\mod_kanban\task\deadline_notifications'
```

5. Đăng nhập bằng `hocsinh1`, tải lại trang và mở **chuông thông báo** ở đầu trang Moodle. Tìm **“Cảnh báo hạn hoàn thành Kanban”** và tên card. Thẻ của Group B được giao cho `hocsinh3` nếu muốn thử với nhóm thứ hai.

Tài khoản QA dùng địa chỉ `example.invalid`, nên kiểm tra thông báo **trong Moodle**; email sẽ không tới hộp thư thật. Nếu muốn thử lại cùng loại cảnh báo, hãy tạo card mới: chỉ sửa hạn của card đã được cảnh báo sẽ không gửi lại cảnh báo đó.

## 5. Biết khi nào thông báo sẽ xuất hiện

Tác vụ `\mod_kanban\task\deadline_notifications` được lên lịch mỗi **15 phút**; dịch vụ `cron` kiểm tra tác vụ Moodle mỗi phút. Với một card có hạn `D`, cửa sổ cảnh báo gần hạn bắt đầu tại **`D - 48 giờ`**. Thông báo được gửi ở lần chạy tác vụ đầu tiên sau khi card bước vào cửa sổ này. Nếu đặt hạn vào ngày mai, card đã ở trong cửa sổ 48 giờ và thông báo sẽ tới ở lần chạy kế tiếp; thời gian chờ thường không quá khoảng 15 phút khi cron hoạt động bình thường.

Quản trị viên có thể xem **Last run** và **Next run** tại **Site administration → Server → Tasks → Scheduled tasks**, tìm tác vụ “Send Kanban deadline notifications”. Hoặc dùng PowerShell:

```powershell
docker compose exec -T moodle php admin/cli/scheduled_task.php --list | Select-String 'mod_kanban'
docker compose logs --tail=50 cron
```

Container hiện dùng giờ **UTC** trong log/CLI; Việt Nam (UTC+7) cộng thêm 7 giờ. Giờ trên giao diện Moodle có thể theo múi giờ tài khoản. Khi cron chạy đúng, log có dòng `Cron run completed correctly`. Dòng `Scheduled task complete` chỉ chứng minh tác vụ đã chạy; cần kiểm tra chuông của người nhận để xác nhận thông báo đã xuất hiện.

Ngoài cảnh báo 48 giờ cho người được giao, Kanban còn có nhắc **tiến độ giữa chặng** cho nhóm khi card ở In Progress và đã qua nửa khoảng thời gian từ lúc tạo tới hạn, và nhắc **gấp** khi còn không quá 10% khoảng thời gian đó. Các nhắc này phụ thuộc điều kiện của card và nhóm, nên có thể không xuất hiện cùng lúc với cảnh báo 48 giờ.

## 6. Nếu chưa thấy thông báo

1. Kiểm tra card còn người được giao, chưa ở cột Done và hạn nằm trong 48 giờ tới.
2. Kiểm tra cài đặt thông báo Kanban và **Notification preferences** của tài khoản người nhận; bật thông báo trên web cho Kanban.
3. Kiểm tra `docker compose ps` và `docker compose logs --tail=50 cron`.
4. Chạy thủ công tác vụ ở mục 4, tải lại Moodle rồi mở chuông.
5. Nếu card đã từng nhận cảnh báo gần hạn, tạo card mới để thử lại.
