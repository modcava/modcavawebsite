#!/usr/bin/env bash
# Deploy เว็บ Mocava เวอร์ชันใหม่ขึ้น production
# ใช้: ./deploy.sh   (หรือ  bash deploy.sh  /  sh deploy.sh)
#
# - ดึงโค้ดใหม่ → ติดตั้ง deps/push schema "เฉพาะเมื่อเปลี่ยน" → build → restart
# - หยุดทันทีถ้าขั้นใดล้มเหลว (set -e) จะไม่ restart ทับของเดิมจน 502
set -eu

# ทำงานในโฟลเดอร์ที่สคริปต์อยู่ เสมอ (รันจากที่ไหนก็ได้)
cd "$(dirname "$0")"

echo "==> [1/5] git pull"
before=$(git rev-parse HEAD 2>/dev/null || echo "none")
git pull
after=$(git rev-parse HEAD 2>/dev/null || echo "none")
changed=$(git diff --name-only "$before" "$after" 2>/dev/null || echo "")

# ติดตั้ง dependencies ใหม่เฉพาะเมื่อ package-lock.json เปลี่ยน (npm ci ช้า)
if echo "$changed" | grep -q "package-lock.json"; then
  echo "==> [2/5] npm ci  (lockfile เปลี่ยน)"
  npm ci
else
  echo "==> [2/5] ข้าม npm ci  (deps ไม่เปลี่ยน)"
fi

# Sync DB schema + regenerate Prisma Client ทุกครั้ง. กัน client เก่าไม่ตรง schema จน
# build พัง ("Property '...' does not exist") หรือ DB ขาดคอลัมน์จน runtime พัง.
# หมายเหตุ: `db push` จะ "ไม่" regenerate client เมื่อ DB sync อยู่แล้ว (เช่น push มือไปก่อน)
# และถ้า lockfile ไม่เปลี่ยน npm ci ก็ถูกข้าม (postinstall ไม่รัน) — จึง generate ตรงๆ เสมอ.
# Idempotent — ถ้าไม่มีอะไรเปลี่ยนจะเร็วมาก.
echo "==> [3/5] prisma db push + generate  (sync DB + regenerate client)"
npx prisma db push
npx prisma generate

echo "==> [4/5] build  (heap 3GB กัน OOM บน RAM 2GB)"
NODE_OPTIONS="--max-old-space-size=3072" npm run build

echo "==> [5/5] restart pm2"
pm2 restart mocava --update-env

echo ""
pm2 status
echo "✅ deploy สำเร็จ"
