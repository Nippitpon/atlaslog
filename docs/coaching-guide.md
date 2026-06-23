# 👥 คู่มือฟีเจอร์ COACHING — Atlaslog

> อัปเดต: 2026-06-23 — flow ใหม่ **โค้ชเป็นฝ่าย add นักกีฬา** (เดิมนักกีฬากรอกโค้ดเอง)

ฟีเจอร์ COACHING ให้ **โค้ช** กับ **นักกีฬา (athlete)** เชื่อมโยงกัน เพื่อให้โค้ชดูข้อมูลการซ้อม
ของลูกศิษย์ได้ (อ่านอย่างเดียว) และแชร์โปรแกรมหากันได้ด้วยโค้ดสั้น ๆ

> ทุกอย่างใช้บัญชี Supabase กลาง — ต้อง **login** ก่อนถึงจะใช้ได้

ประกอบด้วย 3 ส่วนหลัก:
1. **Coach ↔ Athlete linking** — โค้ช add นักกีฬาเข้าทีม
2. **Coaching panel** — โค้ชดูข้อมูล/สถิติของลูกศิษย์ (read-only)
3. **Program Sharing** — แชร์โปรแกรมด้วยโค้ด 6 หลัก (แยกจาก coaching)

---

## 1. การเชื่อมโยง Coach ↔ Athlete

### ใครเห็นเมนู Coaching
ปุ่ม **Coaching** ใน Profile (และสิทธิ์เข้า `/coach`) แสดงเมื่อเป็น **coach หรือ admin**:
- `isCoach` เป็น true เมื่อ **ข้อใดข้อหนึ่ง**:
  - **Admin กำหนด role = `coach`** ให้ (หน้า Admin → toggle USER/COACH) → เห็นเมนูทันทีแม้ยังไม่มีลูกศิษย์
  - **มีนักกีฬาผูกอยู่อย่างน้อย 1 คน** (ระบบตรวจอัตโนมัติจากตาราง `coach_athlete`)
- **Admin** เห็นเมนู Coaching เสมอ (`isCoach || isAdmin`)
- **ผู้ใช้ทั่วไป (non-coach)** จะ **ไม่เห็น** อะไรเกี่ยวกับ coaching ในหน้า Profile เลย

### ขั้นตอนการผูก — **โค้ชเป็นฝ่าย add** (ตั้งแต่ 2026-06-23)

```
โค้ช: Profile → ปุ่ม Coaching → หน้า Athletes → ส่วน "ADD ATHLETE"
      → กรอก อีเมล หรือ โค้ด (8 ตัวแรกของ uuid) ของนักกีฬา → กด Add
```

- ใส่ได้ทั้ง **อีเมล** หรือ **โค้ด** ของนักกีฬา (ระบบ resolve ให้เอง ผ่าน Edge Function)
- เมื่อ add สำเร็จ:
  - สร้าง/อัปเดตแถวใน `coach_athlete` (`coach_id` = โค้ช, `athlete_id` = นักกีฬา, `status='active'`)
  - **นักกีฬาได้ notification** `coach_added` → ขึ้นแบนเนอร์บนหน้า Home: *"\<coach email\> added you as an athlete"*
  - โค้ชเห็นข้อความ `Added <athlete email>` และนักกีฬาโผล่ใน MY ATHLETES ทันที
- ป้องกัน: add ตัวเองไม่ได้ · ถ้าหาอีเมล/โค้ดไม่เจอ → `Athlete not found`

> 💡 **นักกีฬาไม่ต้องทำอะไร** — ไม่มีช่อง "กรอกโค้ดโค้ช" ในหน้า Profile อีกแล้ว โค้ชจัดการฝั่งเดียว

### การยกเลิกการผูก (Unlink)
โค้ชเปิดหน้า Athletes → กด **Unlink** ข้างชื่อนักกีฬา → ยืนยัน
→ ลบแถวใน `coach_athlete` → โค้ชจะ **อ่านข้อมูลนักกีฬาคนนั้นไม่ได้อีกต่อไปทันที** (บังคับด้วย RLS)

---

## 2. Coaching panel — ดูข้อมูลลูกศิษย์

เข้าจาก **Profile → ปุ่ม "Coaching"** (เห็นเฉพาะ coach/admin) หรือ route `/coach`

### หน้า Athletes (`/coach`)
- **ADD ATHLETE** — กรอกอีเมล/โค้ดเพื่อเพิ่มนักกีฬา (ดูข้อ 1)
- **MY ATHLETES (n)** — รายชื่อนักกีฬาทั้งหมดที่ผูกอยู่ (status active) พร้อมอีเมล
  - กดที่ชื่อ → เข้าหน้ารายละเอียด · กด **Unlink** → ยกเลิกการผูก
- อีเมลของนักกีฬาดึงผ่าน Edge Function `coach` (action `list-athletes`) เพราะอีเมลอยู่ใน
  `auth.users` ที่ client อ่านตรงไม่ได้

### หน้า Athlete Detail (`/coach/:athleteId`) — **อ่านอย่างเดียว (read-only)**
แสดงข้อมูลของนักกีฬาคนนั้น:
- **LIFETIME** — จำนวน workouts, kg รวมที่ยก, ชั่วโมงที่ซ้อม
- **PROGRAMS** — โปรแกรมที่นักกีฬาสร้าง/ใช้อยู่
- **RECENT WORKOUTS** — เซสชันล่าสุด พร้อม volume/sets/เวลา

