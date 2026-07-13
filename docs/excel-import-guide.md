# 📥 คู่มือ Import โปรแกรมจาก Excel — Atlaslog

นำเข้าโปรแกรมเทรนของคุณเองเข้า Atlaslog ได้ด้วยไฟล์ Excel (`.xlsx` / `.xls`)

ระบบอ่าน **หัวคอลัมน์อัตโนมัติ** (ไม่สนตัวพิมพ์ใหญ่-เล็ก) และรองรับ **2 รูปแบบ**:
- **แบบ Hybrid/Coach** — sheet เดียวชื่อ `Template` คอลัมน์ `Week / Day / Lift / Variant / Prescription / …`
- **แบบเดิม** — sheet `Program` (+ `Meta`) คอลัมน์ `week / day_of_week / exercise_id / …`

> 💡 ดาวน์โหลดไฟล์ตัวอย่างพร้อมใช้งานได้ที่ `apps/web/public/atlaslog-program-template.xlsx`
> (หรือปุ่ม "ดาวน์โหลดไฟล์ตัวอย่าง" ในหน้า Import) — เปิดแล้วแก้ตัวเลขตามโปรแกรมตัวเองได้เลย

---

## รูปแบบหลัก — sheet `Template`

หนึ่ง **แถว = หนึ่งเซ็ตของท่า (prescription)** ในวันนั้น ๆ แถวแรกเป็นหัวคอลัมน์

| คอลัมน์ | ชนิด | บังคับ | ตัวอย่าง | หมายเหตุ |
|---------|------|:-----:|----------|----------|
| `Week` | จำนวนเต็ม ≥ 1 | ✅ | `1` | สัปดาห์ที่เท่าไหร่ |
| `Day` | Mon–Sat | ✅ | `Mon` | รองรับชื่อเต็ม (`Monday`) + ไทย (`จันทร์`) |
| `Lift` | ข้อความ | ✅ | `Squat` | `Squat`/`Bench`/`Deadlift` → คำนวณน้ำหนักจาก 1RM |
| `Sets` | จำนวนเต็ม 1–50 | ✅ | `4` | จำนวนเซ็ต |
| `Reps` | จำนวนเต็ม ≥ 1 หรือ `AMRAP` | ✅ | `5` | จำนวนครั้ง |
| `Phase` | ข้อความ | ❌ | `Accumulation` | ดูกฎด้านล่าง |
| `Variant` | ข้อความ | ❌ | `Competition` | รวมเป็น label ใต้ชื่อท่า |
| `Prescription` | ข้อความ | ❌ | `Top set` | รวมเป็น label ใต้ชื่อท่า |
| `PCT` | 0–1.1 | ❌ | `0.75` | % ของ 1RM (0.75 = 75%; attempt เกิน 100% ได้ถึง 1.1) |
| `RPE` | ตัวเลข | ❌ | `8` | ถ้าไม่ใช่ตัวเลข (เช่น `<6.0`) จะเก็บไว้ใน note |
| `Type` | `Work` / `Test` / `accessory` | ❌ | `Work` | `Work`/`Test`/ว่าง = ท่าหลัก |
| `Notes` | ข้อความ | ❌ | `Pause 1 วิ` | โน้ตของท่า |

> คอลัมน์อื่น (เช่น `Target Weight (kg)`) จะถูก **ข้าม** — แอปคำนวณน้ำหนักจาก 1RM ของคุณเองเสมอ

### กฎสำคัญ

- **`Phase`** map อัตโนมัติจากคำที่มี: `Accum*` → Accumulation · `Intens*` → Intensification ·
  `Peak*` → Peaking · `Taper*`/`Test*` → Taper (เช่น `Taper/Test` = Taper) — ค่าอื่น = Accumulation
- **`Lift`** → `Squat`/`Bench`/`Deadlift` (รวม `Back Squat`/`Bench Press`) map เป็นท่าในระบบเพื่อคำนวณน้ำหนัก
  ท่าอื่นที่ไม่รู้จักยัง import ได้ (เป็นท่าเสริม ไม่คำนวณน้ำหนัก)
- **`Variant` + `Prescription`** → รวมเป็น label เช่น `Competition · Top set` แสดงใต้ชื่อท่าทุกที่
  (หน้า week / logger / review) — ทำให้ **Top set กับ Back-off ของลิฟต์เดียวกันไม่ปนกัน**
