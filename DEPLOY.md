# คู่มือ Deploy เว็บ Mocava บน Ubuntu 24.04 LTS (x64)

คู่มือนี้พา deploy เว็บ (Next.js 14 + MySQL 8 + Prisma + NextAuth) ขึ้น VPS/Server จริง
พร้อม Nginx + HTTPS (Let's Encrypt) + PM2 + ระบบ cron ยกเลิกออเดอร์ค้างชำระอัตโนมัติ

> เปลี่ยน `yourdomain.com` เป็นโดเมนจริงของคุณทุกที่ และตั้งรหัสผ่านให้แข็งแรง

---

## 0. ภาพรวมสถาปัตยกรรมบน production

```
อินเทอร์เน็ต ──HTTPS──> Nginx (80/443) ──proxy──> Next.js (next start, :3000)  [จัดการโดย PM2]
                                                          │
                                                          └──> MySQL 8.0 (Docker, :3306)
cron ──> /api/cron/cancel-unpaid-orders (15 นาที) · release-notify (5 นาที) · expire-points (รายวัน)
```

ข้อเท็จจริงของโปรเจกต์:
- **Next.js 14.2.5** — build ด้วย `npm run build`, รันด้วย `npm run start` (พอร์ต 3000)
- **MySQL 8.0** ผ่าน Docker Compose (มี `docker-compose.yml` อยู่แล้ว)
- ใช้ **`prisma db push`** ซิงค์ schema (โปรเจกต์นี้ยังไม่มี migration files)
- ไฟล์สลิปการโอนถูกเก็บที่ `public/slips/` — ต้อง persist
- ใช้ Google OAuth (ล็อกอิน) + Gmail API (ส่งอีเมล) — ต้องตั้ง redirect URI สำหรับโดเมนจริง

---

## 1. สิ่งที่ต้องเตรียม
- VPS/Server **Ubuntu 24.04 LTS x64** (แนะนำ RAM ≥ 2GB; ถ้า 1GB ให้เพิ่ม swap ในขั้นตอนที่ 2.4)
- **โดเมน** เช่น `yourdomain.com` + ตั้ง DNS **A record** ชี้มาที่ IP ของ server (รวม `www`)
- เข้า SSH ได้ (ผู้ใช้ root หรือ sudo)
- โค้ดโปรเจกต์ (โฟลเดอร์ `mocava`) + ไฟล์ `backups/mocava_db_clean_*.sql` (ฐานข้อมูลสะอาด: 6 หมวด + 2 admin)

---

## 2. เตรียม Server

### 2.1 อัปเดตระบบ + timezone
```bash
sudo apt update && sudo apt -y upgrade
sudo timedatectl set-timezone Asia/Bangkok
```

### 2.2 สร้างผู้ใช้ (ถ้ายังใช้ root อยู่)
```bash
sudo adduser deploy
sudo usermod -aG sudo deploy
# จากนี้ทำงานในนาม deploy:  su - deploy
```

### 2.3 ตั้งไฟร์วอลล์ (เปิดเฉพาะ SSH/HTTP/HTTPS)
```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status
```
> ⚠️ **ห้ามเปิดพอร์ต 3306 (MySQL) และ 3000 (Next.js) ออกสู่ภายนอก** — เข้าผ่าน Nginx เท่านั้น

### 2.4 (RAM ≤ 2GB) เพิ่ม swap 4GB กัน build แล้ว OOM — **จำเป็น**
> ⚠️ พิสูจน์แล้วว่า RAM 2GB (เช่น VPS 1.9GB) ที่ **ไม่มี swap จะ build ไม่ผ่าน** — Next.js
> peak ทะลุ RAM ตอนช่วง "Linting and checking validity of types" แล้วโดน OOM kill
> (อาการ: `Killed` เฉยๆ หรือ `FATAL ERROR: Reached heap limit Allocation failed`)
> RAM 1GB ก็ใช้คำสั่งชุดนี้ได้เช่นกัน

```bash
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h    # ต้องเห็น Swap: 4.0Gi
```
> ถ้าเคยสร้าง swapfile 2GB ไว้แล้วต้องการขยายเป็น 4GB: `sudo swapoff /swapfile` ก่อน แล้วรันชุดข้างบนซ้ำ (บรรทัด `/etc/fstab` ไม่ต้องเพิ่มซ้ำ)

---

## 3. ติดตั้ง Node.js 20 LTS
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # ควรเป็น v20.x
npm -v
```

---

## 4. ติดตั้ง Docker + Docker Compose (สำหรับ MySQL)
```bash
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER     # ใช้ docker ได้โดยไม่ต้อง sudo (ต้อง logout/login ใหม่)
```
> ออกจาก SSH แล้วเข้าใหม่ เพื่อให้สิทธิ์ docker มีผล

---

## 5. อัปโหลดโค้ดขึ้น Server

**ทางเลือก A — ผ่าน Git** (แนะนำ)
```bash
cd ~
git clone https://github.com/modcava/modcavawebsite.git mocava
cd mocava
```

**ทางเลือก B — อัปโหลดจากเครื่องตัวเอง** (รันบนเครื่อง Windows ของคุณ)
```powershell
# ส่งทั้งโฟลเดอร์ mocava (ยกเว้น node_modules / .next) ขึ้น server
scp -r "E:\ร้าน\Web Store\mocava" deploy@<SERVER_IP>:~/mocava
```
> ถ้าใช้ B ให้ลบ `node_modules` กับ `.next` บนเครื่องก่อนส่ง เพื่อให้เร็วและสะอาด (จะ build ใหม่บน server)

---

## 6. ตั้งค่า Environment (`.env`)

สร้างไฟล์ `~/mocava/.env` (ดูรายการตัวแปรครบจาก `.env` เดิม):

```bash
cd ~/mocava
nano .env
```

ใส่ค่าต่อไปนี้ (ปรับเป็นของคุณ):

```dotenv
# ── App ───────────────────────────────────────────────
NODE_ENV=production
NEXT_PUBLIC_APP_NAME=Modcava
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXTAUTH_URL=https://yourdomain.com
# สร้างด้วย: openssl rand -base64 32
NEXTAUTH_SECRET=<ค่าสุ่มยาวๆ>

# ── Database (MySQL ใน Docker ที่ localhost) ──────────
DB_ENV=prod
MYSQL_ROOT_PASSWORD=<รหัส root ที่แข็งแรง>
MYSQL_DATABASE=mocava_db
MYSQL_USER=mocava_user
MYSQL_PASSWORD=<รหัส user ที่แข็งแรง>
DATABASE_URL="mysql://mocava_user:<รหัส user>@localhost:3306/mocava_db"
DATABASE_URL_PROD="mysql://mocava_user:<รหัส user>@localhost:3306/mocava_db"
DATABASE_URL_TEST="mysql://mocava_user:<รหัส user>@localhost:3306/mocava_db_test"

# ── Google OAuth (ล็อกอินด้วย Google) ────────────────
GOOGLE_CLIENT_ID=<จาก Google Cloud Console>
GOOGLE_CLIENT_SECRET=<จาก Google Cloud Console>

# ── Gmail API (ส่งอีเมลในนามร้าน) ────────────────────
GMAIL_CLIENT_ID=<...>
GMAIL_CLIENT_SECRET=<...>
GMAIL_SENDER_EMAIL=<อีเมลร้านที่ส่งจาก>

# ── SMTP (อีเมล verify/reset password) ───────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<อีเมล>
SMTP_PASS=<app password>
SMTP_FROM="Modcava <no-reply@yourdomain.com>"

# ── Cron (ยกเลิกออเดอร์ค้างชำระ) ─────────────────────
# สร้างด้วย: openssl rand -hex 24
CRON_SECRET=<ค่าสุ่ม>
```

สร้างค่าสุ่ม:
```bash
openssl rand -base64 32   # ใช้กับ NEXTAUTH_SECRET
openssl rand -hex 24      # ใช้กับ CRON_SECRET
```

> 🔒 ตั้งสิทธิ์ไฟล์: `chmod 600 .env`

---

## 7. เริ่ม MySQL + ตั้งฐานข้อมูล

### 7.1 รัน MySQL container
```bash
cd ~/mocava
docker compose up -d           # อ่านค่า MYSQL_* จาก .env อัตโนมัติ
docker compose ps              # ควรเห็น mocava_mysql เป็น healthy
```

### 7.2 ใส่ข้อมูลเริ่มต้น — เลือก 1 ทาง

**ทาง A (แนะนำ): กู้คืนฐานข้อมูลสะอาด** (ได้ 6 หมวด + 2 บัญชี admin พร้อมใช้)
อัปโหลดไฟล์ `backups/mocava_db_clean_*.sql` ขึ้น server แล้ว (ต้อง `docker compose up -d` ให้ DB `mocava_db` ถูกสร้างก่อน):
```bash
# ดูชื่อไฟล์ dump ที่อัปโหลดมา
ls ~/mocava/backups/

# กู้คืน — ไฟล์ dump มีทั้ง CREATE TABLE + ข้อมูล อยู่ในไฟล์เดียว (สร้างตาราง+ใส่ข้อมูลทีเดียว)
# เปลี่ยนชื่อไฟล์ตามที่ ls เจอ และใส่รหัส mocava_user (= MYSQL_PASSWORD ใน .env)
{ echo "SET FOREIGN_KEY_CHECKS=0;"; cat ~/mocava/backups/mocava_db_clean_XXXXXXXX.sql; } \
  | docker exec -i -e MYSQL_PWD='<รหัสผ่าน_mocava_user>' mocava_mysql \
    mysql -u mocava_user mocava_db
```

**ทาง B: เริ่มจากศูนย์** (push schema เปล่าๆ แล้วค่อยสร้าง admin/หมวดเอง)
```bash
npm ci
npx prisma db push          # สร้างตารางตาม schema
npm run db:seed             # สร้าง 6 หมวด (⚠️ seed สร้างสินค้าตัวอย่างด้วย — ลบทีหลังได้)
```

> หลัง restore: ล็อกอิน admin ด้วยบัญชีเดิม (`admin@mocava.com` / `modcava@gmail.com`)
> ถ้าจำรหัสไม่ได้ ดูวิธีรีเซ็ตในหัวข้อ Troubleshooting

---

## 8. ติดตั้ง dependencies + Build
```bash
cd ~/mocava
npm ci                       # ติดตั้งครบ (postinstall จะรัน prisma generate ให้)
npx prisma db push           # ยืนยัน schema ตรงกับ DB (ถ้าใช้ทาง 7.2-A ก็รันซ้ำได้ ไม่เสียหาย)

# build production (.next) — บน RAM ≤ 2GB ต้องตั้ง NODE_OPTIONS ยกเพดาน heap
# ให้ V8 spill ลง swap ได้ (ต้องทำขั้นตอน 2.4 เพิ่ม swap 4GB ก่อน) ไม่งั้น OOM
NODE_OPTIONS="--max-old-space-size=3072" npm run build
```
> **อย่าตั้ง `--max-old-space-size` ต่ำกว่า RAM ที่มี** (เช่น 1536) — นั่นคือการตั้ง *เพดาน* heap
> ของ V8 พอ type-check ใช้เกินจะ kill ตัวเองทันที และ swap ช่วยไม่ได้เลย ต้องตั้งให้ **สูงกว่า**
> RAM จริงเพื่อบังคับให้ไหลลง swap (3072 = 3GB เหมาะกับ swap 4GB)
>
> build สำเร็จเมื่อเห็น `✓ Compiled successfully` + ตาราง route — ช่วง type-check จะช้า
> (ใช้ swap) รอ 5-10 นาทีบนเครื่อง RAM 2GB ถือว่าปกติ อย่ากด Ctrl+C ระหว่างทาง

---

## 9. รันแอปด้วย PM2 (ให้รันค้างตลอด + auto-start)
```bash
sudo npm install -g pm2
cd ~/mocava
pm2 start npm --name mocava -- run start    # = next start (พอร์ต 3000)
pm2 save
pm2 startup systemd                          # ก๊อปคำสั่งที่มันพิมพ์ออกมาไปรัน (ตั้ง auto-start ตอน reboot)
pm2 status
pm2 logs mocava --lines 50                   # ดู log
```
ทดสอบในเครื่อง: `curl -I http://localhost:3000` ควรได้ `200`

---

## 10. Nginx Reverse Proxy
```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/mocava
```
ใส่ (เปลี่ยน `/home/ubuntu` เป็น home ของ user จริง):
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    client_max_body_size 10M;   # รองรับอัปโหลดสลิป/รูปสินค้า (จำกัด 10MB ในแอป)

    # ── รูปสินค้า: เสิร์ฟตรงจากดิสก์ (สาธารณะได้) ────────────────────
    # ⚠️ จำเป็น: `next start` เสิร์ฟเฉพาะไฟล์ใน public/ ที่มี "ตอน build" เท่านั้น
    # รูปสินค้า (public/uploads/) ถูกเขียน "หลัง build" — ถ้าไม่มี block นี้รูปจะ 404
    location /uploads/ {
        root /home/ubuntu/mocava/public;
        access_log off;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
    }
    # ── สลิปการโอน: ห้ามเข้าถึงตรงๆ (ข้อมูลการเงินลูกค้า / PDPA) ──────
    # เข้าผ่าน /api/slips/<file> ที่เช็คสิทธิ์เท่านั้น — บล็อก path เดิม /slips/
    location /slips/ {
        return 403;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```
> ใช้ `root .../public` (ไม่ใช่ `alias`) — request `/uploads/x.webp` จะชี้ไป `.../public/uploads/x.webp` พอดี และเลี่ยงบั๊ก `try_files`+`alias`

เปิดใช้งาน:
```bash
sudo ln -s /etc/nginx/sites-available/mocava /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```
> `X-Forwarded-For` สำคัญ — แอปใช้ดู IP จริงสำหรับ rate-limit/audit log
>
> ⚠️ **อย่าเซฟไฟล์ backup (.bak) ไว้ใน `/etc/nginx/sites-enabled/`** — nginx โหลด *ทุกไฟล์*
> ในโฟลเดอร์นี้ไม่สนนามสกุล จะได้ warning `conflicting server name` เก็บ backup ไว้ที่อื่น เช่น home dir

---

## 11. ติดตั้ง HTTPS ฟรี (Let's Encrypt)
> DNS ต้องชี้มาที่ server เรียบร้อยก่อน
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
# เลือก redirect HTTP → HTTPS เมื่อถาม
sudo certbot renew --dry-run     # ทดสอบต่ออายุอัตโนมัติ (certbot ตั้ง timer ให้แล้ว)
```

---

## 12. ตั้ง Cron งานเบื้องหลัง (ใช้ `CRON_SECRET`)
```bash
crontab -e
```
เพิ่ม 3 บรรทัด (เปลี่ยน `<CRON_SECRET>` เป็นค่าใน `.env`):
```cron
# ยกเลิกออเดอร์ไม่แนบสลิปภายใน 48 ชม. — ทุก 15 นาที
*/15 * * * * curl -fsS -X POST -H "Authorization: Bearer <CRON_SECRET>" https://yourdomain.com/api/cron/cancel-unpaid-orders >> /var/log/mocava-cron.log 2>&1
# แจ้งเตือน "สินค้าวางจำหน่าย/กลับมามีของ" (เมลถึงลูกค้าที่กด 🔔) — ทุก 5 นาที
*/5 * * * * curl -fsS -H "Authorization: Bearer <CRON_SECRET>" https://yourdomain.com/api/cron/release-notify >> /var/log/mocava-cron.log 2>&1
# หมดอายุแต้มสะสมเกิน 12 เดือน — วันละครั้งตี 4
0 4 * * * curl -fsS -H "Authorization: Bearer <CRON_SECRET>" https://yourdomain.com/api/cron/expire-points >> /var/log/mocava-cron.log 2>&1
```
> ⚠️ **`release-notify` จำเป็นต่อเมล "วางจำหน่ายเร็วๆ นี้"** — สินค้าที่ตั้ง `releaseAt` จะกลายเป็นขายได้เพราะ *เวลาผ่านไป* ไม่มี admin edit มาจุดชนวน ถ้าไม่ตั้ง cron นี้ ลูกค้าที่กด 🔔 จะ **ไม่ได้เมล** เมื่อถึงเวลาวางขาย

ทดสอบยิงเอง 1 ครั้ง (ควรได้ `{"ok":true,...}`):
```bash
curl -X POST -H "Authorization: Bearer <CRON_SECRET>" https://yourdomain.com/api/cron/cancel-unpaid-orders   # {"ok":true,"cancelled":N}
curl       -H "Authorization: Bearer <CRON_SECRET>" https://yourdomain.com/api/cron/release-notify           # {"ok":true,"products":N,"sent":M}
```

---

## 13. ตั้งค่า Google OAuth + Gmail สำหรับโดเมนจริง
ไปที่ **Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client**:

- **Authorized JavaScript origins:** `https://yourdomain.com`
- **Authorized redirect URIs** (เพิ่มทั้ง 2):
  - `https://yourdomain.com/api/auth/callback/google`  ← ล็อกอินลูกค้า
  - `https://yourdomain.com/api/admin/gmail-callback`   ← เชื่อม Gmail สำหรับส่งอีเมล

จากนั้น **เข้า admin → กด Authorize Gmail ใหม่** บนโดเมนจริง (token เดิมใช้กับ localhost เท่านั้น)
> อีเมลร้าน (ยืนยันออเดอร์/แจ้งของเข้า/แจ้งยกเลิก) จะส่งได้ต่อเมื่อ Authorize Gmail บน production แล้ว

---

## 14. ไฟล์อัปโหลด (สลิปการโอน + รูปสินค้า) ให้ persist
- สลิปเก็บที่ `~/mocava/public/slips/` · รูปสินค้าเก็บที่ `~/mocava/public/uploads/`
- **รูปสินค้า** เสิร์ฟผ่าน Nginx โดยตรง (สาธารณะได้) — ดูข้อ 10
- **สลิปการโอน** ⚠️ เป็นข้อมูลการเงินลูกค้า เสิร์ฟผ่าน route `/api/slips/<file>` ที่เช็คสิทธิ์
  (เจ้าของออเดอร์/แอดมินเท่านั้น) — path เดิม `/slips/` ถูก Nginx บล็อก `return 403` (ดูข้อ 10)
- **ตอนอัปเดตเว็บภายหลัง อย่าลบ 2 โฟลเดอร์นี้** (ข้อมูลลูกค้า + รูปสินค้าอยู่ในนั้น)
- รวม 2 โฟลเดอร์นี้ไว้ในการ backup ด้วย
```bash
mkdir -p ~/mocava/public/slips ~/mocava/public/uploads
```

---

## 15. ตั้ง Backup ฐานข้อมูลอัตโนมัติ (รายวัน)

**วิธีที่แนะนำ — ใช้สคริปต์ `backup.sh`** (อยู่ใน repo, อ่านรหัส DB จาก `.env` เอง ไม่ต้องฮาร์ดโค้ด):
```bash
chmod +x ~/mocava/backup.sh
~/mocava/backup.sh            # ทดสอบรันครั้งแรก — ควรได้ ✅ backup: ... .sql.gz
```
ตั้ง cron รายวันตี 3:
```bash
crontab -e
```
เพิ่มบรรทัด:
```cron
0 3 * * * /home/ubuntu/mocava/backup.sh >> /home/ubuntu/backups/backup.log 2>&1
```
> สคริปต์เก็บไฟล์ใน `~/backups/` ลบอัตโนมัติเมื่อเกิน 14 วัน และจะ **ออก error ถ้า backup ว่างเปล่า**
> (รหัสผิด/DB ไม่ขึ้น) จะได้รู้ว่าล้มเหลว · กู้คืน: `gunzip < ~/backups/mocava_XXX.sql.gz | docker exec -i -e MYSQL_PWD='<รหัส>' mocava_mysql mysql -u mocava_user mocava_db`

**วิธีแมนนวล** (ดัมป์ทีเดียว ไม่ใช้สคริปต์):
```cron
0 3 * * * docker exec -e MYSQL_PWD='<รหัส user>' mocava_mysql mysqldump --no-tablespaces --single-transaction -u mocava_user mocava_db | gzip > ~/backups/mocava_$(date +\%Y\%m\%d).sql.gz 2>>~/backups/backup.log; find ~/backups -name 'mocava_*.sql.gz' -mtime +14 -delete
```

---

## 16. การอัปเดตเว็บภายหลัง (deploy เวอร์ชันใหม่)

**วิธีที่แนะนำ — ใช้สคริปต์ `deploy.sh`** (อยู่ใน repo แล้ว):
```bash
~/mocava/deploy.sh
```
สคริปต์จัดการให้ครบในคำสั่งเดียว: `git pull` → `npm ci`/`prisma db push` **เฉพาะเมื่อ
`package-lock.json`/`schema.prisma` เปลี่ยน** (ข้ามถ้าไม่เปลี่ยน ทำให้เร็วขึ้นมาก) → build
ด้วย heap 3GB → `pm2 restart` และ **`set -e` หยุดทันทีถ้า build ล้ม จึงไม่ restart ทับจน 502**

> ครั้งแรกต้องตั้งสิทธิ์รันก่อน: `chmod +x ~/mocava/deploy.sh`
> ถ้าเจอ `bad interpreter ...^M` (Windows line-ending) แก้: `sed -i 's/\r$//' ~/mocava/deploy.sh`

**วิธีแมนนวล** (เผื่ออัปโหลดไฟล์เองด้วย scp แทน git, หรือ debug ทีละขั้น):
```bash
cd ~/mocava
git pull                 # หรืออัปโหลดไฟล์ใหม่ทับ (ยกเว้น .env, public/slips, public/uploads)
npm ci                   # เฉพาะเมื่อ dependencies เปลี่ยน
npx prisma db push       # เฉพาะเมื่อแก้ schema
NODE_OPTIONS="--max-old-space-size=3072" npm run build   # RAM ≤ 2GB ต้องตั้ง heap (ดูข้อ 8)
pm2 restart mocava
pm2 logs mocava --lines 50
```
> ⚠️ **อย่ารัน `pm2 restart mocava` ถ้า `npm run build` ยังไม่สำเร็จ** — ถ้า build พังกลางคัน
> `.next` จะไม่สมบูรณ์ (ไม่มี `.next/BUILD_ID`) ทำให้ `next start` ตาย → **502 Bad Gateway**
> เช็คก่อน restart เสมอ: `ls .next/BUILD_ID` ต้องมีไฟล์

---

## 17. Checklist หลัง deploy
- [ ] `https://yourdomain.com` เปิดได้ มีกุญแจ HTTPS
- [ ] ล็อกอิน admin ได้ → เพิ่มสินค้าได้
- [ ] ล็อกอินด้วย Google ได้ (redirect URI ถูก)
- [ ] สั่งซื้อ → อัปโหลดสลิปได้ → ไฟล์อยู่ใน `public/slips/`
- [ ] เพิ่มสินค้า + อัปโหลดรูป → **รูปขึ้นจริงในหน้าเว็บ** (`curl -sI https://yourdomain.com/uploads/<ไฟล์> ` ได้ 200)
- [ ] ตั้ง crontab ครบ 3 ตัว (cancel-unpaid-orders, **release-notify**, expire-points) + ยิงเองได้ `{"ok":true}`
- [ ] ทดสอบเมล "วางจำหน่าย": ตั้งสินค้า `releaseAt` อดีต + มี subscriber → ยิง `release-notify` → ได้ `sent>0`
- [ ] กด Authorize Gmail แล้วทดสอบส่งอีเมล
- [ ] `pm2 status` = online, `docker compose ps` = healthy
- [ ] ลอง reboot server → เว็บกลับมาเองทั้ง PM2 และ MySQL

---

## 18. Troubleshooting

**เว็บขึ้น 502 Bad Gateway** = Nginx รันอยู่แต่ Next.js (port 3000) ไม่ตอบ ไล่เช็คตามนี้:
1. `pm2 status` — ถ้า**ว่างเปล่า/ไม่มี process `mocava`** แปลว่าแอปไม่ได้รัน (เช่น หลัง reboot
   แต่ไม่ได้ตั้ง auto-start, หรือ `pm2 restart` ไปทั้งที่ไม่มี process อยู่) → `pm2 start npm --name mocava -- run start`
   แล้ว **อย่าลืม `pm2 save && pm2 startup systemd`** (ข้อ 9) กันหายอีก
2. ถ้า status เป็น `errored`/`stopped` → `pm2 logs mocava --lines 50 --nostream` ดู error จริง
3. เช็ค `.next` สมบูรณ์ไหม: `ls .next/BUILD_ID` — **ถ้าไม่มีไฟล์นี้ = build ไม่เคยสำเร็จ**
   (มักเพราะ OOM ดูหัวข้อถัดไป) ต้อง build ใหม่ให้ผ่านก่อนถึงจะ `next start` ได้
4. ทดสอบในเครื่อง: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000` ควรได้ `200`

**`next build` ค้าง/ถูก kill / `FATAL ERROR: Reached heap limit`** = RAM ไม่พอ (OOM)
→ มักเกิดบน RAM ≤ 2GB ช่วง "checking validity of types" แก้ 2 อย่างคู่กัน:
1. เพิ่ม swap 4GB (ข้อ 2.4)
2. build ด้วย `NODE_OPTIONS="--max-old-space-size=3072" npm run build` (ข้อ 8)
   — ตั้งให้สูงกว่า RAM จริงเพื่อให้ heap ไหลลง swap, **ห้ามตั้งต่ำ** (เช่น 1536) เพราะจะชนเพดานแล้ว kill เอง

**รูปสินค้า/สลิปไม่ขึ้น (รูปแตก / 404)** = ไฟล์ถูกเซฟแล้วแต่เสิร์ฟออกไม่ได้
1. เช็คไฟล์มีจริงในดิสก์: `ls -la ~/mocava/public/uploads/` — ถ้ามีไฟล์ = อัปโหลด/sharp ปกติ
2. เช็คเสิร์ฟได้ไหม: `curl -sI https://yourdomain.com/uploads/<ชื่อไฟล์> | head -1`
   - ได้ **404** = Nginx ยังไม่มี block `/uploads/` `/slips/` → เพิ่มตามข้อ 10 แล้ว `sudo nginx -t && sudo systemctl reload nginx`
     (สาเหตุ: `next start` ไม่เสิร์ฟไฟล์ที่อัปหลัง build ต้องให้ Nginx เสิร์ฟตรงจากดิสก์)
   - ได้ **200** = ไฟล์เสิร์ฟได้ ปัญหาอยู่ที่ค่า `imageUrl` ใน DB ชี้ผิด (เช่น รูปอัปบนเครื่อง dev แล้ว restore DB มา — ไฟล์ไม่ตามมา) → อัปโหลดรูปใหม่บนเว็บจริง
3. โฟลเดอร์ `uploads/` **ว่างเปล่า** = อัปโหลดล้มเหลว → `pm2 logs mocava` ดู error ตอนอัป
   (มักเป็น `sharp` คนละ platform จากการก๊อป `node_modules` ข้ามเครื่อง — แก้ด้วย `npm ci` บน server)

**ต่อ DB ไม่ได้ (P1001)**
→ `docker compose ps` ดู MySQL healthy ไหม · เช็ค `DATABASE_URL` ตรงกับ `MYSQL_*` ใน `.env`

**ล็อกอิน Google ไม่ได้ / redirect_uri_mismatch**
→ redirect URI ใน Google Console ต้องตรงเป๊ะกับ `https://yourdomain.com/api/auth/callback/google`

**อีเมลไม่ส่ง (invalid_grant)**
→ ต้อง Authorize Gmail ใหม่บนโดเมนจริง (หัวข้อ 13)

**ลืมรหัส admin — สร้าง/รีเซ็ตผ่าน Node**
```bash
cd ~/mocava
node -e "const{PrismaClient}=require('@prisma/client');const b=require('bcryptjs');const p=new PrismaClient();(async()=>{const hash=await b.hash('<รหัสใหม่>',12);await p.user.update({where:{email:'admin@mocava.com'},data:{password:hash,emailVerified:new Date()}});console.log('reset ok');await p.\$disconnect();})()"
```

---

ทำตามครบแล้วเว็บจะออนไลน์พร้อมขายจริง 🚀