> โค้ชดูได้อย่างเดียว **แก้ไขข้อมูลของนักกีฬาไม่ได้** (v1)

---

## 3. Program Sharing — แชร์โปรแกรมด้วยโค้ด

แชร์โปรแกรม **custom** หากันได้ (ไม่จำเป็นต้องเป็นคู่ coach-athlete ก็แชร์ได้ ขอแค่มีโค้ด)
**นี่คือช่องทางเดียวที่ผู้ใช้ทั่วไปกรอกโค้ด** (โค้ดโปรแกรม ไม่ใช่โค้ดโค้ช)

### ฝั่งคนแชร์ (เช่นโค้ชแชร์โปรแกรมให้ลูกศิษย์)
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
| โค้ช add นักกีฬา (resolve อีเมล/โค้ด → user_id) | **Edge Function `coach`** (`add-athlete`) | ต้องใช้ service_role อ่าน `auth.users` + เขียน notification ข้าม user |
| อ่าน session/program ของนักกีฬา | **client + RLS** (coach-read policy) | RLS อนุญาตให้โค้ชอ่านได้เฉพาะนักกีฬาที่ผูก active |
| ดึงอีเมลนักกีฬา | **Edge Function `coach`** (`list-athletes`) | อีเมลอยู่ใน `auth.users` |
| unlink | **client** ลบแถว `coach_athlete` | เจ้าของ (coach_id) ลบของตัวเองได้ผ่าน RLS |
| program sharing | **client** insert/select `shared_programs` | โค้ดสุ่ม = capability ความลับพอประมาณ |

- **service_role key อยู่เฉพาะใน Edge Function** (ฝั่ง server) — ไม่หลุดเข้า client bundle เด็ดขาด
- **RLS เป็นด่านบังคับจริง**: หลัง unlink โค้ช query ข้อมูลนักกีฬาได้ 0 แถวทันที (ข้อมูลยังอยู่ใน DB
  แต่ policy ไม่ให้อ่าน) — ทดสอบยืนยันแล้ว
- Edge Function ทุกตัว **verify token ของผู้เรียกฝั่ง server เสมอ** ไม่เชื่อ client

### Edge Function `coach` — actions
| action | ใครเรียก | ทำอะไร |
|--------|---------|--------|
| `add-athlete` { athlete } | โค้ช | resolve อีเมล/โค้ด → upsert `coach_athlete` (coach = ผู้เรียก) → notify นักกีฬา (`coach_added`) |
| `list-athletes` | โค้ช | คืนรายชื่อนักกีฬา active + อีเมล |
| `resolve-link` { code } | (legacy) | นักกีฬาผูกตัวเองกับโค้ชด้วยโค้ด — ยังมีใน backend แต่ **ไม่มี UI เรียกแล้ว** |

### ตารางที่เกี่ยวข้อง (Supabase)
- `coach_athlete` — `coach_id`, `athlete_id`, `status` (`active`/`archived`), `created_at`
- `shared_programs` — `code`, `owner_id`, `name`, `program` (jsonb)
- `notifications` — `user_id`, `type` (`coach_linked` / `coach_added` / `program_shared`), `data`, `read_at`
- `profiles.role` — `user` / `admin` / `coach` (admin กำหนด coach ได้)

### ไฟล์โค้ดหลัก
```
supabase/functions/coach/index.ts          → add-athlete, list-athletes, resolve-link (service_role)
apps/web/src/lib/coachApi.ts               → addAthlete, listAthletes, unlinkAthlete,
                                             getAthleteSessions, getAthletePrograms (RLS)
apps/web/src/lib/shareApi.ts               → createShare, importShare
apps/web/src/features/coach/CoachPage.tsx        → ADD ATHLETE + รายชื่อนักกีฬา
apps/web/src/features/coach/AthleteDetailPage.tsx → รายละเอียดนักกีฬา (read-only)
apps/web/src/features/profile/ProfilePage.tsx     → ปุ่ม Coaching (coach/admin เท่านั้น)
apps/web/src/features/programs/ProgramsPage.tsx   → Share / Import-by-code
```

> ⚠️ แก้ `supabase/functions/coach/index.ts` แล้วต้อง **redeploy** edge function เสมอ
> (Dashboard วางโค้ดใหม่ หรือ `npx supabase functions deploy coach`) — push git ไม่ deploy ให้

---

## สรุป flow แบบรวบรัด

```
[โค้ช]   Profile → Coaching → ADD ATHLETE → กรอกอีเมล/โค้ดนักกีฬา → Add
         → coach_athlete (active) + แจ้งเตือนนักกีฬา ("added you as an athlete")
[โค้ช]   MY ATHLETES → เลือกนักกีฬา → ดู workouts/programs (read-only)
[โค้ช]   Unlink → ตัดการเข้าถึงทันที (RLS)

[แชร์โปรแกรม] Programs → Share → โค้ด 6 หลัก → [คนรับ] Programs → Import by code → ได้สำเนาโปรแกรม
```
