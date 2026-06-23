# Atlaslog — Development Log

> อัปเดตล่าสุด: 2026-06-23 (รอบ 7: Athlete consent + Create Program)
>
> 📘 คู่มือฟีเจอร์ Coaching ฉบับล่าสุด: `docs/coaching-guide.md`

---

## 2026-06-23 — รอบ 7: Athlete ต้อง accept + Create Program

### 1. Coach add → Athlete ต้องกด Accept (consent flow)
> เดิม add แล้ว active ทันที → เปลี่ยนเป็น **pending จนกว่า athlete จะ accept** (RLS coach-read
> เช็ค `status='active'` อยู่แล้ว → pending = โค้ชยังอ่านข้อมูลไม่ได้)
- **Edge fn `coach`:**
  - `add-athlete` → insert `status='pending'` (กัน downgrade ถ้า active อยู่แล้ว) + notify athlete
    type `coach_request` {coach_id, coach_email}
  - action ใหม่ `respond-link` {coachId, accept} → accept: update active + notify โค้ช `coach_linked`;
    decline: ลบแถว + notify โค้ช `coach_declined`
  - `list-athletes` → คืน `status` ด้วย (โชว์ pending/active)
- **DB:** ALTER `coach_athlete` CHECK ให้รับ `pending` (SUPABASE_SETUP **section 2e**)
- `types.ts` `AthleteSummary.status` · `coachApi` `addAthlete` (คืน status) + `respondCoachRequest`
- `CoachPage` — badge "PENDING — awaiting accept" + ข้อความ "Request sent to …"
- `DashboardPage` — การ์ด **COACH REQUEST** (Accept/Decline) แยกจาก banner ปกติ;
  notificationText รองรับ `coach_declined`

### 2. Create Program (+ ในหน้า Programs) — โครง 1 สัปดาห์ × N
- หน้าใหม่ `/programs/new` (`CreateProgramPage.tsx`): ชื่อ/โฟกัส/จำนวนสัปดาห์ + เพิ่มวัน
  (เลือก Mon–Sat + focus) + เพิ่มท่าต่อวัน (picker จาก library + main/accessory + sets/reps/RPE)
  → สร้าง StructuredProgram (`source:'manual'`) ทำซ้ำ template N สัปดาห์ → addCustomProgram (sync)
- `ProgramsPage` — ปุ่ม **+** ใน header → `/programs/new`; pill "CUSTOM" สำหรับ source manual
- `types.ts` `StructuredProgram.source` += `'manual'`
- แก้ z-index picker sheet (zIndex 100) กันปุ่ม Add to Day ชน bottom nav

- **ผล:** `pnpm build` + `pnpm lint` ผ่าน
- ✅ **e2e Create Program (Playwright 390px):** สร้าง "My PPL" 4 สัปดาห์ + วัน Mon "Push Day" +
  MAIN Bench Press 4×5 → overview แสดง 4 weeks + tag CUSTOM → Week 1 detail แสดงท่าถูก + Start ได้ · 0 errors
- ⚠️ **consent flow ต้องทำ backend ก่อน e2e:** (1) รัน SQL section 2e (ALTER pending) (2) **redeploy
  edge function `coach`** — แล้วค่อยทดสอบ add→pending→athlete accept→active

---

## 2026-06-23 — รอบ 6: Coach add athletes ได้เอง (coach-initiated linking)

> หลังลบ "CONNECT A COACH" ออกจาก Profile → ไม่มีทางผูก coach-athlete ทาง UI เลย.
> เฟสนี้เพิ่มฝั่งโค้ชเป็นคน add athlete.

- **Edge Function `coach`** — action ใหม่ `add-athlete` {athlete: email/code} → resolve user →
  upsert `coach_athlete` (coach_id = caller, athlete_id = target, active) → notify athlete
  (type `coach_added`, data.coach_email). rename helper `resolveCoach`→`resolveUser` (generic)
- `lib/coachApi.ts` — `addAthlete(value)`
- `features/coach/CoachPage.tsx` — section **ADD ATHLETE** (input email/code + ปุ่ม Add + Enter) →
  addAthlete → refresh list + feedback; แก้ empty-state text เดิม (เลิกอ้าง coach code ใน Profile)
- `DashboardPage.tsx` — `notificationText` รองรับ `coach_added` → "{coach_email} added you as an athlete"
- **ผล:** `pnpm build` + `pnpm lint` ผ่าน
- ✅ **e2e frontend (Playwright 390px):** coach.test → /coach เห็น section ADD ATHLETE; กด Add →
  ได้ error "Edge Function returned a non-2xx status code" (เพราะ edge function ยังไม่ redeploy →
  action `add-athlete` = Unknown) = wiring ทำงานถูก
- ✅ **redeploy edge function `coach` แล้ว + e2e เต็มผ่าน (2026-06-23):** coach.test unlink athlete.a
  → MY ATHLETES (0) → ADD ATHLETE กรอก `athlete.a@atlaslog.app` → "Added athlete.a@..." →
  MY ATHLETES (1) กลับมา → login athlete.a เห็น notification banner "coach.test@atlaslog.app
  added you as an athlete" บน Home · 0 console errors

---

## 2026-06-23 — UX fixes รอบ 5: admin เข้า Coaching ได้

- ปุ่ม Coaching ใน Profile: เงื่อนไข `isCoach` → **`isCoach || isAdmin`** — `ProfilePage.tsx`
- guard `/coach` + `/coach/:id`: ใช้ `canCoach = isCoach || isAdmin` (เดิม `isCoach` ล้วน) +
  อัปเดต useEffect deps — `CoachPage.tsx`, `AthleteDetailPage.tsx`
- **ผล:** `pnpm build` + `pnpm lint` ผ่าน
- ✅ **e2e (Playwright 390px):** coach.test เห็น Coaching (ไม่ regression); athlete.a (ไม่ใช่
  coach/admin) ไม่เห็น · admin-positive verify ด้วย code review — login-test ไม่ได้ (ไม่มีรหัส
  admin earthharuethai@gmail.com) แต่เป็น OR branch เดียวกับ coach + guard mirror กัน

---

## 2026-06-23 — UX fixes รอบ 4: COACHING เฉพาะ coach

- **ลบ section COACHING ออกจาก Profile ทั้งหมด** (MY COACH CODE + CONNECT A COACH + handlers/state/
  imports linkCoach/IconCopy) — `ProfilePage.tsx`
- **เหลือเฉพาะปุ่ม "Coaching"** (เดิม "Coach Panel") ที่ขึ้นเฉพาะ `isCoach` → กด → `/coach`
  (MY ATHLETES) — relabel แล้ว
- **การใส่โค้ด** → ใช้ Programs → Import by code เท่านั้น (ของเดิม ไม่ต้องแตะ)
- **ผล:** `pnpm build` + `pnpm lint` ผ่าน
- ✅ **e2e (Playwright 390px):**
  - athlete.a (non-coach): Profile ไม่มี COACHING/MY COACH CODE/CONNECT A COACH/ปุ่ม Coaching เลย
    (เหลือ LIFETIME, 1RM, BODY, PREFERENCES)
  - coach.test (isCoach): มีปุ่ม "Coaching · MY ATHLETES →" → กดไป `/coach` เห็น athlete.a · 0 errors

---

## 2026-06-23 — UX fixes รอบ 3

