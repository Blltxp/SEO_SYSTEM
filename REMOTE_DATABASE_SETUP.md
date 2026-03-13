# คู่มือตั้งค่าเซิร์ฟเวอร์ฐานข้อมูลระยะไกล (แบบละเอียด)

> **แนะนำ:** ถ้าต้องการใช้งานจากทุกเครือข่ายโดยไม่ต้องตั้ง VPN ให้ใช้ **[Neon (Cloud)](../CLOUD_SETUP.md)** แทน — ฟรี ไม่ต้องมีเซิร์ฟเวอร์ตัวเอง

โปรเจกต์ใช้ **SQLite** (ไฟล์ `seo.db`) ซึ่งทำงานได้แค่บนเครื่องเดียว  
ถ้าต้องการให้ **อีกเครื่องหนึ่งเป็นเซิร์ฟเวอร์เก็บแค่ฐานข้อมูล** แล้วแอปทำงานได้จากที่ไหน/เครือข่ายใดก็ได้ แนะนำใช้ **PostgreSQL** บนเครื่องนั้น (ฟรี 100%)

---

## สารบัญ

1. [ภาพรวม](#ภาพรวม)
2. [ฝั่งเซิร์ฟเวอร์ – ติดตั้ง PostgreSQL](#ฝั่งเซิร์ฟเวอร์--ติดตั้ง-postgresql)
   - [Windows](#windows)
   - [Linux (Ubuntu/Debian)](#linux-ubuntudebian)
   - [Linux (Fedora/RHEL)](#linux-fedorarhel)
3. [ฝั่งเซิร์ฟเวอร์ – ตั้งค่าให้รับการเชื่อมต่อจากเครือข่าย](#ฝั่งเซิร์ฟเวอร์--ตั้งค่าให้รับการเชื่อมต่อจากเครือข่าย)
4. [ฝั่งเซิร์ฟเวอร์ – Firewall และการเปิดพอร์ต](#ฝั่งเซิร์ฟเวอร์--firewall-และการเปิดพอร์ต)
5. [ฝั่งเซิร์ฟเวอร์ – ให้บริการรันอัตโนมัติเมื่อเปิดเครื่อง](#ฝั่งเซิร์ฟเวอร์--ให้บริการรันอัตโนมัติเมื่อเปิดเครื่อง)
6. [ฝั่งโปรเจกต์ – ตั้งค่า DATABASE_URL](#ฝั่งโปรเจกต์--ตั้งค่า-database_url)
7. [ฝั่งโปรเจกต์ – แก้โค้ดให้ใช้ PostgreSQL](#ฝั่งโปรเจกต์--แก้โค้ดให้ใช้-postgresql)
8. [ย้ายข้อมูลจาก SQLite ไป PostgreSQL (ถ้ามีข้อมูลเดิม)](#ย้ายข้อมูลจาก-sqlite-ไป-postgresql-ถ้ามีข้อมูลเดิม)
9. [ตรวจสอบการเชื่อมต่อ](#ตรวจสอบการเชื่อมต่อ)
10. [เข้าจากอินเทอร์เน็ต (ถ้าต้องการ)](#เข้าจากอินเทอร์เน็ต-ถ้าต้องการ)
11. [ควรมีระบบล็อกอินในแอปหรือไม่ (ความปลอดภัย)](#ควรมีระบบล็อกอินในแอปหรือไม่-ความปลอดภัย)

---

## ภาพรวม

- **เครื่อง A (เซิร์ฟเวอร์ DB)**  
  - ติดตั้ง PostgreSQL  
  - สร้าง database + user  
  - เปิดให้รับการเชื่อมต่อจากเครือข่าย (และเปิดพอร์ตใน firewall)  
  - ตั้งให้บริการ PostgreSQL รันอัตโนมัติเมื่อเปิดเครื่อง → **แค่เปิดเครื่องก็พร้อมใช้งาน**

- **เครื่อง B, C, … (เครื่องที่รันแอป)**  
  - ตั้ง `DATABASE_URL` ชี้ไปที่ IP/โดเมนของเครื่อง A  
  - แก้โค้ดให้ใช้ client PostgreSQL แทน SQLite  

เมื่อทำครบ แอปจะอ่าน/เขียนฐานข้อมูลกลางบนเครื่อง A ได้จากที่ไหนก็ได้ที่เครือข่ายอนุญาต (LAN หรืออินเทอร์เน็ตถ้าเปิดพอร์ต/VPN)

---

## ฝั่งเซิร์ฟเวอร์ – ติดตั้ง PostgreSQL

### Windows

1. **ดาวน์โหลดตัวติดตั้ง**
   - ไปที่ https://www.postgresql.org/download/windows/
   - เลือก "Download the installer" (จาก EDB)
   - เลือกเวอร์ชันล่าสุด (เช่น PostgreSQL 16) และสถาปัตยกรรม (32/64 bit) ให้ตรงกับเครื่อง

2. **รันตัวติดตั้ง**
   - ดับเบิลคลิกไฟล์ที่ดาวน์โหลด
   - Next → เลือกโฟลเดอร์ติดตั้ง (ค่าเริ่มต้นได้) → Next
   - **เลือก components**: ใส่เครื่องหมายที่ "PostgreSQL Server", "Command Line Tools", "Stack Builder" (ถ้ามี) → Next
   - เลือกโฟลเดอร์เก็บข้อมูล (data directory) → Next
   - **ตั้งรหัสผ่านสำหรับ user `postgres`**: ใส่รหัสผ่านแล้วจำไว้ (ใช้ตอนสร้าง user ของแอปหรือใช้ user นี้ก็ได้) → Next
   - พอร์ต: ใช้ **5432** (ค่าเริ่มต้น) → Next
   - Locale: ใช้ค่าเริ่มต้น → Next
   - กด Install แล้วรอให้ติดตั้งเสร็จ
   - ตอนจบ ถ้ามีตัวเลือก **"Launch Stack Builder"** จะไม่ใช้ก็ได้ (ยกเลิกได้)

3. **ตรวจสอบว่า PostgreSQL รันอยู่**
   - เปิด **Services** (กด Win + R พิมพ์ `services.msc` Enter)
   - หา service ชื่อ **"postgresql-x64-16"** (เลขเวอร์ชันอาจต่างกัน)
   - สถานะควรเป็น **Running** และ Startup type เป็น **Automatic**  
   → แปลว่า **แค่เปิดเครื่อง PostgreSQL จะรันเอง**

4. **ที่อยู่ไฟล์สำคัญ (สำหรับขั้นตอนถัดไป)**
   - โฟลเดอร์ข้อมูล (data): มักอยู่ที่  
     `C:\Program Files\PostgreSQL\16\data`  
   - ไฟล์ config หลัก:
     - `C:\Program Files\PostgreSQL\16\data\postgresql.conf`
     - `C:\Program Files\PostgreSQL\16\data\pg_hba.conf`

---

### Linux (Ubuntu/Debian)

1. **อัปเดตและติดตั้ง PostgreSQL**
   ```bash
   sudo apt update
   sudo apt install -y postgresql postgresql-contrib
   ```

2. **ตรวจสอบว่า service รัน**
   ```bash
   sudo systemctl status postgresql
   ```
   ควรเห็น `active (exited)` หรือ `active (running)`

3. **ตั้งให้รันอัตโนมัติเมื่อเปิดเครื่อง**
   ```bash
   sudo systemctl enable postgresql
   ```

4. **ที่อยู่ไฟล์ config (โดยทั่วไป)**
   - `postgresql.conf`: `/etc/postgresql/16/main/postgresql.conf` (เลข 16 เปลี่ยนตามเวอร์ชัน)
   - `pg_hba.conf`: `/etc/postgresql/16/main/pg_hba.conf`

   ถ้าไม่แน่ใจว่าเวอร์ชัน:
   ```bash
   ls /etc/postgresql/
   ```

---

### Linux (Fedora/RHEL)

1. **ติดตั้ง PostgreSQL**
   ```bash
   sudo dnf install -y postgresql-server postgresql-contrib
   # หรือ CentOS/RHEL: sudo yum install -y postgresql-server postgresql-contrib
   ```

2. **เริ่มต้นฐานข้อมูล (ครั้งแรกเท่านั้น)**
   ```bash
   sudo postgresql-setup --initdb
   # หรือ RHEL 8+: sudo postgresql-setup initdb
   ```

3. **สตาร์ทและตั้งให้รันอัตโนมัติ**
   ```bash
   sudo systemctl start postgresql
   sudo systemctl enable postgresql
   ```

4. **ที่อยู่ config**
   - มักอยู่ที่ `/var/lib/pgsql/data/postgresql.conf` และ `/var/lib/pgsql/data/pg_hba.conf`  
   หรือ `/var/lib/pgsql/16/data/` (แล้วแต่ distro)

---

## ฝั่งเซิร์ฟเวอร์ – สร้าง Database และ User

ทำบนเครื่องเซิร์ฟเวอร์ (ที่ติดตั้ง PostgreSQL แล้ว) โดยใช้ user ที่มีสิทธิ์จัดการ PostgreSQL (เช่น `postgres`)。

### Windows

1. เปิด **Command Prompt** หรือ **PowerShell**
2. ไปที่โฟลเดอร์ bin ของ PostgreSQL (เช่น):
   ```cmd
   cd "C:\Program Files\PostgreSQL\16\bin"
   ```
3. เข้าใช้ด้วย user `postgres` (ใส่รหัสผ่านที่ตั้งตอนติดตั้ง):
   ```cmd
   psql -U postgres
   ```
4. ใน `psql` รันคำสั่งต่อไปนี้ (เปลี่ยนรหัสผ่าน `YOUR_STRONG_PASSWORD` เป็นรหัสผ่านที่ต้องการ):
   ```sql
   CREATE USER seo_user WITH PASSWORD 'YOUR_STRONG_PASSWORD';
   CREATE DATABASE seo_db OWNER seo_user;
   \q
   ```

### Linux

```bash
sudo -u postgres psql
```

จากนั้นใน `psql`:

```sql
CREATE USER seo_user WITH PASSWORD 'YOUR_STRONG_PASSWORD';
CREATE DATABASE seo_db OWNER seo_user;
\q
```

เก็บ **รหัสผ่านของ `seo_user`** ไว้ใช้ใน `DATABASE_URL` ฝั่งโปรเจกต์

---

## ฝั่งเซิร์ฟเวอร์ – ตั้งค่าให้รับการเชื่อมต่อจากเครือข่าย

ตอนนี้ PostgreSQL รับเฉพาะการเชื่อมต่อจาก localhost ต้องแก้ config ให้รับจาก IP อื่น (เครื่องใน LAN หรือจากอินเทอร์เน็ต)

### 1) แก้ `postgresql.conf`

- **Windows**: เปิดด้วย Notepad (Run as Administrator)  
  ตัวอย่าง path: `C:\Program Files\PostgreSQL\16\data\postgresql.conf`
- **Linux**:  
  ```bash
  sudo nano /etc/postgresql/16/main/postgresql.conf
  # หรือ path ตาม distro ของคุณ
  ```

หาบรรทัด:

```conf
#listen_addresses = 'localhost'
```

แก้เป็น:

```conf
listen_addresses = '*'
```

(หรือใส่เฉพาะ IP ของเซิร์ฟเวอร์แทน `'*'` ถ้าต้องการจำกัด)  
บันทึกไฟล์แล้วปิด

### 2) แก้ `pg_hba.conf`

ไฟล์นี้กำหนดว่า IP ใดเชื่อมต่อได้และใช้วิธี authentication อะไร

- **Windows**:  
  `C:\Program Files\PostgreSQL\16\data\pg_hba.conf`
- **Linux**:  
  `/etc/postgresql/16/main/pg_hba.conf` (หรือตาม path จริง)

เปิดไฟล์แล้ว **เพิ่มบรรทัดด้านล่าง** (ก่อนหรือหลัง rule อื่นที่เกี่ยวกับ IPv4):

- **ถ้าอยากให้เฉพาะเครือข่าย LAN (เช่น 192.168.1.0/24)**:
  ```conf
  host    seo_db    seo_user    192.168.1.0/24    scram-sha-256
  ```
- **ถ้าอยากให้เชื่อมจากที่ไหนก็ได้ (รวมอินเทอร์เน็ต)**:
  ```conf
  host    seo_db    seo_user    0.0.0.0/0    scram-sha-256
  ```

บันทึกไฟล์

### 3) รีสตาร์ท PostgreSQL

- **Windows**:  
  - เปิด `services.msc` → หา service `postgresql-x64-16` → คลิกขวา → Restart  
  - หรือ PowerShell (รัน as Admin):  
    ```powershell
    Restart-Service postgresql-x64-16
    ```
- **Linux**:
  ```bash
  sudo systemctl restart postgresql
  ```

---

## ฝั่งเซิร์ฟเวอร์ – Firewall และการเปิดพอร์ต

เครื่องอื่นจะเชื่อมต่อได้ต้องให้พอร์ต **5432** ผ่าน firewall ของเครื่องเซิร์ฟเวอร์

### Windows (Windows Defender Firewall)

1. เปิด **Windows Defender Firewall with Advanced Security**
   - กด Win + R พิมพ์ `wf.msc` Enter
2. เลือก **Inbound Rules** → **New Rule…**
3. เลือก **Port** → Next
4. เลือก **TCP**, **Specific local ports**: `5432` → Next
5. เลือก **Allow the connection** → Next
6. ใส่เครื่องหมายทั้ง Domain, Private, Public ตามที่ใช้ (อย่างน้อย Private สำหรับ LAN) → Next
7. ตั้งชื่อเช่น "PostgreSQL 5432" → Finish

### Linux (ufw)

```bash
sudo ufw allow 5432/tcp
sudo ufw reload
sudo ufw status
```

### Linux (firewalld)

```bash
sudo firewall-cmd --permanent --add-port=5432/tcp
sudo firewall-cmd --reload
```

หลังขั้นตอนนี้ เครื่องอื่นใน **LAN** ที่ชี้ IP มาที่เครื่องเซิร์ฟเวอร์ควรเชื่อมต่อได้ (ถ้า `pg_hba.conf` อนุญาตช่วง IP นั้น)

---

## ฝั่งเซิร์ฟเวอร์ – ให้บริการรันอัตโนมัติเมื่อเปิดเครื่อง

- **Windows**: ตัวติดตั้ง PostgreSQL มักตั้ง service เป็น **Automatic** อยู่แล้ว  
  ตรวจสอบใน `services.msc` ที่ service `postgresql-x64-16` → Startup type = **Automatic**  
  → **แค่เปิดเครื่อง PostgreSQL จะรันเอง**

- **Linux**: ใช้แล้วในขั้นตอนติดตั้ง  
  ```bash
  sudo systemctl enable postgresql
  ```  
  ตรวจสอบ:
  ```bash
  sudo systemctl is-enabled postgresql
  ```
  ควรได้ `enabled`  
  → **แค่เปิดเครื่อง PostgreSQL จะรันเอง**

---

## ฝั่งโปรเจกต์ – ตั้งค่า DATABASE_URL

บนเครื่องที่รันแอป (Next.js / scripts)

1. สร้างไฟล์ `.env` ในโฟลเดอร์รากของโปรเจกต์ (ระดับเดียวกับ `package.json`) ถ้ายังไม่มี

2. เพิ่มบรรทัด (แก้ `SERVER_IP`, `รหัสผ่าน` ตามจริง):

   ```env
   DATABASE_URL=postgresql://seo_user:รหัสผ่าน@SERVER_IP:5432/seo_db
   ```

   ตัวอย่าง:
   - เครื่องเซิร์ฟเวอร์อยู่ใน LAN ที่ IP `192.168.1.100`:
     ```env
     DATABASE_URL=postgresql://seo_user:MyPass123@192.168.1.100:5432/seo_db
     ```
   - ถ้าเซิร์ฟเวอร์มีโดเมนหรือ IP สาธารณะ (หลังตั้ง port forward แล้ว):
     ```env
     DATABASE_URL=postgresql://seo_user:MyPass123@your-domain.com:5432/seo_db
     ```

3. **สำคัญ**: อย่า commit ไฟล์ `.env` ขึ้น Git (ควรมีใน `.gitignore` อยู่แล้ว)

4. ถ้าต้องการให้ใช้ SQLite เมื่อไม่มี `DATABASE_URL` (รันบนเครื่องที่ไม่ใช่เซิร์ฟเวอร์ DB) โค้ดฝั่งแอปต้องเช็ก `process.env.DATABASE_URL` แล้วเลือกใช้ PostgreSQL หรือ SQLite ตามนั้น (ดูหัวข้อถัดไป)

---

## ฝั่งโปรเจกต์ – แก้โค้ดให้ใช้ PostgreSQL

ตอนนี้โปรเจกต์ใช้ `better-sqlite3` (API แบบ `db.prepare(...).run()/.get()/.all()`, `db.exec()`, `db.transaction()`)  
ต้องเปลี่ยนไปใช้ client ของ PostgreSQL (เช่น `pg`) เมื่อมี `DATABASE_URL`

### สิ่งที่ต้องทำโดยสรุป

1. ติดตั้ง package: `pg` และ `@types/pg`
2. สร้าง schema บน PostgreSQL (แปลงจาก SQLite: เช่น `AUTOINCREMENT` → `SERIAL`, `INSERT OR REPLACE` → `ON CONFLICT ... DO UPDATE`, `INSERT OR IGNORE` → `ON CONFLICT DO NOTHING`, ฟังก์ชัน `date('now', ...)` → `CURRENT_DATE` / interval)
3. แก้ `lib/db.ts` ให้:
   - ถ้ามี `DATABASE_URL` → สร้าง connection pool ของ `pg` และ export object ที่ให้ฟังก์ชันเทียบเท่า `prepare/run/get/all/exec/transaction` (หรือ viết wrapper เล็กๆ)
   - ถ้าไม่มี → ใช้ `better-sqlite3` กับไฟล์ `seo.db` เหมือนเดิม
4. แก้ไฟล์ที่เรียกใช้ `db` ทั้งหมดให้ใช้ API ที่รองรับทั้ง SQLite และ PostgreSQL (หรือเรียกผ่าน wrapper)

### ไฟล์ที่อ้างอิง `lib/db` และต้องใช้ผ่าน layer นี้

- `lib/db.ts` – สร้างตาราง, migration, seed (sites, keywords)
- `lib/ranking.ts` – rank_history, app_locks
- `lib/titleSuggestions.ts` – posts
- `lib/rankDrop.ts` – rank_history
- `lib/duplicate.ts` – posts
- `scripts/updateKeywords.ts` – keywords, site_keywords
- `scripts/runAutomation.ts` – posts

และ API routes ใน `src/app/api/` ที่เรียกฟังก์ชันจาก lib ข้างบน (ไม่ต้อง import `db` โดยตรงถ้าใช้ผ่าน lib)

### ความต่างของ SQL ที่ต้องแปลง (ตัวอย่าง)

| SQLite | PostgreSQL |
|--------|------------|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` หรือ `GENERATED BY DEFAULT AS IDENTITY` |
| `INSERT OR REPLACE INTO ...` | `INSERT INTO ... ON CONFLICT (...) DO UPDATE SET ...` |
| `INSERT OR IGNORE INTO ...` | `INSERT INTO ... ON CONFLICT (...) DO NOTHING` |
| `?` placeholders | `$1, $2, ...` |
| `date('now', '-7 days')` | `CURRENT_DATE - INTERVAL '7 days'` หรือ `(CURRENT_DATE - INTERVAL '7 days')::date` |
| `PRAGMA table_info(...)` | query ต่อ `information_schema.columns` |

การจะทำแบบละเอียดในโค้ดมีสองแนวทางหลัก:

- **แนวทาง A**: เขียน wrapper ใน `lib/db.ts` ที่ตรวจ `DATABASE_URL` แล้วส่งคำสั่งไปยัง `pg` โดยแปลง placeholder และใช้ฟังก์ชันที่เทียบเท่า `run/get/all/exec/transaction` เพื่อให้ไฟล์อื่นเปลี่ยนโค้ดน้อยที่สุด  
- **แนวทาง B**: แก้ทุกจุดที่ใช้ `db` ให้เรียก `pool.query()` ของ `pg` โดยตรง และแยกไฟล์ schema/migration สำหรับ PostgreSQL

ถ้าต้องการให้ช่วยลงมือแก้โค้ดจริง (เช่น ทำแนวทาง A หรือ B พร้อม schema สำหรับ PostgreSQL) บอกได้ว่าจะให้ทำแบบไหน หรือให้เริ่มจาก `lib/db.ts` + schema ก่อน

---

## ย้ายข้อมูลจาก SQLite ไป PostgreSQL (ถ้ามีข้อมูลเดิม)

ถ้ามีไฟล์ `seo.db` ที่มีข้อมูลอยู่แล้ว และต้องการย้ายไปใช้ PostgreSQL บนเซิร์ฟเวอร์:

1. **Export จาก SQLite**
   - ใช้คำสั่ง dump:  
     `sqlite3 seo.db .dump > seo_dump.sql`
   - หรือใช้เครื่องมือเช่น **pgloader** (รองรับการย้ายจาก SQLite ไป PostgreSQL โดยตรง)

2. **แปลง syntax ใน dump (ถ้า dump ด้วยมือ)**
   - แทนที่ `AUTOINCREMENT` ด้วย `SERIAL` หรือลบออกแล้วใช้ identity column
   - แทนที่ `INSERT OR REPLACE` / `INSERT OR IGNORE` ตามตารางด้านบน
   - ลบหรือแปลงคำสั่ง SQLite เฉพาะที่ PostgreSQL ไม่รู้จัก

3. **สร้างตารางบน PostgreSQL ก่อน** (รัน schema ที่แปลงแล้ว)

4. **นำเข้าข้อมูล**
   - ถ้าใช้ไฟล์ `.sql` ที่แปลงแล้ว:  
     `psql -U seo_user -d seo_db -h SERVER_IP -f seo_dump_converted.sql`
   - หรือใช้ pgloader จะจัดการทั้ง schema และข้อมูลให้

หลังย้ายแล้ว ตั้ง `DATABASE_URL` ฝั่งแอปแล้วทดสอบอ่าน/เขียนจากแอป

---

## ตรวจสอบการเชื่อมต่อ

### จากเครื่องเซิร์ฟเวอร์ (localhost)

```bash
psql -U seo_user -d seo_db -h 127.0.0.1 -c "SELECT 1;"
```

(Windows ใช้ `psql` จากโฟลเดอร์ `bin` ของ PostgreSQL หรือเพิ่มใน PATH)

### จากเครื่องอื่นใน LAN

บนเครื่องที่ติดตั้ง `psql` (หรือติดตั้ง PostgreSQL client เฉพาะ client ก็ได้):

```bash
psql "postgresql://seo_user:YOUR_PASSWORD@192.168.1.100:5432/seo_db" -c "SELECT 1;"
```

ถ้าได้ผลลัพธ์ `?column?` และ `1` แปลว่าเชื่อมต่อได้

### จากโปรเจกต์ (Node)

หลังแก้ `lib/db.ts` ให้ใช้ `pg` เมื่อมี `DATABASE_URL` แล้ว รันแอปหรือ script ที่อ่านจาก DB (เช่นเปิดหน้า ranking หรือรัน `npm run check-ranking-local`) ถ้าไม่มี error แปลว่าการเชื่อมต่อใช้งานได้

---

## เข้าจากอินเทอร์เน็ต (ถ้าต้องการ)

ถ้าต้องการให้เครื่องที่อยู่นอก LAN (เช่นที่บ้าน ออฟฟิศอื่น) เชื่อมต่อกับ PostgreSQL บนเซิร์ฟเวอร์:

1. **Port forward ที่เราเตอร์**
   - เข้าเว็บจัดการเราเตอร์ (มักเป็น 192.168.1.1 หรือ 192.168.0.1)
   - หาหน้า Port Forwarding / Virtual Server / NAT
   - ตั้งให้พอร์ต **5432** (TCP) ชี้ไปที่ **IP ใน LAN ของเครื่องเซิร์ฟเวอร์** (เช่น 192.168.1.100)

2. **ความปลอดภัย**
   - เปิดพอร์ต 5432 ไปยังอินเทอร์เน็ตมีความเสี่ยง (ถูกสแกน/โจมตีได้)
   - แนะนำ:
     - ใช้รหัสผ่านที่แข็งแรงมากสำหรับ `seo_user`
     - หรือไม่เปิด port 5432 ออกเน็ตโดยตรง แต่ใช้ **VPN** เข้า LAN แล้วเชื่อมต่อผ่าน IP ใน LAN (ปลอดภัยกว่า)

3. **DATABASE_URL ฝั่งแอป**
   - ใช้ IP สาธารณะหรือโดเมนที่ชี้มาที่เราเตอร์ (และมี port forward ไปยังเครื่องเซิร์ฟเวอร์):
     ```env
     DATABASE_URL=postgresql://seo_user:รหัสผ่าน@your-public-ip-or-domain:5432/seo_db
     ```

---

## ควรมีระบบล็อกอินในแอปหรือไม่ (ความปลอดภัย)

เมื่อแอปเชื่อมต่อกับ DB กลางจากที่ไหนก็ได้ คำถามคือ: **คนอื่นจะเข้ามาแก้ข้อมูลจนสับสนหรือมั่วได้ไหม?**

ความปลอดภัยมี **สองชั้น** ที่ต้องแยกกันคิด:

### ชั้นที่ 1: การเข้าถึงฐานข้อมูลโดยตรง

- **PostgreSQL ใช้ user + รหัสผ่าน** อยู่แล้ว (เช่น `seo_user` ที่สร้างไว้)
- คนที่เชื่อมต่อกับ DB ได้ต้องมี **connection string** (`DATABASE_URL`) ที่มีทั้ง host, ชื่อ user และรหัสผ่าน
- `DATABASE_URL` อยู่แค่ใน **.env บนเครื่องที่รันแอป** (และไม่ควร commit ขึ้น Git)
- ดังนั้น **คนทั่วไปบนเน็ตหรือใน LAN ไม่สามารถต่อเข้า PostgreSQL โดยตรง** ถ้าไม่มีไฟล์ `.env` หรือไม่รู้รหัสผ่าน

สรุป: ฐานข้อมูลไม่ใช่ “เปิดให้ใครก็เข้าได้” — มีแค่เครื่อง/โปรเซสที่รู้ `DATABASE_URL` ถึงจะอ่าน/เขียน DB ได้

### ชั้นที่ 2: การเข้าใช้แอป (เว็บ Next.js)

- แอป Next.js รันอยู่ที่เครื่องใดเครื่องหนึ่ง (หรือ deploy บนเซิร์ฟเวอร์)
- **ใครก็ตามที่เปิด URL ของแอปได้** (เช่น `http://192.168.1.50:3000` หรือ `https://seo.yourcompany.com`) จะเห็นหน้า dashboard, หน้า ranking, ปุ่มเช็คอันดับ ฯลฯ และใช้ฟีเจอร์ทั้งหมดได้
- แอปจะใช้ `DATABASE_URL` ที่อยู่บนเซิร์ฟเวอร์/เครื่องที่รัน Next.js เพื่อไปอ่าน/เขียน DB ให้ — **ผู้ใช้ไม่เห็นรหัส DB** แต่ถ้าเขาเข้า “แอป” ได้ เขาก็ใช้ฟีเจอร์ทั้งหมดได้

ดังนั้นความเสี่ยงคือ: **ถ้ามีคนอื่นที่ “เปิด URL แอปได้”** (เช่น แชร์ลิงก์ในออฟฟิศ, แอปอยู่บนเน็ต, ใช้เครื่องร่วมกัน) เขาจะสามารถ:
- ดูข้อมูล ranking / keywords
- กดเช็คอันดับ
- แก้หรือใช้ฟีเจอร์อื่นที่แอปเปิดไว้

และอาจทำให้ข้อมูลถูกแก้หรือใช้จนสับสนได้

### ควรทำระบบล็อกอินไว้ไหม

| สถานการณ์ | แนะนำ |
|-----------|--------|
| ใช้แอปเฉพาะในเครื่องตัวเอง / เครื่องในบ้าน ไม่แชร์ URL กับใคร | ไม่บังคับ แต่ถ้าอยากกันคนที่ใช้เครื่องเดียวกัน ก็ทำได้ |
| แชร์ URL ภายในทีม/ออฟฟิศ (LAN) หรือให้คนอื่นเปิดจากที่อื่นได้ | **ควรมีล็อกอิน** — กันคนที่เปิด URL ได้แต่ไม่ใช่ทีมงาน |
| Deploy แอปขึ้นเซิร์ฟเวอร์ให้เข้าได้จากอินเทอร์เน็ต | **ควรมีล็อกอิน** — กันคนที่ไม่รู้จักไม่ให้เข้าใช้แอป |

ถ้ามีล็อกอิน:
- เฉพาะคนที่ **ล็อกอินผ่านแล้ว** ถึงจะเข้าใช้หน้า dashboard, API ที่เกี่ยวกับข้อมูลได้
- รหัสผ่านของ **PostgreSQL** ยังอยู่ใน `.env` บนเซิร์ฟเวอร์ ไม่ต้องให้ผู้ใช้รู้
- ข้อมูลใน DB จะถูกแก้ผ่านแอปได้เฉพาะคนที่คุณให้บัญชีเท่านั้น ลดโอกาสสับสนหรือมั่วจากคนอื่น

### สรุปสั้น ๆ

- **DB ปลอดภัยอยู่แล้วในระดับ “ต่อตรง”** — ใครไม่มี `DATABASE_URL` ต่อ DB เองไม่ได้
- **แอป (เว็บ)** คือจุดที่ “ใครเปิด URL ได้ก็ใช้ได้” — ถ้าไม่ต้องการให้คนอื่นมาแก้/ใช้จนสับสน **ควรทำระบบล็อกอินในแอป**
- ถ้าแอปอาจถูกเปิดจากหลายคนหรือจากเน็ต แนะนำให้มีล็อกอิน (เช่น NextAuth.js, Auth.js หรือระบบ session เอง) แล้วค่อยค่อยลงรายละเอียดในขั้นตอนถัดไป

### ลำดับที่แนะนำ: ทำเซิร์ฟเวอร์ DB ก่อน หรือล็อกอินก่อน

- **แนะนำ: ทำเซิร์ฟเวอร์ DB (PostgreSQL) ก่อน แล้วค่อยทำระบบล็อกอิน**
  - ตรงกับแผนหลัก (อีกเครื่องเป็นที่เก็บ DB)
  - โครงสร้างชัดก่อน แล้วค่อยเพิ่มชั้นความปลอดภัย
  - ลดการแก้ซ้ำ — ถ้าทำล็อกอินก่อนแล้วเก็บ session/ผู้ใช้ใน DB พอย้ายไป PostgreSQL จะต้องย้ายข้อมูลและทดสอบอีกครั้ง
- **ขอยกเว้น:** ถ้าต้องแชร์ URL แอปหรือเปิดให้เข้าจากเน็ตในเร็วๆ นี้ ให้ทำล็อกอินก่อน (แม้ยังใช้ SQLite) เพื่อกันคนอื่นใช้แอป แล้วค่อยย้ายไปใช้เซิร์ฟเวอร์ DB ตามลำดับ

---

## สรุปลำดับขั้นตอน (แบบย่อ)

**บนเครื่องเซิร์ฟเวอร์ (เครื่องเก็บ DB):**

1. ติดตั้ง PostgreSQL (Windows/Linux ตามด้านบน)
2. สร้าง user `seo_user` และ database `seo_db`
3. แก้ `postgresql.conf` → `listen_addresses = '*'`
4. แก้ `pg_hba.conf` → เพิ่ม rule สำหรับ `seo_db` / `seo_user` (ช่วง IP ตามต้องการ)
5. รีสตาร์ท PostgreSQL
6. เปิดพอร์ต 5432 ใน firewall
7. ตรวจสอบว่า service ตั้งเป็นรันอัตโนมัติเมื่อเปิดเครื่อง  

→ **หลังจากนี้ แค่เปิดเครื่องเซิร์ฟเวอร์ PostgreSQL จะทำงานเลย**

**บนเครื่องที่รันแอป:**

1. ตั้ง `DATABASE_URL` ใน `.env` ชี้ไปที่ IP/โดเมนของเซิร์ฟเวอร์
2. แก้โค้ดให้ใช้ PostgreSQL เมื่อมี `DATABASE_URL` (ติดตั้ง `pg`, แก้ `lib/db.ts` และไฟล์ที่ใช้ `db`)
3. (ถ้ามีข้อมูลเดิม) ย้ายข้อมูลจาก SQLite ไป PostgreSQL
4. ทดสอบการเชื่อมต่อและรันแอป

ถ้าต้องการให้ช่วยเขียนโค้ดส่วน `lib/db.ts` และ schema สำหรับ PostgreSQL จริงในโปรเจกต์ บอกได้เลยว่าจะให้ทำแบบ wrapper รองรับทั้ง SQLite/PostgreSQL หรือเปลี่ยนไปใช้ PostgreSQL อย่างเดียวเมื่อมี `DATABASE_URL`
