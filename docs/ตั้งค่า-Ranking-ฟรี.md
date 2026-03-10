# ตั้งค่า Keyword Ranking ให้ใช้ได้ (ไม่เสียเงิน)

## ทางเลือกที่ 1: รันจากเครื่องตัวเองผ่าน Chrome จริง แบบใกล้เคียงคนค้นจริงที่สุด

รันเช็คจากเครื่องคุณ แล้วให้ระบบเปิด **Chrome จริงแบบโปรไฟล์สะอาด/ไม่ระบุตัวตน**  
→ ไม่ใช้ cookies/ประวัติที่คุณเคยค้น และถ้า Google ขอ challenge/captcha คุณสามารถกดผ่านเองได้

1. รันจากเครื่องคุณ: `npm run check-ranking-local`
2. ถ้า Chrome เปิดขึ้นมาและ Google ขอ challenge/captcha ให้แก้ในหน้าต่าง Chrome แล้วกลับมากด Enter ในเทอร์มินัล
3. ระบบจะเช็คครบ 19 keyword แล้วบันทึกลงตารางให้อัตโนมัติ

ถ้าใช้ทางนี้ได้ ผลจะใกล้กับการที่คุณเปิด Chrome แบบไม่ระบุตัวตนแล้วค้นมือมากที่สุด และยังไม่ต้องเสียเงิน

---

## ทางเลือกที่ 2: Google Custom Search API (ใช้เมื่อรันจากเซิร์ฟเวอร์ หรือ Puppeteer ได้ 0)

ระบบต้องใช้ **Google Custom Search JSON API** เมื่อ request จากเซิร์ฟเวอร์ (หรือเมื่อรัน local แล้วยังได้ 0)  
โควต้าฟรี **100 ครั้ง/วัน** (รันเช็ค 19 keywords = 19 ครั้ง ใช้ได้หลายรอบต่อวัน)

---

## ขั้นตอน (ใช้เวลา ~5 นาที)

### 1. สร้างโปรเจกต์และ API Key (Google Cloud)

1. ไปที่ **[Google Cloud Console](https://console.cloud.google.com/)**
2. ล็อกอินด้วยบัญชี Google
3. คลิก **Select a project** → **New Project** → ตั้งชื่อ (เช่น `seo-ranking`) → **Create**
4. ไปที่ **APIs & Services** → **Library** → ค้นหา **"Custom Search API"** → **Enable**
5. ไปที่ **APIs & Services** → **Credentials** → **Create Credentials** → **API key**
6. Copy **API Key** ไว้ (จะเอาไปใส่ใน `.env`)

### 2. สร้าง Search Engine (ได้ค่า CX)

1. ไปที่ **[Programmable Search Engine](https://programmablesearchengine.google.com/controlpanel/all)**
2. คลิก **Add** เพื่อสร้าง search engine ใหม่
3. ใน **Sites to search** เลือก **"Search the entire web"**
4. ตั้งชื่อ (เช่น `SEO Ranking`) → **Create**
5. เปิด **Customize** → ไปที่ **Setup** → copy ค่า **Search engine ID** (ขึ้นต้นด้วยตัวเลขและอักษร เช่น `a1b2c3d4e5f6g7h8i`) ไว้

### 3. ใส่ค่าในโปรเจกต์

1. ในโฟลเดอร์โปรเจกต์ สร้างหรือเปิดไฟล์ **`.env`** (อยู่ระดับเดียวกับ `package.json`)
2. เพิ่ม 2 บรรทัด (แทนที่ด้วยค่าจริง):

```env
GOOGLE_CSE_API_KEY=ใส่_API_Key_จากขั้นตอนที่_1
GOOGLE_CSE_CX=ใส่_Search_engine_ID_จากขั้นตอนที่_2
```

3. บันทึกไฟล์

### 4. ทดสอบ

- รัน `npx tsx scripts/debugRank.ts "หาแม่บ้าน"`  
  ถ้าตั้งค่าถูกต้องจะเห็น "จำนวนเว็บเราในผลค้นหา" หรือจำนวน URL ที่ดึงได้
- หรือกดปุ่ม **「เช็คอันดับตอนนี้」** ในหน้า `/ranking` แล้วดูตาราง

---

## หมายเหตุ

- ไม่ต้องใส่บัตรเครดิต ถ้าใช้ไม่เกิน 100 ครั้ง/วัน
- ถ้าใช้เกินโควต้าฟรี Google จะเรียกเก็บ (สามารถตั้ง daily limit ใน Cloud Console เป็น 100 เพื่อกันใช้เกินได้)
