# Cài đặt Moodle Kanban bằng Docker

Dự án bổ sung hoạt động Kanban và block Kanban Quick View (ButtonKB) cho Moodle. Môi trường Docker sử dụng Moodle 4.3.12, PHP 8.2 và MariaDB 10.11. Khi build, Docker đóng gói cả hai plugin vào image:

| Plugin | Mã trong dự án | Vị trí trong container Moodle |
|---|---|---|
| Kanban | `plugins/mod_kanban` | `/var/www/html/mod/kanban` |
| ButtonKB (Kanban Quick View) | `plugins/block_buttonkb` | `/var/www/html/blocks/buttonkb` |

Không cần tải riêng plugin lên giao diện Moodle. Các lệnh bên dưới dành cho PowerShell và được chạy tại **thư mục gốc của mã nguồn** (thư mục chứa `Dockerfile` và `docker-compose.yml`).

## Yêu cầu

- Docker Desktop đang chạy, có Docker Compose.
- Có kết nối Internet khi build lần đầu để tải Moodle và các Docker image.
- Cổng `8080` còn trống, hoặc chọn cổng khác trong `.env`.

Kiểm tra Docker Compose:

```powershell
docker compose version
```

Tải hoặc clone mã nguồn, rồi mở PowerShell tại thư mục gốc của dự án.

## Cài đặt lần đầu

Nếu chưa có `.env`, tạo file từ mẫu:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Mở `.env` và thay `MOODLE_DB_PASSWORD`, `MARIADB_ROOT_PASSWORD` bằng mật khẩu riêng. Mặc định website dùng `http://localhost:8080`; nếu đổi `MOODLE_HTTP_PORT`, cần đổi cả cổng trong `MOODLE_WWWROOT` cho khớp. File `.env` được giữ trên máy và không đưa lên Git.

Build và khởi động:

```powershell
docker compose up -d --build
docker compose ps
```

Lần build đầu có thể mất vài phút. Trong kết quả `docker compose ps`, `moodle` và `cron` cần ở trạng thái `Up`, còn `db` ở trạng thái `healthy`. Cron chạy tác vụ Moodle mỗi phút để gửi thông báo hạn công việc.

Mở `http://localhost:8080`, hoàn tất trình cài đặt Moodle và tạo tài khoản quản trị. Sau khi đăng nhập, vào **Site administration → Notifications** và hoàn tất cài đặt Kanban cùng ButtonKB nếu Moodle yêu cầu.

ButtonKB tự thêm block vào trang chủ và Dashboard mặc định khi được cài đặt.

## Chuyển dữ liệu từ Moodle cũ

1. Xuất database theo [hướng dẫn database](database/README.md).
2. Khởi động `db`, nhập bản sao database, rồi khởi động `moodle`.
3. Chỉ sao chép `moodledata` cũ nếu cần các file đã tải lên; không sao chép cache. Có thể dùng chức năng backup/restore của Moodle để chuyển nội dung khóa học.

Docker sử dụng `/var/moodledata` và địa chỉ mặc định `http://localhost:8080`. Không sao chép `config.php` của bản Moodle chạy trên Windows vào image.

## Chạy lại và cập nhật

Nếu site đã được cài trước đó, chỉ cần khởi động lại các container:

```powershell
docker compose up -d
```

Khi mã Kanban hoặc ButtonKB thay đổi, build lại image rồi chạy nâng cấp Moodle:

```powershell
docker compose up -d --build
docker compose exec moodle php admin/cli/upgrade.php --non-interactive
docker compose exec moodle php admin/cli/purge_caches.php
```

Xem trạng thái hoặc log:

```powershell
docker compose ps
docker compose logs --tail=100 moodle
docker compose logs --tail=100 db
docker compose logs --tail=100 cron
```

Dừng môi trường:

```powershell
docker compose down
```

Lệnh `docker compose down` giữ lại database và file tải lên trong Docker volumes. Lệnh `docker compose down -v` xóa các volumes này và làm mất dữ liệu Moodle.

## Thông báo và kiểm thử

Cron hỗ trợ thông báo nội bộ Moodle. Dự án chưa cấu hình gửi email hoặc push tới thiết bị di động. Kiểm tra cron bằng `docker compose logs cron`.

Sau khi cài đặt hoặc nhập dữ liệu Moodle, có thể chạy PHPUnit và Behat:

```powershell
docker compose exec moodle php admin/tool/phpunit/cli/init.php
docker compose exec moodle php vendor/bin/phpunit --testsuite mod_kanban_testsuite

docker compose --profile test up -d selenium
docker compose exec moodle php admin/tool/behat/cli/init.php --disable-composer
docker compose exec moodle php admin/tool/behat/cli/run.php --profile=chrome --feature=/var/www/html/mod/kanban/tests/behat/mod_kanban.feature
```

## Xử lý sự cố thường gặp

| Hiện tượng | Cách kiểm tra |
|---|---|
| Không mở được website | Chạy `docker compose ps`, kiểm tra container `moodle` và cổng trong `.env`. |
| Database chưa sẵn sàng | Chạy `docker compose logs --tail=100 db`. Nếu database đã có dữ liệu, giữ nguyên mật khẩu đã dùng khi tạo volume. |
| Không thấy Kanban trong danh sách hoạt động | Vào **Site administration → Notifications** và hoàn tất cài đặt plugin. |
| Không thấy ButtonKB | Mở Dashboard hoặc trang chủ, kiểm tra Notifications, chạy `docker compose exec moodle php admin/cli/purge_caches.php` rồi tải lại trang. |
