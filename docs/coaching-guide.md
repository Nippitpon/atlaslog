# 👥 คู่มือฟีเจอร์ COACHING — Atlaslog

ฟีเจอร์ COACHING ให้ **โค้ช** กับ **นักกีฬา (athlete)** เชื่อมโยงกัน เพื่อให้โค้ชดูข้อมูลการซ้อม
ของลูกศิษย์ได้ และแชร์โปรแกรมหากันได้ด้วยโค้ดสั้น ๆ

ประกอบด้วย 3 ส่วนหลัก:
1. **Coach ↔ Athlete linking** — ผูกบัญชีโค้ชกับนักกีฬา
2. **Coach Panel** — โค้ชดูข้อมูล/สถิติของลูกศิษย์ (อ่านอย่างเดียว)
3. **Program Sharing** — แชร์โปรแกรมด้วยโค้ด 6 หลัก

> ทุกอย่างใช้บัญชี Supabase กลาง — ต้อง **login** ก่อนถึงจะใช้ได้

---

## 1. การเชื่อมโยง Coach ↔ Athlete

### ใครเป็นโค้ชได้บ้าง
ผู้ใช้จะกลายเป็น "โค้ช" (`isCoach = true` → เห็นปุ่ม **Coach Panel**) เมื่อเข้าเงื่อนไข **ข้อใดข้อหนึ่ง**:
- **Admin กำหนด role = `coach`** ให้ (หน้า Admin → toggle USER/COACH) → เห็น Coach Panel ทันทีแม้ยังไม่มีลูกศิษย์
- **มีนักกีฬาผูกอยู่อย่างน้อย 1 คน** (ระบบตรวจอัตโนมัติจากตาราง `coach_athlete`)

### ขั้นตอนการผูก (ฝั่งนักกีฬาเป็นคนกด)

```
โค้ช:     เปิด Profile → ส่วน COACHING → คัดลอก "MY COACH CODE" (8 ตัวอักษร) ส่งให้นักกีฬา
นักกีฬา:  เปิด Profile → ส่วน COACHING → ช่อง "CONNECT A COACH"
          → ใส่โค้ชโค้ด (8 ตัว) หรือ อีเมลของโค้ช → กด Connect
```

- **Coach code** = 8 ตัวอักษรแรกของ user id (uuid) ของโค้ช แสดงเป็นตัวพิมพ์ใหญ่
- ใส่ได้ทั้ง **โค้ด** หรือ **อีเมล** ของโค้ช (ระบบ resolve ให้เอง)
- เมื่อผูกสำเร็จ:
  - สร้างแถวใน `coach_athlete` (`coach_id`, `athlete_id`, `status='active'`)
  - **โค้ชได้ notification** `coach_linked` → ขึ้นแบนเนอร์บนหน้า Home (กระดิ่ง) + badge
  - นักกีฬาเห็นข้อความ `Connected to <coach email>`
- ป้องกัน: ผูกกับตัวเองไม่ได้

### การยกเลิกการผูก (Unlink)
โค้ชเปิด **Coach Panel** → กด **Unlink** ข้างชื่อนักกีฬา → ยืนยัน
→ ลบแถวใน `coach_athlete` → โค้ชจะ **อ่านข้อมูลนักกีฬาคนนั้นไม่ได้อีกต่อไปทันที** (บังคับด้วย RLS)

---

## 2. Coach Panel — ดูข้อมูลลูกศิษย์

เข้าจาก **Profile → ปุ่ม "Coach Panel"** (เห็นเฉพาะคนที่เป็นโค้ช) หรือ route `/coach`

### หน้า Athletes (`/coach`)
- รายชื่อนักกีฬาทั้งหมดที่ผูกอยู่ (status active) พร้อมอีเมล
- กดที่ชื่อ → เข้าหน้ารายละเอียด · กด Unlink → ยกเลิกการผูก
- อีเมลของนักกีฬาดึงผ่าน Edge Function `coach` (action `list-athletes`) เพราะอีเมลอยู่ใน
  `auth.users` ที่ client อ่านตรงไม่ได้

### หน้า Athlete Detail (`/coach/:athleteId`) — **อ่านอย่างเดียว (read-only)**
แสดงข้อมูลของนักกีฬาคนนั้น:
- **LIFETIME** — จำนวน workouts, kg รวมที่ยก, ชั่วโมงที่ซ้อม
- **PROGRAMS** — โปรแกรมที่นักกีฬาสร้าง/ใช้อยู่
- **RECENT WORKOUTS** — เซสชันล่าสุด (สูงสุด 30 รายการ) พร้อม volume/sets/เวลา

> โค้ชดูได้อย่างเดียว **แก้ไขข้อมูลของนักกีฬาไม่ได้** (v1)

