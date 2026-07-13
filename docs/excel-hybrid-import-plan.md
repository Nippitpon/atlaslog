# แผน: รองรับ Import template แบบ Hybrid Powerlifting (2026-07-13)

> ✅ **สถานะ: implement + verify (e2e Playwright) ครบแล้ว — รอ commit/deploy** (ดู log.md รอบ 31)
> ทุกข้อในแผนด้านล่างทำเสร็จ ยกเว้น: ชิป template ที่แจกเป็น "compact Hybrid" (ไม่ใช่ก็อปไฟล์เต็ม)


> เป้าหมาย: ให้ import รองรับ layout ของ `Hybrid_Powerlifting-Template.xlsx` (= layout เดียวกับ
> `powerlifting_RPE_12weeks (Template).xlsx` ที่ใช้จริง) โดย **ยังรองรับ format เดิม (Program+Meta) ได้ด้วย**

## การตัดสินใจที่ยืนยันแล้ว (2026-07-13)
- **Format:** รับทั้ง 2 แบบ — ทำ normalization layer เดียว auto-detect (ไม่ branch แยก, ไม่พังของเดิม)
- **ชื่อโปรแกรม:** default จากชื่อไฟล์ + แก้ได้ในหน้า setup (Hybrid ไม่มี Meta)
- **Variant/Prescription:** เพิ่มฟิลด์ `label?` ใน `StructuredExercise` แสดงเป็น sub-text (เช่น "Competition · Top set")

## รูปแบบไฟล์ Hybrid (อ้างอิงไฟล์จริง)
- 1 sheet ชื่อ `Template`, header อยู่ row 1, data row 2 เป็นต้นไป
- คอลัมน์: `Week | Phase | Day | Lift | Variant | Prescription | Sets | Reps | PCT | RPE | Target Weight (kg) | Type | Notes`
- ค่า: Day = Mon/Tue/Thu/Fri · Lift = Squat/Bench/Deadlift · Type = Work/Test · Phase มี `Taper/Test`
- มี 12 สัปดาห์ · Week 11 มี 3 วัน · Week 12 (Test) มี 2 วัน

## Gap หลัก (ทำไมตอนนี้ import ไม่ผ่าน)
1. หา sheet `Meta` ไม่เจอ → เด้ง error ทันที (`excelImport.ts:38`)
2. header Title Case ไม่ match `col in firstRow` ตัวเล็ก (`:61`)
3. ไม่มี `exercise_id`/`exercise_name`/`focus`/`type` ตามที่บังคับ
4. `pct=1.02` (attempt) และ `rpe="<6.0"` (deload) ไม่ผ่าน coercion เดิม
5. Squat top set + back-off วันเดียวกัน → ชนกันที่ override key (บั๊ก A3/M2 ในรอบ 30)

---

## แผน implement

### 1. `apps/web/src/lib/excelImport.ts` — normalization layer
- [ ] อ่าน header จาก **row 1 จริง** (`sheet_to_json(sheet,{header:1})[0]`) แทนเช็ค key จาก data row (แก้บั๊ก A6 รอบ 30 ด้วย)
- [ ] **Header alias map** (normalize `lower.replace(/[^a-z0-9]+/g,'_')` แล้ว map):
  - `week`←Week · `phase`←Phase · `day_of_week`←Day · `lift`←Lift · `exercise_id`←exercise_id
  - `variant`←Variant · `prescription`←Prescription · `sets`←Sets · `reps`←Reps
  - `pct`←PCT/`%1rm` · `rpe`←RPE · `note`←Notes · `target_weight_kg`→**ignore (แอปคำนวณเอง)**
- [ ] **หา sheet ยืดหยุ่น**: `Program` → ถ้าไม่มีลอง `Template` → ถ้าไม่มีใช้ sheet แรกที่มีคอลัมน์ครบ
- [ ] **Meta optional**: ไม่มี sheet Meta ก็ไม่ error
- [ ] **Lift dictionary** → id+name: `Squat→{squat,"Squat"}`, `Bench→{bench,"Bench"}`, `Deadlift→{deadlift,"Deadlift"}` (+ alias "Back Squat"/"Bench Press"). ไม่มี `Lift` → ใช้ `exercise_id`/`exercise_name` เดิม; lift ไม่รู้จัก → accessory (ไม่คำนวณน้ำหนัก)
- [ ] **Type mapping**: `Work`/`Test`/ว่าง → `main`; `accessory`; `running`
- [ ] **Phase alias**: `Taper/Test` → `Taper`
- [ ] **Value coercion เข้ม** (แก้ A1/A2/A4/B1 รอบ 30 พร้อมกัน):
  - `sets`: จำนวนเต็ม 1–50, ไม่ผ่าน = error + เลข row
  - `reps`: จำนวนเต็ม ≥1 หรือ `AMRAP` (case-insensitive); ทศนิยม/≤0 = error
  - `pct`: `0 < pct ≤ 1.1` (ยอม attempt 1.02); นอกช่วง = error
  - `rpe`: เลข 5–10 → ใช้; string `<6.0`/`>9` → ดึงเลขนำหรือ undefined + เก็บข้อความต้นฉบับต่อท้าย note
