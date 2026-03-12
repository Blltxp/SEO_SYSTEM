# ให้คนอื่นใช้หน้าเช็คอันดับได้

เมื่อ **คนอื่น** เปิดเว็บแล้วกดปุ่ม「เช็คอันดับตอนนี้」 request จะไปที่ **เซิร์ฟเวอร์ที่รันแอป** ไม่ใช่เครื่องคุณ  
→ บนเซิร์ฟเวอร์ Google มักไม่ส่งผลค้นหาเต็ม (ตรวจจับบอต) ดังนั้นต้องใช้ **Google Custom Search API** แทน

---

## สิ่งที่ต้องทำ

### 1. Deploy แอปขึ้นเซิร์ฟเวอร์

เลือกอย่างใดอย่างหนึ่ง (หรือใช้ที่คุณมีอยู่แล้ว):

- **Vercel** — ฟรี, เหมาะกับ Next.js: [vercel.com](https://vercel.com) → Import โปรเจกต์จาก Git
- **VPS / รันบนเครื่องที่เปิด 24 ชม.** — รัน `npm run build` แล้ว `npm start` (หรือใช้ PM2)
- **Railway, Render ฯลฯ** — deploy ตามที่บริการกำหนด

หมายเหตุ: แอปรองรับ **Neon (PostgreSQL Cloud)** — แนะนำตั้งตาม [CLOUD_SETUP.md](../CLOUD_SETUP.md) แล้วใส่ `DATABASE_URL` ใน Environment Variables ของเซิร์ฟเวอร์ deploy

### 2. ตั้งค่า Google Custom Search API (บนเซิร์ฟเวอร์)

ทำครั้งเดียวตามคู่มือ [ตั้งค่า-Ranking-ฟรี.md](./ตั้งค่า-Ranking-ฟรี.md) ทางเลือกที่ 2:

1. สร้าง **API Key** ใน Google Cloud และเปิด Custom Search API  
2. สร้าง **Search Engine** ที่ Programmable Search Engine (เลือก "Search the entire web") แล้ว copy **Search engine ID (cx)**  
3. ใส่ใน **Environment Variables ของเซิร์ฟเวอร์** (ไม่ใช่แค่ใน .env บนเครื่อง):

| ชื่อตัวแปร | ค่า |
|------------|-----|
| `GOOGLE_CSE_API_KEY` | API Key จาก Google Cloud |
| `GOOGLE_CSE_CX` | Search engine ID จาก Programmable Search Engine |

- **Vercel**: Project → Settings → Environment Variables  
- **VPS**: ใส่ใน `.env` บนเซิร์ฟเวอร์ หรือส่งเข้า process ตอนรัน (เช่น `GOOGLE_CSE_API_KEY=xxx npm start`)

ไม่ต้องใช้ `npm run check-ranking-local` บนเซิร์ฟเวอร์ เพราะโหมดนี้ออกแบบมาสำหรับการรันบนเครื่องคุณที่มีหน้าต่าง Chrome ให้แก้ challenge ได้

### 3. แชร์ลิงก์ให้คนอื่น

หลัง deploy ได้ URL เช่น `https://your-app.vercel.app` หรือ `http://your-server-ip:3000`  
→ แชร์ลิงก์นี้ให้คนอื่น เปิดหน้า **/ranking** แล้วกด「เช็คอันดับตอนนี้」ได้เลย

---

## โควต้า

- โควต้าฟรีของ Custom Search API = **100 ครั้ง/วัน** (รวมทุกคนที่ใช้)
- เช็ค 1 รอบเต็ม (19 keywords) = 19 ครั้ง → ใช้ได้ประมาณ 5 รอบ/วัน
- ถ้าใช้เกิน 100 ครั้ง/วัน Google จะคิดเงิน (หรือตั้ง daily limit ใน Cloud Console เป็น 100 เพื่อกันใช้เกิน)