- **`PCT` มาก่อน `RPE`** ในการคำนวณน้ำหนัก (มี PCT → ใช้ PCT, ไม่มีก็ใช้ RPE table)
- ท่าหลายเซ็ตใน **วันเดียวกัน** ใส่ `Week` + `Day` ซ้ำหลายแถว — เรียงตามลำดับแถวในไฟล์
- แต่ละวันคำนวณ **focus อัตโนมัติ** จากชื่อลิฟต์ที่ไม่ซ้ำ (เช่น `Squat · Deadlift`)

### ตัวอย่างข้อมูล (sheet `Template`)

| Week | Phase | Day | Lift | Variant | Prescription | Sets | Reps | PCT | RPE | Type | Notes |
|------|-------|-----|------|---------|--------------|------|------|-----|-----|------|-------|
| 1 | Accumulation | Mon | Squat | Competition | Top set | 1 | 5 | 0.75 | 7 | Work | คุมจังหวะ |
| 1 | Accumulation | Mon | Squat | Competition | Back-off | 4 | 5 | 0.70 | 6 | Work | |
| 1 | Accumulation | Mon | Deadlift | Volume | Work sets | 3 | 6 | 0.70 | 7 | Work | |
| 3 | Taper/Test | Fri | Squat | Competition | Attempt 3 | 1 | 1 | 1.02 | 9.5 | Test | 3rd attempt |

---

## ชื่อโปรแกรม

- ถ้ามี sheet `Meta` และมีค่า `name` → ใช้ค่านั้น
- ถ้าไม่มี → ใช้ **ชื่อไฟล์** เป็นค่าเริ่มต้น (เช่น `Hybrid_Powerlifting-Template.xlsx` → "Hybrid Powerlifting Template")
- แก้ชื่อได้ในขั้น **Setup** ก่อนบันทึกเสมอ

---

## รูปแบบเดิม — sheet `Program` + `Meta` (ยังรองรับ)

คอลัมน์ตัวพิมพ์เล็ก: `week`, `phase`, `day_of_week`, `focus`, `exercise_name`, `exercise_id`,
`type` (`main`/`accessory`), `sets`, `reps`, `pct`, `rpe`, `note` — ทำงานเหมือนเดิมทุกอย่าง

sheet `Meta` (optional) รูปแบบ key/value:

| key | value | บังคับ |
|-----|-------|:-----:|
| `name` | `My 8 Week Program` | ❌ (ไม่มี = ใช้ชื่อไฟล์) |
| `description` | `สำหรับ intermediate lifter` | ❌ |
| `focus` | `Squat · Bench · Deadlift` | ❌ |
| `program_type` | `powerlifting` / `general` | ❌ |

- **`powerlifting`** (ค่าเริ่มต้น) — คำนวณน้ำหนักต่อเซ็ตจาก 1RM
- **`general`** — ไม่คำนวณน้ำหนัก ผู้ใช้กรอกเอง + ไม่โชว์ SBD/1RM

---

## ขั้นตอน Import ในแอป

1. ไปที่หน้า **Programs** → กดปุ่ม **Import from Excel**
2. เลือกไฟล์ `.xlsx` / `.xls`
3. ระบบตรวจสอบไฟล์ — ถ้าผิดจะบอก **เลขแถว** ที่มีปัญหา
4. ดู preview สรุปสัปดาห์/วัน + ตัวอย่างวันแรก (เห็น label Top set/Back-off) → กดถัดไป
5. (โปรแกรม powerlifting) แก้ชื่อโปรแกรม + กรอก **Start Date** + **1RM** (หรือใช้ 1RM จากโปรไฟล์)
6. บันทึก → โปรแกรมพร้อมใช้งาน

---

## ข้อผิดพลาดที่พบบ่อย

| อาการ | สาเหตุ / วิธีแก้ |
|-------|-----------------|
| `ไม่พบตารางโปรแกรมที่อ่านได้` | ไม่มี sheet ที่มีคอลัมน์ `Week`, `Day`, `Lift` (หรือ `exercise_id`) ครบ |
| `Row N: "Sets" ต้องเป็นจำนวนเต็ม 1–50` | Sets ว่าง/ติดลบ/ทศนิยม/มากเกินไป |
| `Row N: "Reps" ต้องเป็นจำนวนเต็มบวก หรือ "AMRAP"` | Reps เป็นช่วง (`5-8`) หรือทศนิยม — ใส่ค่าเดียว |
| `Row N: "PCT" ต้องอยู่ในช่วง 0–1.1` | ใส่ `75` แทน `0.75` หรือค่าเกิน 110% |
| `Row N: "Day" ต้องเป็น Mon/Tue/...` | วันสะกดผิด (รองรับ Mon–Sat, ชื่อเต็ม, ไทย — ไม่รองรับ Sun) |
