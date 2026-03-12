# ตั้งค่า PostgreSQL บน Cloud (Neon) — ฟรี

ใช้ Neon (neon.tech) เป็นฐานข้อมูลบน Cloud ทำงานได้จากทุกเครือข่าย ไม่ต้องใช้ VPN

---

## ขั้นตอน

### 1. สมัครและสร้าง Database

1. ไปที่ **https://neon.tech**
2. คลิก **Sign Up** (ใช้ email หรือ Google)
3. สร้าง **Project** ใหม่
4. ตั้งชื่อ Project (เช่น `seo-system`)
5. เลือก Region ใกล้ไทย เช่น **Singapore (ap-southeast-1)**
6. กด **Create Project**

---

### 2. รับ Connection String

1. หลังสร้าง Project จะมีหน้า **Connection string**
2. เลือก **PostgreSQL** แล้ว copy connection string
3. รูปแบบจะประมาณนี้:
   ```
   postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```
4. เก็บ connection string ไว้

---

### 3. ย้ายข้อมูลจากเซิร์ฟเวอร์ปัจจุบันไป Neon

1. แก้ไฟล์ `.env`:
   - เก็บ `DATABASE_URL` ชี้ไปที่ PostgreSQL ปัจจุบัน (192.168.1.99)
   - เพิ่มบรรทัด (ใส่ connection string จาก Neon):
   ```env
   MIGRATE_TARGET_DATABASE_URL=postgresql://...@ep-xxx.neon.tech/neondb?sslmode=require
   ```

2. รัน migration (ต้องเชื่อมต่อเครือข่ายที่เข้าถึง PostgreSQL ต้นทางได้ เช่น LAN):
   ```bash
   npm run migrate-to-neon
   ```

3. ถ้าสำเร็จ แก้ `.env`:
   - เปลี่ยน `DATABASE_URL` เป็น connection string ของ Neon
   - ลบบรรทัด `MIGRATE_TARGET_DATABASE_URL` ออก

---

### 4. ทดสอบ

```bash
npm run dev
```

เปิดแอปทดสอบว่าโหลดข้อมูลได้ปกติ

---

## หมายเหตุ

- **Liquid cleanup**: ระบบจะลบ `rank_history` ที่เก่ากว่า 1 ปี อัตโนมัติ (สัปดาห์ละครั้ง) เพื่อประหยัดพื้นที่
- **แชร์โปรเจกต์**: แจกโค้ด + `DATABASE_URL` ให้คนที่ต้องการใช้ (อย่า commit `.env` ลง Git)
- **Free tier**: ~500 MB พอใช้ได้หลายปีถ้าใช้ liquid cleanup
