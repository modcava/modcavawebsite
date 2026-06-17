#!/usr/bin/env bash
# Backup ฐานข้อมูล MySQL ของ Mocava → ~/backups (เก็บย้อนหลัง 14 วัน)
# ใช้: ./backup.sh   · ตั้ง cron รายวันดูท้ายไฟล์ / DEPLOY.md ข้อ 15
set -eu

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$PROJECT_DIR/.env"
BACKUP_DIR="$HOME/backups"
mkdir -p "$BACKUP_DIR"

# อ่านค่า DB จาก .env (ตัด " และ ' ออก)
get_env() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\042\047'; }
DB_USER=$(get_env MYSQL_USER)
DB_PASS=$(get_env MYSQL_PASSWORD)
DB_NAME=$(get_env MYSQL_DATABASE)

if [ -z "$DB_USER" ] || [ -z "$DB_PASS" ] || [ -z "$DB_NAME" ]; then
  echo "❌ อ่านค่า MYSQL_* จาก $ENV_FILE ไม่ครบ" >&2
  exit 1
fi

STAMP=$(date +%Y%m%d-%H%M%S)
OUT="$BACKUP_DIR/mocava_${STAMP}.sql.gz"

docker exec -e MYSQL_PWD="$DB_PASS" mocava_mysql \
  mysqldump --no-tablespaces --single-transaction -u "$DB_USER" "$DB_NAME" \
  | gzip > "$OUT"

# ถ้าไฟล์ออกมาว่าง (เช่น รหัสผิด/DB ไม่ขึ้น) ถือว่าล้มเหลว
if [ ! -s "$OUT" ]; then
  echo "❌ backup ว่างเปล่า — ตรวจรหัส DB / docker" >&2
  rm -f "$OUT"
  exit 1
fi

echo "✅ backup: $OUT ($(du -h "$OUT" | cut -f1))"

# ลบ backup เก่ากว่า 14 วัน
find "$BACKUP_DIR" -name 'mocava_*.sql.gz' -mtime +14 -delete