1. **เอาปุ่ม + (Quick Start FAB) ออกจาก Home** — `DashboardPage.tsx` ลบ FAB + ฟังก์ชัน `quickStart`
   + เก็บกวาด import/destructure ที่ไม่ใช้ (dayToProgram, calcWeight, IconPlus, setShowPicker,
   startWorkout, getConfig, getCustomAccessories) — เริ่มซ้อมผ่านหน้า Programs แทน
2. **Running summary = Weekly total** — `RunsPage` เปลี่ยนการ์ดสรุปจาก all-time → **THIS WEEK**
   (calendar week Sun–Sat) DISTANCE + TIME + AVG PACE; RECENT RUNS ยังแสดงทุกครั้งเหมือนเดิม
- **ผล:** `pnpm build` + `pnpm lint` ผ่าน
- ✅ **e2e (Playwright 390px):** Home ไม่มี FAB (`aria-label="Quick start workout"` = null);
  RunsPage "THIS WEEK" = 5km/30min/6:00 (เฉพาะ run วันนี้) — run 6/20 (สัปดาห์ก่อน) ไม่ถูกนับ
  ในยอดสัปดาห์ แต่ยังอยู่ใน RECENT RUNS · 0 console errors

---

## 2026-06-23 — UX fixes รอบ 2 (จาก feedback ผู้ใช้)

1. **Home: ปุ่ม Running หลุดขอบจอ** — shortcuts row เดิม flex 3 ปุ่ม (Programs/Exercises/Running)
   ล้นที่ 390px → เปลี่ยนเป็น `grid` 3 คอลัมน์ + ปุ่ม compact (padding 6, gap 6, font 13,
   minWidth 0 + ellipsis) — `DashboardPage.tsx`
2. **Running เก็บวันที่** — `RunsPage` เพิ่มช่อง DATE (input type=date, default วันนี้, max วันนี้,
   log ย้อนหลังได้) → past date anchor ที่ noon กัน timezone เลื่อนวัน
3. **Profile: ฟอนต์ช่อง "Coach code / email" ล้น** — ลด fontSize → 13 + minWidth 0 — `ProfilePage.tsx`
4. **เพิ่มท่าระหว่างซ้อม + บันทึกใน History** —
   - `useAppStore.addExerciseToWorkout(exerciseId)` — append WorkoutExercise (1 set ว่าง) เข้า
     workout ปัจจุบัน + ตั้ง currentIdx ไปท่าใหม่ → finish แล้วเข้า History อัตโนมัติ
   - `LoggerPage` — ปุ่ม **"+ Add"** ท้าย exercise tab strip → เปิด picker (reuse `SwapSheet`
     ที่ทำให้ `current`/`title` เป็น optional)
   - `LibraryPage` — แถวเดิมเป็น `<div>` ไม่มี onClick (chevron หลอกว่าคลิกได้) → เปลี่ยนเป็น
     `<button>` เปิด action sheet: ถ้ามี workout active → "Add to current workout" (เข้า /workout);
     ถ้าไม่มี → hint + ปุ่มไป Programs
   - หมายเหตุ: flow วางแผนล่วงหน้าต่อวัน (WeekDetailPage → Edit → `AccessoryEditSheet`) มีอยู่แล้ว
     และ accessory ที่เพิ่มเข้า workout ตอน Start → บันทึกใน History อยู่แล้ว
5. **formatDate นับเป็น calendar-day** — เดิม floor เวลาที่ผ่านจริง → run ที่ anchor noon โชว์
   "2 DAYS AGO" แทน 3 → แก้ให้ zero time ทั้งสองวันแล้ว round (ถูกต้องกว่า + ช่วย History) — `utils.ts`
- **ผล:** `pnpm build` + `pnpm lint` ผ่าน · `grep service_role dist` = 0
- ✅ **e2e ผ่าน (Playwright 390px, athlete.a, หลัง reconnect MCP):**
  - #1 ปุ่ม Running ขอบขวา 370 < 390 ไม่ล้น
  - #2 log run ย้อนหลัง 2026-06-20 → เก็บวันถูก → แสดง "3 DAYS AGO"
  - #3 ช่อง coach code fontSize 13, scrollWidth 218 ≤ 220 ไม่ล้น
  - #4 Logger "+ Add" → เลือก Barbell Curl → finish → **History แสดง Barbell Curl 30×10 TOP**;
    Library คลิกได้: มี workout → "Add to current workout" (Cable Fly เข้า workout); ไม่มี → hint + Go to Programs
  - 0 console errors

---

## 2026-06-23 — B1 Body Composition + B2 Running (Phase B)

> เก็บข้อมูลน้ำหนักตัว (body comp) + การวิ่ง, sync cloud + e2e ผ่าน. SQL section 2d รันแล้ว.

### B1 — Body Composition (น้ำหนัก + มวลกล้ามเนื้อ + %ไขมัน)
- ออกแบบเผื่อคำนวณ **BMR/TDEE ใน phase ถัดไป** (ตอนนี้เก็บข้อมูลดิบ)
- `types.ts` `BodyMetricEntry { id, date, weightKg, skeletalMuscleKg?, bodyFatPct? }`
- `useAppStore` — `bodyMetrics[]` + add/remove/set + persist + sync
- **ProfilePage** section BODY COMPOSITION — กรอก 3 ค่า → Log today + ค่าล่าสุด + กราฟแนวโน้มน้ำหนัก (≥2 entries)

### B2 — Running / Cardio (ระยะ + เวลา, pace อัตโนมัติ)
- `types.ts` `RunEntry { id, date, distanceKm, durationMin, note? }` (pace = dur/dist, ไม่เก็บ)
- `useAppStore` — `runs[]` + add/remove/set + persist + sync
- **หน้าใหม่ `/runs`** (`features/runs/RunsPage.tsx`) — ฟอร์มเพิ่ม + totals (ระยะ/เวลา/pace เฉลี่ย) + รายการ + ลบ
- **Dashboard** shortcut "Running" + **History** รวม run card ใน timeline เดียว (sort by date)
- `formatPace()` ใน `utils.ts` (M:SS /km)

### Sync / infra
- `syncQueue.ts` — ops ใหม่: `body-metric-upsert/delete`, `run-upsert/delete` + sync fns
- `useAuthStore.loadUserData` — pull `body_metrics` + `runs` ตอน login (map snake→camel)
- `ProfilePage.handleSignOut` — `clearMetrics()` กัน data leak ข้ามบัญชี
- ตาราง Supabase ใหม่ `body_metrics` + `runs` (SUPABASE_SETUP.md **section 2d**, รันแล้ว 2026-06-23)

### ✅ e2e ผ่าน (Playwright 390px, athlete.a, 2026-06-23)
- **B1:** Log 75kg/35kg(muscle)/15%(fat) → ค่าล่าสุดแสดงถูก
- **B2:** Add run 5km/30min → totals 5.0km·30min·**6:00/km** (pace ถูก) → Run card โผล่บนสุด History
  timeline คละกับ lifting session
- **cross-device round-trip:** finish → sync-queue=`[]` → `localStorage.clear()` → re-login →
  bodyMetrics + runs กลับมาครบจาก cloud (mapping ถูก) → **0 console errors**
- `pnpm build` + `pnpm lint` ผ่าน · `grep service_role dist` = 0

### ✅ Committed + deployed 2026-06-23
- branch `feat/body-running-and-sync-fixes` (commit `a783f69`) → merge --no-ff เข้า `main`
  (merge `cd20d17`) → push origin → **Vercel auto-deploy**
