-- Mocava / Modcava — initial DB bootstrap
--
-- Runs ONCE when the MySQL container is first created (empty data dir).
-- For existing containers, see `npm run db:bootstrap` which is idempotent.
--
-- Creates two databases:
--   mocava_db       — production / main store data
--   mocava_db_test  — test/staging copy (safe to wipe & reseed)
--
-- The MYSQL_USER from docker-compose env is auto-granted on MYSQL_DATABASE
-- (mocava_db). We explicitly grant the same user on the test DB below.

CREATE DATABASE IF NOT EXISTS mocava_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS mocava_db_test
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Grant the application user on both DBs. Docker's MYSQL_USER vars only
-- grant on MYSQL_DATABASE; the test DB needs an explicit grant.
GRANT ALL PRIVILEGES ON mocava_db.*      TO 'mocava_user'@'%';
GRANT ALL PRIVILEGES ON mocava_db_test.* TO 'mocava_user'@'%';
FLUSH PRIVILEGES;
