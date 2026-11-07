# Moodle Kanban - Docker

This setup runs Moodle, Apache/PHP 8.2, MariaDB 10.11, and (optionally) Selenium entirely in Docker. XAMPP is not required.

The image includes the custom Kanban activity and Kanban quick view (ButtonKB) block from `plugins/`. Moodle installs or upgrades them from **Site administration -> Notifications** after the first start.
Moodle cron runs in the `cron` service, enabling internal deadline notifications.

## Start a fresh site

```powershell
Copy-Item .env.example .env
# Edit .env and replace both password values.
docker compose up -d --build
```

Open `http://localhost:8080` and complete Moodle's web installer. The Docker config already selects database host `db`, database `moodle`, and the credentials from `.env`.

## Migrate an existing site

1. Export the existing database as described in [database/README.md](database/README.md).
2. Start `db`, import the dump, then start `moodle`.
3. Copy the old `moodledata` only if its files are required. Never copy caches; use Moodle's backup/restore for course content where possible.

The Docker Moodle config uses `/var/moodledata` and `http://localhost:8080`. Do not copy the Windows `config.php` into the image.

## Notification scope

This project uses Moodle internal notifications only. Email and mobile push delivery are outside its scope. Check cron with `docker compose ps` or `docker compose logs cron`.

## Testing

After the web installer or import has completed:

```powershell
docker compose exec moodle php admin/tool/phpunit/cli/init.php
docker compose exec moodle php vendor/bin/phpunit --testsuite mod_kanban_testsuite

docker compose --profile test up -d selenium
docker compose exec moodle php admin/tool/behat/cli/init.php --disable-composer
docker compose exec moodle php admin/tool/behat/cli/run.php --profile=chrome --feature=/var/www/html/mod/kanban/tests/behat/mod_kanban.feature
```

## Stop and reset

```powershell
docker compose down
```

`docker compose down` retains named volumes. To permanently remove Docker database and uploaded-file volumes, run `docker compose down -v` only when those data are no longer needed.