- รวมงานทั้งวันในก้อนเดียว: 4 bug fixes แรก + A1 + A2 + B1 + B2 (ไฟล์ทับซ้อนกันเลย commit รวม)
- prod (https://atlaslog-web.vercel.app) เข้าถึงได้หลัง push
- ⚠️ prod feature retest เต็ม (Playwright) ยังไม่ได้ทำรอบนี้ (MCP playwright หลุดหลัง kill node) —
  verify แล้วบน local + Supabase จริง; prod ใช้ Supabase project เดียวกัน + ตาราง 2c/2d รันแล้ว

---

## 2026-06-23 — A1 History แสดงทุก set + A2 sync progress ข้ามเครื่อง

### A1 — History แสดง back-off set (เดิมโชว์แค่ TOP SET)
- **อาการ:** ซ้อม Squat 140×3 (top) + back-off 2 เซ็ต แต่ History โชว์แค่บรรทัดเดียว
- **สาเหตุ:** `HistoryPage.tsx` `SessionCard` จัดกลุ่ม set ตาม exerciseId แล้ว `reduce` เอาแค่
  เซ็ตหนักสุดมาโชว์ — back-off (squat เบากว่า) ถูกบันทึกครบใน data แต่ไม่ render
- **แก้:** render ทุก set ที่ done เป็น inline list (`140×3 TOP · 120×5 · 120×5`),
  มาร์กเซ็ตหนักสุดด้วย label TOP สี accent. ไม่แตะ data model

### A2 — Sync program progress/config ข้ามเครื่อง
- **อาการ:** ซ้อม+record บนมือถือ → เปิด browser คอม History ขึ้น (sync แล้ว) แต่
  Active Program บน Home ไม่รู้ว่าซ้อมถึงวันไหน
- **สาเหตุ:** `useProgramStore` เก็บ `progress`/`configs`/`customAccessories` ใน localStorage
  อย่างเดียว (ต่างจาก `sessions` ที่ sync) → อีกเครื่อง progress ว่าง
- **แก้ (last-write-wins ทั้ง blob, 1 row/user):**
  - ตารางใหม่ `program_state` (SUPABASE_SETUP.md **section 2c**) — progress + configs +
    custom_accessories เป็น jsonb + RLS own-row
  - `types.ts` — `ProgramStateSnapshot`, `ProgramCustomAccessories`
  - `syncQueue.ts` — op `program-state-upsert` (dedupe: เก็บแค่ตัวล่าสุดใน queue)
  - `useProgramStore` — `queueStateSync()` debounce 800ms ยิงทุก mutation
    (setDayStatus/setConfig/setCustomAccessories/resetProgram/removeCustomProgram) +
    `setProgramState()` สำหรับ pull (ไม่ re-trigger sync)
  - `useAuthStore.loadUserData` — pull `program_state` (`.maybeSingle()`) ตอน login;
    โหลดเฉพาะเมื่อ cloud มี row จริง (กัน clobber local ที่ยังค้างใน queue)
  - `ProfilePage.handleSignOut` — clear program state กัน data leak ข้ามบัญชีบนเครื่องเดียวกัน
- **ผล:** `pnpm build` + `pnpm lint` ผ่าน, `grep service_role dist` = 0
- ✅ **รัน SQL section 2c ใน Supabase แล้ว** (2026-06-23, "Success. No rows returned")

### ✅ e2e ผ่าน (Playwright 390px, บัญชี athlete.a, 2026-06-23)
- **A1:** บันทึก Bench 90×3 (top) + 70×8 + 70×8 → History แสดงครบ 3 set:
  `90kg×3 TOP · 70kg×8 · 70kg×8` (back-off ขึ้นแล้ว, มาร์ก TOP ถูกเซ็ต)
- **A2 (cross-device round-trip เด็ดขาด):** finish workout → sync-queue = `[]` (push cloud สำเร็จ)
  → `localStorage.clear()` (จำลองเครื่องใหม่) → login ใหม่ → Active Program กลับมาแสดง
  **W4 · 3/12 weeks · 25%** + ไอคอน ✓ Mon/Tue/Thu (progress มาจาก cloud ล้วน ๆ) → **0 console errors**

---

---

## สถานะปัจจุบัน

| Phase | งาน | สถานะ |
|-------|-----|-------|
| 1 | Core UX (Router, Dashboard, Logger, History, Library, Profile) | ✅ Done |
| 2 | Excel Import (.xlsx → StructuredProgram) | ✅ Done |
| 3 | Supabase Auth + Cloud Sync | ✅ Done — เชื่อม Supabase จริง + ทดสอบ local ผ่าน (เหลือ Vercel env vars สำหรับ production) |
| 3.5 | Admin-Confirms-Users (signup approval gate) | ✅ Done (commit `edf1f70`) — เดิมเรียก "Phase 4" แต่จริง ๆ เป็นส่วนต่อ auth |
| 4 | Social: Coach-Athlete + Program sharing + In-app reminder | ✅ Done — merged main + deploy prod + ทดสอบ prod ผ่าน (2026-06-22, `f6529fe`) |
| 4.1 | Admin-assignable Coach role + UI/UX fixes | ✅ Done (2026-06-22) — ทดสอบ prod ผ่าน |

---

## Phase 4.1 — Admin-assignable Coach role + UI fixes (2026-06-22)

**Design change:** เดิม coach เป็น "relational" (ใครมีลูกศิษย์ผูก = โค้ช, ไม่แตะ `profiles.role`)
ตอนนี้ admin กำหนด role ได้ → `isCoach = (profiles.role === 'coach') OR มี active athlete links`
(คง derived-coach เดิมไว้ ไม่ทำให้โค้ชเก่าหลุด)

- **Backend** `supabase/functions/admin-users/index.ts` — action ใหม่ `set-role` {userId, role:'user'|'coach'};
  guard: เปลี่ยน role ตัวเองไม่ได้ + แตะ admin ไม่ได้ → **deploy แล้วผ่าน Dashboard**
- **DB constraint:** `profiles.role` เดิม `check (role in ('user','admin'))` ปฏิเสธค่า `coach` → 500
  แก้ด้วย `ALTER ... CHECK (role IN ('user','admin','coach'))` ใน Supabase SQL Editor → ผ่าน
- `apps/web/src/lib/adminApi.ts` — `setUserRole()` + ดึงข้อความ error จริงจาก `FunctionsHttpError.context`
  (เดิม supabase-js ซ่อนไว้เป็น generic "non-2xx status code")
- `features/admin/AdminPage.tsx` — toggle USER/COACH ในแถว user ที่ confirm แล้ว (ไม่ใช่ admin/ตัวเอง)
- `store/useAuthStore.ts` — `loadIsCoach(id, role)` เช็ค role==='coach' ก่อน
- **UI fixes:** (1) `.card` เพิ่ม `color: var(--text)` — ปุ่ม `<button class=card>` (Admin/Coach Panel)
  เดิมใช้สี UA default มืดใน dark theme; (2) ช่อง 1RM ใน ProfilePage width 72→116 (162.5 ถูกตัด)
- **Docs:** `docs/excel-import-guide.md` + ไฟล์ตัวอย่าง `apps/web/public/atlaslog-program-template.xlsx`
  + ลิงก์ดาวน์โหลด template ในหน้า Import
- **commit:** `ed4cc5d` (role + UI fixes + excel docs) — push main → Vercel deploy, prod-verified

### งานเพิ่มเติม session 2026-06-22 (commits ต่อเนื่อง)

- **Weekly Volume chart (Home)** — `lib/utils.ts` `weeklyVolume()` เดิมเป็น rolling 7 วันล่าสุด
  (จุดเริ่มเลื่อนตามวันปัจจุบัน) → เปลี่ยนเป็น **สัปดาห์ตามปฏิทินเริ่มวันอาทิตย์** (Sun→Sat,
  ป้าย S M T W T F S, วันนี้ไฮไลต์). commit `70e720d`
  - หมายเหตุ: เคยลอง Monday-start ก่อน แล้วผู้ใช้ขอเปลี่ยนเป็น Sunday-start
  - ค้าง: การ์ด "SBD TOTAL (WEEK)" ยังเป็น rolling 7 วัน (ไม่ได้แก้ — ไม่ถูกสั่ง)
- **เอกสาร COACHING** — `docs/coaching-guide.md` (linking / coach panel / program sharing +
  สถาปัตยกรรม RLS vs Edge Function). commit `d7f7e82`
- **Import-by-code UX** — commit `1fe3cfe` (ดู FIXED BUG ด้านล่าง)
- **บั๊ก Import-by-code + แก้ RLS** — commit `472e226` (ดู FIXED BUG ด้านล่าง)

---

## ✅ FIXED BUG — "Import by code" ขึ้น "Program not found for that code" (แก้ 2026-06-22)

**อาการ:** เจ้าของแชร์โปรแกรมได้โค้ด 6 หลัก แต่ผู้ใช้ **อีกบัญชี** เอาไปใส่ช่อง Import by code →
ขึ้น `Program not found for that code` (เจ้าของเองอ่านโค้ดตัวเองได้ปกติ)

**สาเหตุจริง (ยืนยันแล้ว):** SELECT policy ของ `shared_programs` ใช้ `auth.role() = 'authenticated'`
ซึ่ง Supabase deprecate แล้ว → คืนค่าเพี้ยน/null → เงื่อนไขเป็น false → ผู้ใช้คนอื่นอ่านได้ 0 แถว
(insert ทำงานปกติ — มีแถว `KB22FT` ใน DB; ปัญหาอยู่ฝั่งอ่านข้ามบัญชีล้วน ๆ).
e2e เดิม share→import ในบัญชีเดียวเลยไม่จับบั๊กนี้

**วิธีแก้ (รันใน Supabase SQL Editor — DDL ถาวรแล้ว):**
```sql
drop policy if exists "any authed reads by code" on public.shared_programs;
create policy "any authed reads by code" on public.shared_programs
  for select to authenticated using (true);
```
ทดสอบยืนยัน: login บัญชีอื่น → Import `KB22FT` → โปรแกรมเข้า MY PROGRAMS สำเร็จ ✅
(`SUPABASE_SETUP.md` อัปเดตให้ใช้ policy แบบใหม่แล้ว)

**โค้ดที่แก้คู่กัน (commit `1fe3cfe`):** `ProgramsPage.tsx` — Share ไม่กลืน error เงียบอีก
(ขึ้น sheet "Share failed") + label Import-by-code ชี้ชัดว่าใช้ share code 6 หลัก ไม่ใช่ coach code

---

## Phase 3 — สิ่งที่ทำไปแล้ว (code-side)

Commits: `9de2433` → `0f19806` → `9ad5a31` → pull-on-login commit

- `apps/web/src/lib/supabase.ts` — Supabase client (อ่าน env vars)
- `apps/web/src/store/useAuthStore.ts` — signIn, signUp, signOut, onAuthStateChange + **pull-on-login**
- `apps/web/src/features/auth/AuthPage.tsx` — หน้า login/register (email + password)
- `apps/web/src/components/layout/AppShell.tsx` — init auth, redirect `/login` ถ้ายังไม่ authed
- `apps/web/src/router.tsx` — เพิ่ม route `/login`
- `useAppStore` — `finishWorkout` sync session ขึ้น Supabase (ใช้ snake_case columns)
- `useProgramStore` — `addCustomProgram` / `removeCustomProgram` sync ขึ้น Supabase
- `ProfilePage` — แสดง email + ปุ่ม Sign Out (ล้าง local data)
- `apps/web/vercel.json` — fix Vercel monorepo install (cd workspace root ก่อน pnpm install)
- `.node-version` — pin Node 20 (required by @supabase/supabase-js@2.108.0)
- `SUPABASE_SETUP.md` — คู่มือ SQL schema + Vercel env vars
- `LOGIN_GUIDE.md` — คู่มือ sign up / sign in / sign out + data sync behavior

### pull-on-login (ใหม่)

เมื่อ `SIGNED_IN` event เกิดขึ้น `useAuthStore` จะ:
1. ดึง `sessions` จาก Supabase → โหลดเข้า `useAppStore.history`
2. ดึง `custom_programs` จาก Supabase → โหลดเข้า `useProgramStore.customPrograms`

---

## งานที่ทำเพิ่ม — session 2026-06-14

### ขั้นที่ 0 — แก้ pull-on-login bugs (commit `d6f4d9f`)

- `useAuthStore` — เพิ่ม `loadUserData()` ที่ map snake_case columns
  (`program_id` → `programId`, `set_count` → `setCount`) กลับเป็น camelCase
  ถูกต้องตอน `SIGNED_IN`
- `useAppStore.finishWorkout` — แก้ upsert ให้ใช้ explicit snake_case column
  mapping แทนการ spread camelCase `Session` object (เดิม columns ไม่ตรง schema)
- `AuthPage` — ลบ `loadCloudData()` ที่ซ้ำซ้อน (useAuthStore จัดการอยู่แล้ว)
  และ buggy (ไม่ได้ remap columns) ออก

### ขั้นที่ 1 — แก้ bug จอขาวเมื่อ env vars หาย (commit `60ea998`)

> **อาการ:** เปิดแอปแล้ว "ไม่ขึ้นอะไรเลย" (จอขาว) เมื่อไม่มี `.env.local`

- **ต้นตอ:** `createClient('', '')` throw ทันทีตอน import เมื่อ env vars ว่าง
  → ทั้งแอป crash
- `supabase.ts` — export `isSupabaseConfigured` flag + ส่ง placeholder URL/key
  เข้า `createClient` กัน throw ตอน import
- `AppShell.tsx` — ถ้า `!isSupabaseConfigured` แสดงหน้าแจ้งเตือน "ยังไม่ได้
  ตั้งค่า Supabase" พร้อมวิธีแก้ แทนจอขาว + skip `init()`
- verify ด้วย Playwright (viewport 390px) → หน้าแจ้งเตือนขึ้นจริง ✅

### งานที่ทำเพิ่ม — session 2026-06-15

#### ขั้นที่ 2 — เชื่อม Supabase จริง ✅
- สร้าง `apps/web/.env.local` ใส่ `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` จริง
- โปรเจกต์ Supabase: `rhilcsfhibymgyoaltem` (SQL schema + RLS run แล้ว)

#### ขั้นที่ 3 — Code Gaps + ทดสอบ local ด้วย Playwright (390px) ✅

**Offline fallback (ใหม่):**
- `apps/web/src/lib/syncQueue.ts` — persisted sync queue (localStorage key `atlas:v1:sync-queue`)
  - `syncSession` / `syncProgramUpsert` / `syncProgramDelete` — ลอง sync, ถ้า fail → enqueue
  - `flushQueue()` — retry queued ops, ลบตัวที่สำเร็จ, เก็บตัว fail ไว้รอบหน้า
- `useAppStore.finishWorkout` + `useProgramStore.add/removeCustomProgram` — เปลี่ยนจาก
  fire-and-forget `.then(()=>{})` มาใช้ helper ที่ enqueue เมื่อ fail
- `useAuthStore.init` — เรียก `flushQueue()` ตอน SIGNED_IN/มี session + ผูก `window 'online'` event

**Resend confirmation email (ใหม่):**
- `useAuthStore.resendConfirmation(email)` → `supabase.auth.resend({ type: 'signup' })`
- `AuthPage` หน้า "Check your email" — เพิ่มปุ่ม Resend + cooldown 30s + error/success feedback

**ผลทดสอบ Playwright (ผ่านทั้งหมด):**
- ✅ Supabase config โหลดได้ (ไม่ติดหน้า "ยังไม่ได้ตั้งค่า")
- ✅ Sign up → "Check your email" + ปุ่ม resend (เจอ rate-limit 429 → error แสดงถูกต้อง)
- ✅ Sign in → redirect `/` (หลังปิด Confirm email ใน Supabase Auth settings)
- ✅ Session sync: บันทึก workout → sign out → sign in → pull-on-login โหลดกลับมาครบ
- ✅ Offline fallback: patch fetch ให้ block REST → finishWorkout → op เข้า queue →
  dispatch `online` → flush → sign out/in → session ขึ้นจาก Supabase จริง (round-trip ผ่าน)
- ✅ `pnpm build` ผ่าน, ไฟล์ที่แก้ทั้งหมด lint สะอาด

### Production fix — session 2026-06-19 (commit `12d9bc6`)

- **เจอบั๊ก deep-link 404 บน prod:** เข้า `/login` `/admin` ตรง ๆ / refresh → Vercel ตอบ 404
  (ไม่มี SPA fallback rewrite ใน `apps/web/vercel.json`)
- **แก้:** เพิ่ม `"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]`
- **หมายเหตุสำคัญ:** commit Phase 4 (`edf1f70`) เพิ่งถูก push ขึ้น remote พร้อม fix นี้ —
  **ก่อนหน้านี้ prod รันโค้ดเก่า (ยังไม่มี Phase 4)**. หลัง push → Vercel auto-deploy
- **ทดสอบ prod หลัง deploy (Playwright 390px):** `/login` hard-load ไม่ 404 แล้ว ✅ ·
  login admin → ปุ่ม Admin Panel ขึ้น · `/admin` โหลด user list ผ่าน edge function จริง
  (CORS ผ่านโดเมน prod) ✅

### ยังค้างอยู่

- [x] **P0-2: ช่องโหว่ self-confirm — ปิดแล้ว** ✅ ตัด `{{ .ConfirmationURL }}` ออกจาก
  email template "Confirm signup" ใน Supabase แล้ว → user ไม่มีลิงก์ self-confirm,
  เหลือทางเดียวคือ admin กด Confirm ผ่าน edge function (สอดคล้องผลทดสอบเคส 5→6)
- [x] ~~**ขั้นที่ 4** — ใส่ env vars ใน Vercel~~ (เสร็จตั้งแต่ Phase 3) (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) +
  redeploy + ทดสอบ production (ผู้ใช้ทำใน Vercel dashboard)
- [ ] **เปิด Confirm email กลับ** ใน Supabase ก่อนใช้งานจริง (ตอนทดสอบปิดไว้) — กัน spam signup

> **ทิศทาง:** เลือก **Cloud-first** — คงระบบ auth-gate ไว้ (ต้อง login ถึงใช้ได้)

---

## Phase 3 — สิ่งที่ยังต้องทำ (infrastructure)

> **บล็อคอยู่ตรงนี้** — code พร้อมแล้วแต่ยังไม่ได้ setup Supabase จริง

### ขั้นตอนที่ต้องทำ (ตามลำดับ)

- [ ] **1. สร้าง Supabase project**
  - ไปที่ supabase.com → New project → ตั้งชื่อ `atlaslog`
  - เลือก region ใกล้ที่สุด (Singapore / Southeast Asia)

- [ ] **2. Run SQL Schema**
  - ไปที่ SQL Editor ใน Supabase dashboard
  - Copy SQL จาก `SUPABASE_SETUP.md` section 2 แล้ว run
  - ตาราง: `sessions` + `custom_programs` พร้อม Row Level Security

- [ ] **3. เอา API Keys**
  - Settings → API → copy `Project URL` และ `anon public` key

- [ ] **4. ใส่ env vars ใน Vercel**
  - `VITE_SUPABASE_URL` = `https://xxxx.supabase.co`
  - `VITE_SUPABASE_ANON_KEY` = `eyJ...`
  - Redeploy หลังใส่ค่า

- [ ] **5. ทดสอบ local**
  - สร้างไฟล์ `apps/web/.env.local` ใส่ค่าเดียวกัน
  - `pnpm dev` → ลอง sign up → confirm email → sign in
  - บันทึก workout → ตรวจใน Supabase dashboard ว่า row ขึ้นจริง

- [ ] **6. ทดสอบ sync**
  - บันทึก session → ตรวจ `sessions` table ใน Supabase
  - Import custom program → ตรวจ `custom_programs` table
  - Sign out → Sign in ใหม่ → ข้อมูลต้องโหลดกลับมา ✅ (pull-on-login implement แล้ว)

---

## ปัญหาที่รู้อยู่แล้ว / สิ่งที่ยังขาด

| ปัญหา | รายละเอียด | ความเร่งด่วน |
|-------|-----------|-------------|
| ~~**Pull-on-login ยังไม่ทำ**~~ | ✅ แก้แล้ว | — |
| ~~**ไม่มี offline fallback**~~ | ✅ แก้แล้ว — `syncQueue.ts` enqueue เมื่อ fail + flush ตอน online/login | — |
| ~~**Email confirmation UX**~~ | ✅ เพิ่มปุ่ม resend confirmation แล้ว | — |
| ~~**signUp UI bug**~~ | ✅ หายเอง — เปิด Confirm email แล้ว signUp ไม่ได้ session ทันที, UI โชว์ "รอแอดมินอนุมัติ" ถูกต้อง (verify 2026-06-19) | — |
| ~~**lint error DashboardPage**~~ | ✅ แก้แล้ว 2026-06-23 — ย้าย `getWeekStatus` เข้าไปเรียกใน useMemo callback ผ่าน `getState()`, เพิ่ม `progress` เป็น dep | — |
| ~~**SBD TOTAL (WEEK) rolling 7 วัน**~~ | ✅ แก้แล้ว 2026-06-23 — เปลี่ยนเป็น calendar week (Sun–Sat) เหมือน Weekly Volume chart | — |
| ~~**admin guard race**~~ | ✅ แก้แล้ว 2026-06-23 — เพิ่ม `roleLoaded` flag ใน AuthStore; guard รอก่อน redirect | — |
| ~~**pull เฉพาะตอน SIGNED_IN**~~ | ✅ แก้แล้ว 2026-06-23 — `init()` เรียก `loadUserData()` ตอน `getSession()` เจอ user แล้ว | — |
| ~~**ยังไม่ได้ทดสอบ production**~~ | ✅ ใส่ env vars ใน Vercel + login บน production ได้แล้ว | — |
| ~~**Confirm email ปิดอยู่**~~ | ✅ เปิดกลับแล้ว 2026-06-19 (ตอนทำ admin-confirm flow) | — |

---

## Phase 4 — Admin-Confirms-Users (✅ Done — setup + ทดสอบ + commit ครบ 2026-06-19)

> **เป้าหมาย:** เปลี่ยน signup flow จาก "user กดลิงก์ยืนยันใน email เอง" → **"admin อนุมัติ/ยืนยัน user"**
>
> **สถานะ (session 2026-06-19):** ✅ setup Supabase ครบ (profiles+trigger, bootstrap admin
> `earthharuethai@gmail.com`, deploy Edge Function `admin-users`, เปิด Confirm email กลับ) →
> ทดสอบ Playwright 390px ครบ 8/8 เคส ผ่านหมด → build + service_role ไม่หลุด bundle → commit แล้ว

### ข้อจำกัดทางเทคนิคที่ต้องรู้ (สำคัญ)

- confirm user (set `auth.users.email_confirmed_at`) **ต้องใช้ service_role ผ่าน Edge Function เท่านั้น**
  — SQL editor แก้ `auth.users` ตรง ๆ ไม่ได้ (`permission denied`), security-definer ก็ไม่รอด
- **service_role key ห้ามวางฝั่ง frontend** — อยู่เฉพาะใน Edge Function env (Supabase inject
  `SUPABASE_SERVICE_ROLE_KEY` ให้อัตโนมัติ); ทุก `VITE_*` ถูก bundle ไป client ห้ามใส่
- "ใครเป็น admin" เก็บใน `public.profiles.role` (SQL editor แก้ได้) → bootstrap admin คนแรกด้วย SQL

### กลไกหลัก (เลือกแล้ว)

คง **"Confirm email" เปิด** ใน Supabase → user ใหม่ login ไม่ได้จนกว่า admin จะ confirm
(`email_confirm: true` ผ่าน Edge Function) → ใช้ `email_confirmed_at` เดิมเป็น "ประตูอนุมัติ"
ไม่ต้องมี approved-flag แยก

### ขอบเขต admin panel
List + Confirm (พื้นฐาน) · Reject/Delete user · ดู user ทั้งหมด + สถานะ

---

### Checklist — Backend (Supabase)

- [x] **1. ตาราง `public.profiles`** (role) ✅ รันแล้ว 2026-06-19
  ```sql
  create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    role text not null default 'user' check (role in ('user','admin')),
    created_at timestamptz default now()
  );
  alter table public.profiles enable row level security;
  create policy "read own profile" on public.profiles for select using (auth.uid() = id);
  ```

- [x] **2. Trigger auto-create profile ตอน signup** ✅ รันแล้ว + backfill
  ```sql
  create function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = '' as $$
  begin
    insert into public.profiles (id) values (new.id) on conflict do nothing;
    return new;
  end; $$;
  create trigger on_auth_user_created
    after insert on auth.users for each row execute function public.handle_new_user();
  ```
  backfill user เดิม: `insert into public.profiles (id) select id from auth.users on conflict do nothing;`

- [x] **3. Bootstrap admin คนแรก** ✅ `earthharuethai@gmail.com` = admin (SQL editor — public table แก้ได้)
  ```sql
  update public.profiles set role = 'admin' where id = '<OWNER_USER_UUID>';
  ```
  หา UUID จาก Authentication → Users

- [x] **4. Edge Function `admin-users`** ✅ เขียนแล้วที่ `supabase/functions/admin-users/index.ts`
  (verify admin server-side, actions list/confirm/delete, CORS) — **ยังต้อง deploy**
  - **deploy:** Dashboard in-browser editor (Edge Functions → New function → วางโค้ดจากไฟล์) **หรือ** Supabase CLI
    (`supabase login` → `supabase link` → `supabase functions deploy admin-users`)
  - ไม่ต้องตั้ง secret เพิ่ม — Supabase inject `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` ให้ edge runtime อัตโนมัติ

- [x] **5. เปิด "Confirm email" กลับ** ✅ เปิดแล้ว ใน Authentication settings (Phase 3 ปิดไว้)

### Checklist — Frontend (React) — ✅ เขียนเสร็จทั้งหมด

- [x] **6.** `packages/shared/src/types.ts` — `AdminUser` ✅
- [x] **7.** `apps/web/src/lib/adminApi.ts` — `listUsers/confirmUser/deleteUser` ✅
- [x] **8.** `useAuthStore` — `isAdmin` (query `profiles.role`), reset ตอน signOut/SIGNED_OUT ✅
- [x] **9.** `apps/web/src/features/admin/AdminPage.tsx` — Pending/Confirmed + Confirm/Reject/Delete ✅
- [x] **10.** `router.tsx` — route `/admin` ✅
- [x] **11.** Route guard — `!isAdmin` → `<Navigate to="/" />` (ใน AdminPage) ✅
- [x] **12.** `ProfilePage.tsx` — ปุ่ม "Admin Panel" เฉพาะ isAdmin ✅
- [x] **13.** `AuthPage.tsx` — signupDone → "รอแอดมินอนุมัติ" (ตัดปุ่ม resend) ✅

### คำแนะนำเพิ่ม (ควรมี)

- **Defense in depth:** `isAdmin` ฝั่ง client ใช้แค่ซ่อน/โชว์ UI — Edge Function **ต้อง** verify role server-side เสมอ
- **Confirm-before-delete** + กัน admin ลบ account ตัวเอง
- **Pagination:** `listUsers()` default 50/page — เผื่อ user เยอะในอนาคต
- **(future)** audit: `confirmed_by uuid` / log ว่าใคร confirm ใคร
- หลัง implement: ตรวจ service_role ไม่หลุด client bundle (`grep -r SERVICE_ROLE apps/web/dist` ต้องไม่เจอ)

### ✅ เสร็จแล้ว 2026-06-19 (เดิม: resume here)

**โค้ด + setup + ทดสอบ + commit ครบทุกอย่าง:**

1. **4 ขั้นใน Supabase** — ทำครบแล้ว (profiles+trigger+backfill, bootstrap admin
   `earthharuethai@gmail.com`, deploy Edge Function `admin-users`, เปิด Confirm email)
2. **ทดสอบ Playwright 390px ครบ 8/8 เคส ผ่านหมด** (ดูผลด้านล่าง)
3. **commit แล้ว** — `pnpm build` ผ่าน, `service_role` ไม่หลุดเข้า client bundle (grep dist = 0)

> **หมายเหตุ bug เล็ก (ต่ำ):** navigate ตรงไป `/admin` ทันทีหลัง login จะถูก redirect กลับ `/`
> เพราะ `loadRole()` (query `profiles.role`) เป็น async ยังไม่เสร็จตอน guard เช็ค — กดปุ่ม Admin
> Panel จากหน้า Profile (หลัง role โหลดเสร็จ) ใช้ได้ปกติ. ไม่กระทบความปลอดภัย (Edge Function
> verify role server-side อยู่แล้ว) — ไว้ปรับ guard ให้รอ role โหลดเสร็จในอนาคต

### Verification — 8 เคส (Playwright 390px) — ✅ ผ่านครบ 2026-06-19

1. ✅ สมัคร user ใหม่ → เห็น "รอแอดมินอนุมัติ" (ไม่มีปุ่ม resend — signUp UI bug หายเองเพราะเปิด Confirm email)
2. ✅ login ด้วย user ใหม่ → ติด "Email not confirmed"
3. ✅ login เป็น admin → Profile เห็นปุ่ม **Admin Panel**
4. ✅ เข้า `/admin` → เห็น user ใหม่ในกลุ่ม **Pending** (edge function `list` ทำงาน + Delete ตัวเอง disabled)
5. ✅ กด **Confirm** → user ย้ายไป Confirmed (edge function `confirm`)
6. ✅ login ด้วย user ที่เพิ่ง confirm → เข้าได้
7. ✅ กด **Delete** → confirm dialog → หายจาก list + auth.users (edge function `delete`)
8. ✅ login เป็น user ธรรมดา → เข้า `/admin` ตรง ๆ → redirect กลับ `/` (guard) + ไม่มีปุ่ม Admin Panel
+ ✅ `pnpm build` ผ่าน · `grep -ri service_role dist` = 0 (key ไม่หลุด client)
+ ⚠️ `pnpm lint`: 1 error เดิมใน `DashboardPage.tsx` (react-hooks/preserve-manual-memoization)
  — ไม่เกี่ยว Phase 4, มีอยู่ก่อนแล้วบน main, ไฟล์ admin ทั้งหมด lint สะอาด

### Phase 4+ (idea ต่อยอด — ยังไม่ plan)

- Coach-athlete linking (invite code / email)
- Coach dashboard: ดู progress นักกีฬาหลายคน
- Push notifications: เตือนวันซ้อม
- Program sharing: share ลิงก์ custom program

---

## Phase 4 — Social (Coach-Athlete / Program Sharing / In-app Reminder) — session 2026-06-21

> **สถานะ:** ✅ **DONE — merged เข้า main + deploy prod + ทดสอบ prod ผ่าน (2026-06-22)**
> Backend setup + e2e 7/7 + bug fix + merge + prod retest ครบหมด. แผนเต็ม: `~/.claude/plans/log-md-encapsulated-leaf.md`
>
> **merge commit `f6529fe`** บน `main` (merged branch `phase4-social-coach-sharing` แบบ --no-ff, push แล้ว
> → Vercel auto-deploy). bug fix `e0409b6` (button nesting). Phase 4 commit เดิม `bf3020f`.

### ✅ Backend setup + e2e — session 2026-06-22

**STEP 1 — SQL section 2b** ✅ รันใน Supabase `rhilcsfhibymgyoaltem` แล้ว ("Success. No rows returned")
→ ได้ตาราง `coach_athlete` / `shared_programs` / `notifications` + policy coach-reads-athlete

**STEP 2 — Edge Function `coach`** ✅ deploy ผ่าน Dashboard (วิธี A) แล้ว

**STEP 3 — e2e (Playwright 390px) ผ่าน 7/7:**
1. ✅ Linking — athlete A กรอก email โค้ช → "Connected to coach.test@atlaslog.app" → โค้ชเห็น A ใน `/coach` + notification banner "athlete.a connected to you as an athlete" + badge "1" บนปุ่ม Profile
2. ✅ Coach dashboard — โค้ชเปิด detail A → 1 WORKOUT + "Tue — Bench Focus · 0.4k" (อ่าน session ข้าม user ผ่าน RLS สำเร็จ)
3. ✅ RLS isolation — **พิสูจน์เชิงประจักษ์:** หลัง unlink โค้ช query `sessions?user_id=eq.<A>` ตรง ๆ ผ่าน REST ได้ `200 / 0 rows` (ก่อน unlink เห็น 1) → ข้อมูลยังอยู่ใน DB แต่ RLS ตัด access. + guard redirect `/coach/:id` ตรง ๆ
4. ✅ Read-only — หน้า detail มีแต่ view (Back/stats/recent workouts) ไม่มีปุ่มแก้/ลบ
5. ✅ Program sharing — โค้ช import .xlsx เป็น custom → กด Share ได้ code `KB22FT` → A กรอก code (Programs → ไอคอน link) → โผล่ใน MY PROGRAMS ของ A (round-trip ครบ)
6. ✅ Reminder — notification banner + badge บน Profile → กด **MARK ALL READ** → banner + badge หาย (`read_at` persist)
7. ✅ Unlink — โค้ชกด Unlink A → confirm dialog → MY ATHLETES (0) + RLS ตัด access (ดูข้อ 3)
+ ✅ `pnpm build` ผ่าน · `grep -ri service_role apps/web/dist` = 0

**บัญชีทดสอบ:** บันทึกใน `TEST_ACCOUNTS.md` (gitignored) — coach.test / athlete.a @atlaslog.app (confirmed),
athlete.b ไม่ถูกสร้างเพราะ **email rate limit** (Supabase built-in SMTP ~2/ชม.) → ทดสอบ RLS ด้วย unlink แทน

**bug เล็กที่เจอ + แก้แล้ว (commit `e0409b6`):** ปุ่ม Share program ถูกวางใน `<button>` การ์ด custom program
→ invalid DOM nesting (`<button>` ซ้อน `<button>`) → React hydration warning. **แก้:** เปลี่ยนการ์ด custom program
จาก `<button>` เป็น `<div role="button" tabIndex={0}>` + onKeyDown (Enter/Space) → console สะอาด, verify แล้ว

### ✅ STEP 4 — Merge + deploy + prod retest — DONE 2026-06-22
- [x] merge branch `phase4-social-coach-sharing` → `main` แบบ --no-ff (`f6529fe`) + push → Vercel auto-deploy
- [x] prod build ขึ้นจริง — section COACHING render บน https://atlaslog-web.vercel.app/profile
- [x] prod linking ผ่าน — athlete A connect → "Connected to coach.test@atlaslog.app"
      (edge function `coach` resolve-link ทำงานผ่านโดเมน prod, CORS OK เหมือน Phase 3.5)

### ทำไม
roadmap เดิม "Phase 4 = Social" ยังไม่เคยเริ่ม — ที่ commit `edf1f70` ทำจริงคือ admin-confirm
(เป็น Phase 3.5). เฟสนี้ทำให้แอปใช้เป็น "ทีม" ได้: โค้ชดู progress ลูกศิษย์ + แชร์โปรแกรม +
เตือนในแอป (in-app, ไม่ลง push infra — เลื่อน Web Push ไว้เพราะ iOS ต้องติดตั้ง PWA + free tier ไม่มี cron)

### กลไกหลัก
- **"coach" เป็น relational ไม่ใช่ role** — ไม่แตะ `profiles.role` (`'user'|'admin'`) ใครมีลูกศิษย์ผูกอยู่ = เป็นโค้ช
- **อ่านข้าม user ผ่าน RLS** (โค้ชอ่าน session/program ลูกศิษย์), **resolve/mutation ข้าม user ผ่าน Edge Function `coach`** (เลียนแบบ `admin-users`)
- **โค้ช read-only** ใน v1
- coach code = 8 ตัวแรกของ user uuid (หรือกรอก email ก็ได้)

### Backend (รออยู่ — ผู้ใช้ต้องทำใน Supabase)
- [ ] รัน SQL ใหม่ใน `SUPABASE_SETUP.md` section **2b** — ตาราง `coach_athlete`, `shared_programs`,
  `notifications` + policy "coach reads athlete sessions/programs"
- [ ] deploy edge function `supabase/functions/coach/index.ts` (actions: `resolve-link`, `list-athletes`)

### Frontend (เสร็จ)
- `packages/shared/src/types.ts` — `CoachLink`, `AthleteSummary`, `SharedProgram`, `AppNotification`
- `apps/web/src/lib/coachApi.ts` — linkCoach/listAthletes (edge fn) + unlink/getAthlete* (RLS)
- `apps/web/src/lib/shareApi.ts` — createShare (gen code 6 ตัว) / importShare
- `apps/web/src/lib/notificationsApi.ts` — fetch/markRead/markAllRead
- `useAuthStore` — เพิ่ม `isCoach` + `notifications` + `refreshNotifications` (load ตอน SIGNED_IN, reset ตอน SIGNED_OUT)
- `features/coach/CoachPage.tsx` + `AthleteDetailPage.tsx` + route `/coach`, `/coach/:athleteId` (guard `!isCoach`)
- `ProfilePage` — section COACHING (my coach code + copy, connect-a-coach) + ปุ่ม Coach Panel
- `ProgramsPage` — ปุ่ม Share ในการ์ด custom program + Import-by-code ใน header (2 sheet ใหม่)
- In-app reminder: badge unread บนปุ่ม Profile ใน `BottomNav` + banner notification & "today's session" ใน `DashboardPage`
- icons ใหม่ใน `components/icons/index.tsx`: IconUsers/IconShare/IconBell/IconLink/IconCopy

### ผลตรวจ (2026-06-21)
- ✅ `pnpm build` ผ่าน (tsc + vite)
- ✅ `pnpm --filter web lint` สะอาด — เหลือ **1 error เดิม** `DashboardPage activeProgramInfo`
  (`preserve-manual-memoization`) ที่มีอยู่ก่อนแล้วบน main, ไม่เกี่ยวเฟสนี้
- ✅ `grep -ri service_role apps/web/dist` = 0 (service_role ไม่หลุด client)
- ✅ smoke test (Playwright 390px): `/login` render ปกติ 0 console error
- ⏳ **e2e เต็ม (3 บัญชี: coach/athlete A/athlete B) รอ backend setup** — เคสตามแผน:
  linking, coach อ่านได้เฉพาะลูกศิษย์ตัวเอง (RLS isolation), program sharing round-trip, reminder badge, unlink ตัดสิทธิ์

### 🔜 สิ่งที่ต้องทำต่อ (RESUME HERE — session ถัดไป)

> โค้ด push แล้ว (branch `phase4-social-coach-sharing`) แต่ **ยังใช้งานจริงไม่ได้** จนกว่าจะ setup
> backend. ทำตามลำดับนี้:

**STEP 1 — รัน SQL ใน Supabase** (โปรเจกต์ `rhilcsfhibymgyoaltem` → SQL Editor)
- [ ] เปิด `SUPABASE_SETUP.md` section **2b** → copy SQL ทั้งบล็อก → run
- [ ] ตรวจว่าได้ตาราง: `coach_athlete`, `shared_programs`, `notifications` (Table Editor)
- [ ] ตรวจ policy ใหม่บนตารางเดิม: `coach reads athlete sessions` + `coach reads athlete programs`
      (Database → Policies → ดู `sessions` / `custom_programs`)

**STEP 2 — Deploy Edge Function `coach`**
- [ ] วิธี A (Dashboard): Edge Functions → New function → ชื่อ **`coach`** → วางโค้ดจาก
      `supabase/functions/coach/index.ts` → Deploy
- [ ] วิธี B (CLI ในเซสชัน prefix `!`): `npx supabase login` → `npx supabase link --project-ref
      rhilcsfhibymgyoaltem` → `npx supabase functions deploy coach`
- [ ] **ไม่ต้องตั้ง secret เพิ่ม** — Supabase inject `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` ให้เอง

**STEP 3 — e2e เต็ม (Playwright 390px) ด้วย 3 บัญชี: coach / athlete A / athlete B**
- [ ] **Linking:** athlete A → Profile → กรอก coach code (8 ตัวแรกของ uuid โค้ช หรือ email โค้ช) →
      "Connected to ..." → โค้ช login เห็น A ใน `/coach` + badge แจ้งเตือนขึ้นบนปุ่ม Profile
- [ ] **Coach dashboard:** โค้ชเปิด `/coach/:athleteId` ของ A → เห็น session/program ของ A
- [ ] **RLS isolation (สำคัญ):** โค้ชเปิด detail ของ B (ไม่ได้ผูก) → ต้อง **ไม่เห็น** ข้อมูล
- [ ] **Read-only:** โค้ชไม่มีปุ่มแก้ข้อมูลลูกศิษย์ (มีแต่ view)
- [ ] **Program sharing:** A กด Share โปรแกรม → ได้ code → B กรอก code (Programs → ไอคอน link) →
      โปรแกรมโผล่ใน "MY PROGRAMS" ของ B + sync ขึ้น Supabase (ตรวจ row ใน `custom_programs`)
- [ ] **Reminder:** banner "TODAY'S SESSION" ขึ้นบน Dashboard ถ้าวันนี้ตรงวันซ้อม +
      banner notification ลดลงเมื่อกด "MARK ALL READ"
- [ ] **Unlink:** โค้ชกด Unlink A → A หายจาก list + โค้ชเปิด detail A ไม่เห็นข้อมูลแล้ว (RLS ตัด)
- [ ] `grep -ri service_role apps/web/dist` = 0 (ย้ำหลัง build)

**STEP 4 — Merge + deploy**
- [ ] เปิด PR: https://github.com/Nippitpon/atlaslog/pull/new/phase4-social-coach-sharing
- [ ] merge เข้า `main` → Vercel auto-deploy → ทดสอบ prod ซ้ำ (linking + CORS ผ่านโดเมน prod เหมือน Phase 3.5)

**ข้อควรระวัง / known issues ที่ต้องเช็คตอน e2e**
- ⚠️ `isCoach` โหลดแบบ async (เหมือน `isAdmin`) → navigate ตรงไป `/coach` ทันทีหลัง login อาจโดน
  redirect กลับ `/` (guard race เดิม) — กดปุ่ม Coach Panel จาก Profile ใช้ได้ปกติ. ความเร่งด่วนต่ำ
- ⚠️ `list-athletes` / `resolve-link` ใน edge function ใช้ `listUsers({ perPage: 1000 })` resolve
  email/uuid → ถ้า user เกิน 1000 ต้องทำ pagination (future)
- ⚠️ `shared_programs` select policy = authenticated ใด ๆ อ่านได้ (ใช้ code เป็น capability — code
  เดายาก) — ยอมรับได้สำหรับ hobby tier
- ⚠️ lint error เดิม `DashboardPage activeProgramInfo` (preserve-manual-memoization) ยังอยู่ —
  มีก่อน Phase 4, ไม่ต้องแก้ในเฟสนี้

**ยังไม่ได้ทำ (เลื่อนเป็น Phase 5)**
- Push notifications (Web Push / VAPID + Service Worker + PWA manifest) — iOS ต้องติดตั้ง PWA ก่อน
  + free tier ไม่มี cron สำหรับ "เตือนวันซ้อม" → เลื่อนไว้ ใช้ in-app reminder แทนใน Phase 4
- โค้ชแก้ไข/มอบหมายโปรแกรมให้ลูกศิษย์ (ตอนนี้ read-only) — future
- audit log: ใครผูก/แชร์กับใคร — future

## ไฟล์สำคัญที่ต้องรู้

```
SUPABASE_SETUP.md          → คู่มือ setup Supabase ทีละขั้น
LOGIN_GUIDE.md             → คู่มือ sign up / sign in / data sync
apps/web/.env.example      → ตัวอย่าง env vars ที่ต้องการ
apps/web/vercel.json       → Vercel monorepo build config
apps/web/src/lib/supabase.ts       → Supabase client
apps/web/src/store/useAuthStore.ts → Auth state + actions + pull-on-login
apps/web/src/features/auth/AuthPage.tsx → Login/Register UI
```

---

## Dev Commands

```bash
pnpm dev      # localhost:5173
pnpm build    # check TS errors + production build
pnpm lint     # ESLint
```