---

## 3. Program Sharing — แชร์โปรแกรมด้วยโค้ด

แชร์โปรแกรม **custom** หากันได้ (ไม่จำเป็นต้องเป็นคู่ coach-athlete ก็แชร์ได้ ขอแค่มีโค้ด)

### ฝั่งคนแชร์
```
Programs → การ์ดโปรแกรม custom → ปุ่ม Share (ไอคอน)
→ ระบบสร้าง "โค้ด 6 หลัก" → คัดลอกส่งให้คนอื่น
```
- โค้ด 6 หลักสุ่มจากตัวอักษร/ตัวเลขที่ไม่กำกวม (ตัด `0/O/1/I` ออก)
- บันทึกสำเนาโปรแกรมลงตาราง `shared_programs` (`code`, `owner_id`, `name`, `program`)

### ฝั่งคนรับ
```
Programs → ปุ่มลิงก์ (🔗 มุมขวาบน) → ใส่โค้ด 6 หลัก → Import
```
- ดึงโปรแกรมจากโค้ด → คัดลอกเป็นโปรแกรมใหม่ในบัญชีตัวเอง (`id` ใหม่ = `custom-<timestamp>`)
- ถ้าโค้ดผิด → `Program not found for that code`

---

## สถาปัตยกรรม / ความปลอดภัย

| ส่วน | กลไก | เหตุผล |
|------|------|--------|
| อ่าน session/program ของนักกีฬา | **client + RLS** (coach-read policy) | RLS อนุญาตให้โค้ชอ่านได้เฉพาะนักกีฬาที่ผูก active |
| resolve โค้ด/อีเมล → user_id | **Edge Function `coach`** (`resolve-link`) | ต้องใช้ service_role อ่าน `auth.users` |
| ดึงอีเมลนักกีฬา | **Edge Function `coach`** (`list-athletes`) | อีเมลอยู่ใน `auth.users` |
| unlink | **client** ลบแถว `coach_athlete` | เจ้าของ (coach_id) ลบของตัวเองได้ผ่าน RLS |
| program sharing | **client** insert/select `shared_programs` | โค้ดสุ่ม = ความลับพอประมาณ |

- **service_role key อยู่เฉพาะใน Edge Function** (ฝั่ง server) — ไม่หลุดเข้า client bundle เด็ดขาด
- **RLS เป็นด่านบังคับจริง**: หลัง unlink โค้ช query ข้อมูลนักกีฬาได้ 0 แถวทันที (ข้อมูลยังอยู่ใน DB
  แต่ policy ไม่ให้อ่าน) — ทดสอบยืนยันแล้ว
- Edge Function ทุกตัว **verify token ของผู้เรียกฝั่ง server เสมอ** ไม่เชื่อ client

### ตารางที่เกี่ยวข้อง (Supabase)
- `coach_athlete` — `coach_id`, `athlete_id`, `status` (`active`/`archived`), `created_at`
- `shared_programs` — `code`, `owner_id`, `name`, `program` (jsonb)
- `notifications` — `user_id`, `type` (`coach_linked` / `program_shared`), `data`, `read_at`
- `profiles.role` — `user` / `admin` / `coach` (admin กำหนด coach ได้)

### ไฟล์โค้ดหลัก
```
supabase/functions/coach/index.ts          → resolve-link, list-athletes (service_role)
apps/web/src/lib/coachApi.ts               → linkCoach, listAthletes, unlinkAthlete,
                                             getAthleteSessions, getAthletePrograms (RLS)
apps/web/src/lib/shareApi.ts               → createShare, importShare
apps/web/src/features/coach/CoachPage.tsx        → รายชื่อนักกีฬา
apps/web/src/features/coach/AthleteDetailPage.tsx → รายละเอียดนักกีฬา (read-only)
apps/web/src/features/profile/ProfilePage.tsx     → COACHING section (โค้ด + connect)
apps/web/src/features/programs/ProgramsPage.tsx   → Share / Import-by-code
```

---

## สรุป flow แบบรวบรัด

```
[นักกีฬา] ──ขอโค้ดโค้ช──> [โค้ช คัดลอกจาก Profile]
[นักกีฬา] ใส่โค้ด/อีเมล + Connect ──> coach_athlete (active) + แจ้งเตือนโค้ช
[โค้ช]   Coach Panel ──> ดูรายชื่อ ──> เลือกนักกีฬา ──> ดู workouts/programs (read-only)
[โค้ช]   Unlink ──> ตัดการเข้าถึงทันที (RLS)

[แชร์โปรแกรม] Share ──> โค้ด 6 หลัก ──> [คนรับ] Import by code ──> ได้สำเนาโปรแกรม
```