- [ ] **ใส่ `id` ต่อแถว** `w{week}-{day}-e{idx}` (แก้ collision A3/M2)
- [ ] **`label`** = รวม `Variant` + `Prescription` เช่น "Competition · Top set" (เว้นว่างถ้าไม่มี)
- [ ] **`focus` ต่อวัน** = ชื่อ Lift ที่ไม่ซ้ำในวันนั้น เช่น "Squat · Deadlift"
- [ ] **`name`** คงเป็นชื่อ Lift สะอาด ("Squat") เพื่อ map id ได้ — รายละเอียดชุดอยู่ที่ `label`

### 2. `packages/shared/src/types.ts`
- [ ] เพิ่ม `label?: string` ใน `StructuredExercise` (optional, ไม่กระทบของเดิม/built-in)
- [ ] ไม่แก้ `ProgramPhase` (ใช้ alias `Taper/Test`→`Taper`)

### 3. `ImportProgramSheet.tsx` + `ProgramSetupSheet.tsx`
- [ ] เพิ่มช่องกรอก **ชื่อโปรแกรม** (default = ชื่อไฟล์ที่แปลงแล้ว) ในขั้น setup, แก้ได้
- [ ] ตาราง preview โชว์ `label` (Variant/Prescription) ให้เห็นว่า top set/back-off แยกกัน

### 4. แสดง `label` ใน UI (sub-text ใต้ชื่อท่า)
- [ ] `WeekDays.tsx` (แถวท่าในหน้า week)
- [ ] `LoggerPage.tsx` (header + chip row) · `FinishReview.tsx` · `HistoryPage.tsx`

### 5. Override key (จำเป็นสำหรับ template นี้)
- [ ] `WeekDays.tsx:250` + `twelveWeekProgram.ts:332` เปลี่ยนไปใช้ `ex.id` (เลิก fallback `exerciseId:rpe` ที่ชนกัน)

### 6. Template ที่แจก + docs
- [ ] แทน/เพิ่ม `apps/web/public/atlaslog-program-template.xlsx` เป็น layout Hybrid ให้ตรงกับที่ import ได้
- [ ] อัปเดต `docs/excel-import-guide.md` + ตาราง template ใน `CLAUDE.md`

---

## Edge case เฉพาะไฟล์นี้ (ต้องเทสต์)
- `<6.0` RPE (R30/33/36 deload) · `pct=1.02` (9 แถว attempt) · Week 11 = 3 วัน · Week 12 = Test 2 วัน
- Squat top set + back-off วันเดียวกัน (ต้องได้น้ำหนักคนละค่า) · phase `Taper/Test` · Variant "Technique/Speed" (ในไฟล์ RPE_12weeks)
- (option) day name ภาษาไทย "จันทร์" ในไฟล์ RPE_12weeks — เพิ่ม alias ไทยได้ถ้าต้องการรองรับไฟล์นั้นตรง ๆ

## แผนเทสต์
1. **Unit** `parseExcelFile(Hybrid.xlsx)` → 12 สัปดาห์, day/สัปดาห์ถูก, id squat/bench/deadlift, `<6.0`+`1.02` handle ถูก, `id` ไม่ซ้ำ, `label` ครบ, name default จากไฟล์
2. **Regression** template `Program`+`Meta` เดิมยัง import ผ่าน
3. **E2E** import Hybrid → ตั้ง 1RM → หน้า week โชว์ "Squat · Top set" กับ "Squat · Back-off" น้ำหนักคนละค่า

## เกี่ยวข้องกับรอบ 30
ข้อ A1/A2/A4/A6/B1 (Excel validation) และ A3/M2 (override collision) ใน `docs/code-review-2026-07-13.md`
ถูกแก้ไปพร้อมกันในงานนี้ — ทำรอบนี้ = เคลียร์บั๊กกลุ่ม Excel ของรอบ 30 ไปด้วย
