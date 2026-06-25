# 📥 คู่มือ Import โปรแกรมจาก Excel — Atlaslog

นำเข้าโปรแกรมเทรนของคุณเองเข้า Atlaslog ได้ด้วยไฟล์ Excel (`.xlsx` / `.xls`)
ไฟล์ต้องมี **2 sheet** ชื่อตรงเป๊ะ: `Program` และ `Meta`

> 💡 ดาวน์โหลดไฟล์ตัวอย่างพร้อมใช้งานได้ที่ `apps/web/public/atlaslog-program-template.xlsx`
> เปิดแล้วแก้ตัวเลขตามโปรแกรมตัวเองได้เลย

---

## Sheet 1 — `Program`

หนึ่ง **แถว = หนึ่งท่า** ในวันนั้น ๆ แถวแรกเป็นหัวคอลัมน์ (ชื่อต้องตรงตามตาราง)

| คอลัมน์ | ชนิด | บังคับ | ตัวอย่าง | หมายเหตุ |
|---------|------|:-----:|----------|----------|
| `week` | จำนวนเต็ม ≥ 1 | ✅ | `1` | สัปดาห์ที่เท่าไหร่ |
| `phase` | ข้อความ | ✅ | `Accumulation` | ต้องเป็น 1 ใน 4 ค่า (ดูด้านล่าง) |
| `day_of_week` | Mon–Sat | ✅ | `Mon` | วันในสัปดาห์ |
| `focus` | ข้อความ | ✅ | `Squat Focus` | โฟกัสของวันนั้น |
| `exercise_name` | ข้อความ | ✅ | `Back Squat` | ชื่อท่าที่แสดงผล |
| `exercise_id` | ข้อความ | ✅ | `squat` | id ของท่า (ดูหมายเหตุ) |
| `type` | `main` / `accessory` | ✅ | `main` | ท่าหลัก หรือ ท่าเสริม |
| `sets` | จำนวน ≥ 1 | ✅ | `3` | จำนวนเซ็ต |
| `reps` | จำนวน หรือ `AMRAP` | ✅ | `5` | จำนวนครั้ง |
| `pct` | 0–1 | ❌ | `0.75` | % ของ 1RM (0.75 = 75%) |
| `rpe` | 6–10 | ❌ | `8` | ระดับความหนัก |
| `note` | ข้อความ | ❌ | `เน้น bar path` | โน้ตของท่า |

### กฎสำคัญ

- **`phase`** ต้องเป็นหนึ่งใน: `Accumulation` · `Intensification` · `Peaking` · `Taper`
  (ถ้าใส่ค่าอื่น ระบบจะตั้งให้เป็น `Accumulation` อัตโนมัติ) — phase ของแต่ละสัปดาห์
  ยึดจากแถวแรกของสัปดาห์นั้น
- **`exercise_id`** จะถูกแปลงอัตโนมัติ: ตัวพิมพ์เล็กทั้งหมด + เว้นวรรคเปลี่ยนเป็น `_`
  เช่น `Back Squat` → `back_squat` — แนะนำให้ใช้ id ที่ตรงกับท่าในระบบ
  (`squat`, `bench`, `deadlift`) เพื่อให้คำนวณน้ำหนักจาก 1RM ได้
- **`pct` กับ `rpe`** ใส่อย่างใดอย่างหนึ่งหรือทั้งคู่ก็ได้ / เว้นว่างได้
- ท่าหลายท่าใน **วันเดียวกัน** ให้ใส่ `week` + `day_of_week` ซ้ำในหลายแถว
- ท่าจะเรียงตามลำดับแถวในไฟล์ / วันเรียงตาม Mon → Sat อัตโนมัติ

### ตัวอย่างข้อมูล (Sheet `Program`)

| week | phase | day_of_week | focus | exercise_name | exercise_id | type | sets | reps | pct | rpe | note |
|------|-------|-------------|-------|---------------|-------------|------|------|------|-----|-----|------|
| 1 | Accumulation | Mon | Squat Focus | Back Squat | squat | main | 4 | 5 | 0.75 | | |
| 1 | Accumulation | Mon | Squat Focus | Leg Press | leg_press | accessory | 3 | 10 | | 8 | |
| 1 | Accumulation | Wed | Bench Focus | Bench Press | bench | main | 4 | 5 | 0.72 | | เน้น leg drive |
| 1 | Accumulation | Fri | Deadlift Focus | Deadlift | deadlift | main | 3 | 3 | 0.80 | | |
| 2 | Intensification | Mon | Squat Focus | Back Squat | squat | main | 4 | 3 | 0.82 | | |

---

## Sheet 2 — `Meta`

ข้อมูลหัวเรื่องของโปรแกรม รูปแบบ **key / value** (คอลัมน์ A = key, คอลัมน์ B = ค่า)

| คอลัมน์ A (key) | คอลัมน์ B (value) | บังคับ |
|-----------------|-------------------|:-----:|
| `name` | `My 8 Week Program` | ✅ |
| `description` | `สำหรับ intermediate lifter` | ❌ |
| `focus` | `Squat · Bench · Deadlift` | ❌ |
| `program_type` | `powerlifting` หรือ `general` | ❌ |

### `program_type` (optional)

- **`powerlifting`** (ค่าเริ่มต้น ถ้าเว้นว่าง) — ระบบ **คำนวณน้ำหนักต่อเซ็ตจาก 1RM** (`1RM × pct` หรือจาก RPE)
- **`general`** — **ไม่คำนวณน้ำหนัก** ผู้ใช้กรอกน้ำหนักเอง + ไม่โชว์ SBD/1RM
- ไฟล์เทมเพลตเดิม (ไม่มีแถวนี้) ยังใช้ได้ตามปกติ — ถือเป็น `powerlifting` อัตโนมัติ

---

## ขั้นตอน Import ในแอป

1. ไปที่หน้า **Programs** → กดปุ่ม **`+ Import from Excel`**
2. เลือกไฟล์ `.xlsx` / `.xls`
3. ระบบตรวจสอบไฟล์ — ถ้าผิดจะบอก **เลขแถว** ที่มีปัญหา
4. ดู preview สรุปสัปดาห์/วัน → กดถัดไป
5. (โปรแกรม **powerlifting**) กรอก **วันเริ่ม (Start Date)** + **1RM** — หรือใช้ 1RM จากโปรไฟล์
6. บันทึก → โปรแกรมพร้อมใช้งาน

---

## ข้อผิดพลาดที่พบบ่อย

| อาการ | สาเหตุ / วิธีแก้ |
|-------|-----------------|
| `ไม่พบ Sheet ชื่อ "Program"` / `"Meta"` | ชื่อ sheet ไม่ตรง (ต้องเป๊ะ ตัวพิมพ์ใหญ่-เล็กมีผล) |
| `ไม่พบ column: "xxx"` | หัวคอลัมน์สะกดผิด หรือมีเว้นวรรคเกิน |
| `Row N: "day_of_week" ต้องเป็น Mon/Tue/...` | ใช้ `Sun` หรือชื่อเต็ม (`Monday`) ไม่ได้ |
| `Row N: "type" ต้องเป็น main หรือ accessory` | สะกดผิด เช่น `Main` (ต้องพิมพ์เล็ก) |
| `Sheet "Meta": ต้องมี row ที่มี key "name"` | ลืมใส่แถว `name` ใน sheet Meta |
