# Atlaslog — Development Log

> อัปเดตล่าสุด: 2026-07-02 (รอบ 21 — ✅ SHIPPED: แก้ไขโปรแกรม (Edit) creator/admin แก้โปรแกรมตัวเองได้ + prune progress)
>
> 📘 คู่มือ Coaching: `docs/coaching-guide.md`

---

## 2026-07-02 — รอบ 21 (✅ SHIPPED, deploy main): แก้ไขโปรแกรม (Edit custom program)

creator/admin แก้โปรแกรม **ในคลังตัวเอง** (source manual/excel) ได้: type, เพิ่ม/ลด/แก้วัน+ท่า, ชื่อ, จำนวนสัปดาห์.
**client-only** (แก้ของ user คนอื่นข้ามบัญชี = นอกขอบเขต). built-in + coach-assigned (source coach) = แก้ไม่ได้

### ทำอะไร (reuse CreateProgramPage เป็น edit mode)
- **`useProgramStore.updateCustomProgram`** — upsert (id เดิม) + **prune** `progress`/`customAccessories` ของ week/day ที่หายไป
  (คงของวันที่ยังอยู่) + คำนวณ `config.endDate` ใหม่จากจำนวนสัปดาห์ (drop config ถ้ากลายเป็น weekly)
- **CreateProgramPage** — edit mode เมื่อเปิด `/programs/:programId/edit` ของ custom program ตัวเอง: prefill
  name/focus/weeks/days(**คง id**)/type, ซ่อน VISIBILITY, ปุ่ม "Save changes" → updateCustomProgram; วันใหม่ gen id ใหม่ (ไม่ positional) → วันเดิม progress ไม่หาย
- **router** `/programs/:programId/edit` (ก่อน `:programId`)
- ปุ่ม **Edit** (ดินสอ) ใน ProgramOverviewPage header + ProgramsPage card — โชว์เมื่อ editable (`isCoach||isAdmin` && อยู่ใน customPrograms && source≠coach)
- note ใน edit: "การแก้ไม่กระทบสำเนาที่แชร์/มอบหมายไปแล้ว · วันที่ลบจะล้าง progress ของวันนั้น"

### ผลกระทบ (วิเคราะห์ + จัดการแล้ว)
progress/accessory key เป็น id → **คง id วันเดิม** progress ไม่หาย, วันที่ลบ prune ทิ้ง · endDate คำนวณใหม่ · type general↔pl ไม่ loss ·
`shared_programs`/coach-assigned = snapshot อิสระ แก้ต้นฉบับไม่กระทบ (ต้อง share/assign ใหม่) · History (Session snapshot) ไม่กระทบ

### e2e verified (390px, coach.test) — 0 console errors, build+lint ผ่าน
Edit prefill ครบ · rename → overview อัปเดต+persist · ลบวัน → prune save สะอาดไม่ crash · built-in ไม่มีปุ่ม Edit + `/edit` redirect

### ไม่ทำรอบนี้
admin แก้ของ user อื่น (cross-user/edge fn) · ไม่ auto-อัปเดตสำเนาที่ share/assign แล้ว · ไม่ทำ versioning/undo

---

## 2026-07-02 — รอบ 20 (✅ SHIPPED, deploy main): General weekly routine (ไม่ใส่ Week = ไม่ต้อง setup วันเริ่ม/จบ)

สร้างโปรแกรม **General** โดยเว้นช่อง WEEKS ว่าง → โปรแกรม `weekly` (1 สัปดาห์วนซ้ำ) → **ไม่ต้องตั้งวันเริ่ม/จบ** +
เข้าโปรแกรมแล้วเห็น **วันซ้อมรายวัน (DayCard + Start) ทันที** ไม่ผ่าน Setup/รายการสัปดาห์.
**Powerlifting ไม่เปลี่ยน** — ยังต้องใส่ WEEKS + Setup (วันเริ่ม/จบ + 1RM) เสมอ (weekly ใช้ได้เฉพาะ General)

### ทำอะไร
- **types** `StructuredProgram.weekly?: boolean`
- **CreateProgramPage** — WEEKS default ว่าง; `isWeekly = programType==='general' && weeks ว่าง`; General ว่าง = weekly (totalWeeks 1),
  ใส่เลข = periodized; **Powerlifting ว่าง = canSave false** (บังคับใส่, ไม่มีทางเป็น weekly). helper text แยกตาม type
- **WeekDays.tsx (ใหม่)** — ยก `DayCard`+`StatusBadge`+`SBD_IDS`+`handleStart`(weightOverrides/dayToProgram/customAccessories/startWorkout)+
  `calcRMs`(config?.oneRMs ?? personalOneRMs)+accessory edit ออกจาก WeekDetailPage → reuse ทั้ง WeekDetailPage + weekly overview
- **WeekDetailPage** — refactor เหลือ header + `<WeekDays>` + week-nav (พฤติกรรมเดิมเป๊ะ)
- **ProgramOverviewPage** — ถ้า `weekly` → ซ่อน config/Setup/ProgressSummary/รายการสัปดาห์/ปุ่ม Settings, โชว์ "TRAINING DAYS" + `<WeekDays week={weeks[0]}>`; ไม่ weekly = เดิม
- **ProgramsPage** — การ์ด weekly โชว์ badge "WEEKLY" + ซ่อน progress bar รายสัปดาห์

### e2e verified (390px, coach.test) — 0 console errors, build+lint ผ่าน
General เว้น WEEKS → overview เห็น TRAINING DAYS + DayCard ทันที (ไม่มี Setup) · Start → Logger ·
Powerlifting เว้น WEEKS → Create disabled · **Regression** built-in 12-week: รายการ 12 สัปดาห์ + Setup + Progress ครบเหมือนเดิม

### ไม่ทำรอบนี้
weekly ไม่โผล่เป็น active program บน Dashboard (activeProgramInfo วนเฉพาะโปรแกรมที่มี config) — ผู้ใช้ขอเฉพาะหน้าโปรแกรม; ทำเพิ่มภายหลังได้ ·
weekly powerlifting น้ำหนักใช้ Personal 1RM จากโปรไฟล์ (ไม่ตั้งก็โชว์แค่โครงท่า)

---

## 2026-07-02 — รอบ 19 (✅ SHIPPED, merge main `d704ee8` + edge redeploy): Coach assign โปรแกรมให้ athlete

โค้ช assign โปรแกรมจากคลังตัวเองให้ลูกเทรน (active link) → โผล่ใน MY PROGRAMS ของลูกเทรน + แจ้งเตือน (in-app + push)

### ทำอะไร (reuse ล้วน — **ไม่มีตาราง/SQL ใหม่**)
- **Edge** `supabase/functions/coach/index.ts` — action ใหม่ `assign-program`: verify `coach_athlete` active →
  clone program (`id='assigned-'+ts`, `source:'coach'`, `assignedBy`/`assignedByEmail`) → `insert` เข้า
  `custom_programs` ของ athlete (service_role) → notification `program_assigned` + `sendPushToUser` (non-fatal)
- **API** `coachApi.ts` — `assignProgram(athleteId, program)` (ผ่าน `call()` invoke 'coach')
- **Coach UI** `AthleteDetailPage.tsx` — ปุ่ม "Assign" + `AssignProgramSheet` (list `STRUCTURED_PROGRAMS` + `customPrograms` ของโค้ช) → เลือก → assign → refetch; badge ASSIGNED บนโปรแกรม source==='coach'
- **Athlete UI** — `DashboardPage.notificationText` case `program_assigned`; `ProgramsPage` badge **FROM COACH** (source==='coach'); flow Setup→Start เดิมใช้ได้ทั้งหมด
- **Types** `StructuredProgram.source += 'coach'` + `assignedBy?`/`assignedByEmail?` (jsonb, ไม่ migrate)

### Deploy
- โค้ด: merge main (`d704ee8`) → Vercel auto-deploy
- Edge: `npx supabase login --token <...>` → `npx supabase functions deploy coach --project-ref rhilcsfhibymgyoaltem`
  (bundle `_shared/push.ts` ให้อัตโนมัติ; ไม่ต้อง Docker/SQL). **บทเรียน:** อย่ารัน `npx supabase` หลายตัวพร้อมกัน → EBUSY (แย่งล็อก binary ในแคช); login แบบ `--token` เลี่ยง browser ค้าง

### e2e verified (390px, coach.test + athlete.a)
coach assign 12-week → PROGRAMS (3)→(4) + ASSIGNED · athlete relogin → dashboard banner
"coach.test… ส่งโปรแกรม "12 Weeks SBD Peaking" ให้คุณ" + MY PROGRAMS badge FROM COACH (Not started) · 0 console errors · build+lint ผ่าน

### ไม่ทำรอบนี้
ไม่มี accept/reject (assign = เพิ่มเข้า library เลย, athlete ลบเองได้) · โค้ชไม่ pre-set startDate/1RM · ไม่ realtime (โผล่ตอน refresh/relogin)

---

## 2026-07-01 — รอบ 18 (PLANNED, ยังไม่ลงมือ): Web Push — deploy/verify Part A + Part B (cron เตือนวันซ้อม)

รอบ 15 เขียน **Web Push Part A** ครบ (build ผ่าน) แต่ยังไม่ deploy/verify; **Part B (เตือนวันซ้อมอัตโนมัติ) ยังไม่ทำ**

> 📝 แก้ความเข้าใจเดิม: โน้ตเก่าเขียน "free tier ไม่มี cron" — **ไม่จริง** Supabase มี **pg_cron + pg_net** ใช้ได้ทุก tier → Part B ทำได้

### Part A — Deploy + Verify (push เมื่อมี event: coach link/accept)
**A1. เจ้าของทำใน dashboard (checklist §2i):**
1. รัน SQL §2i (สร้าง `push_subscriptions` + RLS own-row + index + `program_state.reminder_opt_in`)
2. `supabase secrets set VAPID_JSON='<vapid-secret.local>'` + `CRON_SECRET='<สุ่มยาว>'`
3. `supabase functions deploy send-push` + `supabase functions deploy coach`
4. เพิ่ม `VITE_VAPID_PUBLIC_KEY` (จาก `apps/web/.env.local`) ใน Vercel → redeploy
   (`vapid-secret.local` repo root มี keypair แล้ว, public key อยู่ใน .env.local แล้ว)

**A2. Verify (หลัง A1):** subscribe บน Chrome → มี row ใน `push_subscriptions` + `reminder_opt_in=true`;
event push จาก coach (add-athlete/accept) ระหว่าง 2 บัญชี เด้งจริง (title/body/คลิกเปิด url); manual
`POST /send-push` (header `x-cron-secret`) เด้ง; iOS ต้อง Add-to-Home-Screen ก่อน; unsubscribe→row หาย, endpoint ตาย→auto-prune(404/410)

### Part B — Cron เตือนวันซ้อม (โค้ดใหม่ + owner enable)
**แนวคิดหลัก:** โครงสร้างโปรแกรม built-in (12-week) อยู่ใน JS ฝั่ง client เท่านั้น (edge/Deno เข้าไม่ถึง) →
ให้ **client คำนวณวันซ้อม** เก็บเป็น weekday-set ใน `program_state`, edge แค่เช็ค "วันนี้ตรงไหม" (ครอบคลุม built-in+custom)

- **B1. Client** — DB: `alter table program_state add column reminder_days text[] default '{}';` (เช่น `{Mon,Tue,Thu,Sat}`).
  reuse logic `DashboardPage.tsx:140` (`todayReminder`) + `activeProgramInfo` (`:118-137`) → helper `activeTrainingWeekdays()`
  (distinct `day.dayOfWeek` ของ current week). upsert `{user_id, reminder_days}` (แพตเทิร์น `setReminderOptIn` `pushApi.ts:53`,
  ไม่ชน column อื่น) เมื่อเปิด toggle / active program/progress เปลี่ยน
- **B2. Edge** `supabase/functions/send-reminders/index.ts` — auth `x-cron-secret` + service_role (แพตเทิร์น `send-push`);
  logic: `today` = weekday ICT (UTC+7) → `program_state.select(user_id,reminder_days).eq(reminder_opt_in,true)` →
  ถ้า `today ∈ reminder_days` → `sendPushToUser(admin, user_id, {title:'ถึงเวลาซ้อม 💪', url:'/', tag:'reminder'})`
  (reuse `_shared/push.ts` มี prune แล้ว)
- **B3. Cron (เจ้าของ enable, เพิ่มใน §2i)** — เปิด `pg_cron`+`pg_net` → job รายวัน **01:00 UTC = 08:00 ICT**:
  `select cron.schedule('daily-training-reminders','0 1 * * *', $$ select net.http_post(url:='<proj>.supabase.co/functions/v1/send-reminders', headers:=jsonb_build_object('x-cron-secret','<CRON_SECRET>','Content-Type','application/json'), body:='{}'::jsonb); $$);`

### ไฟล์ (Part B)
ใหม่ `supabase/functions/send-reminders/index.ts`; แก้ `apps/web/src/lib/pushApi.ts` (หรือ `lib/reminderSchedule.ts` ใหม่),
`features/dashboard/DashboardPage.tsx` หรือ `store/useProgramStore.ts` (trigger sync reminder_days), `SUPABASE_SETUP.md` §2i (column + cron).
reuse: `_shared/push.ts`, `send-push/index.ts` (แพตเทิร์น auth/client), DashboardPage activeProgramInfo/todayReminder

### Verify (Part B)
1. build+lint ผ่าน 2. เปิด toggle → `program_state.reminder_days` ตรงวันซ้อม active program 3. ยิง `POST /send-reminders`
ตรงๆ วันซ้อม→ได้ push, วันพัก→ไม่ได้ 4. ตั้ง cron → เช็ค `cron.job_run_details` + push เช้าถัดไป 5. opt-in=false / ไม่มี active program → ไม่ push

### ข้อควรระวัง
- Timezone สมมติทุกคน ICT (UTC+7) — cron ยิงเวลาเดียว; ถ้ามี user ต่าง tz ต้องเก็บ tz ต่อ user (นอก scope)
- ไม่เช็ค "ซ้อมเสร็จยัง" (nudge ตอนเช้าก่อนซ้อม); weekday-set ไม่ผูก week-specific/done-state
- Part A ต้อง deploy ก่อน Part B ถึง verify push ได้ (ใช้ pipeline push เดียวกัน)

---

## 2026-07-01 — รอบ 17 (✅ SHIPPED, merge main `a5a3fb7` → Vercel): EXERCISES Library dataset migration

ขยาย Library จาก **19 ท่า** hardcode (`data.ts`) → **19 builtin (local) + 1,324 ExerciseDB (`db-<id>`) + custom**
เก็บใน Supabase table `exercises` พร้อมคำอธิบายทีละขั้น (steps). ต้นทาง `hasaneyldrm/exercises-dataset` (ExerciseDB v1).

### ทำจริง (4 phase A→B→C→D)
- **A. ETL** `scripts/build-exercises.mjs`: อ่าน `data/exercises.json` (clone มาไว้ scratchpad) → เขียน
  `supabase/seed/exercises.seed.sql` + `exercises.seed.part01..14.sql`. map `body_part`→กลุ่ม (+`Other`),
  Title-Case equipment, `db-<id>`, ใช้ `instruction_steps.en`, `media_id`→`gif_path`.
- **B. DB** `SUPABASE_SETUP.md §2j`: table `exercises` (id,name,muscle_group,equipment,target,
  secondary_muscles[],instructions[],gif_path) + RLS `select to authenticated using(true)`. เจ้าของรัน SQL +
  seed 14 ไฟล์ใน SQL Editor. **ไม่ seed 19 builtin** (อยู่ local แล้ว) → table = 1,324 แถวล้วน.
- **C. Types/data** ขยาย `Exercise` (target/secondaryMuscles/instructions/gifPath optional); เพิ่ม `'Other'`
  ใน MUSCLE_GROUPS + สีใน muscleColor; **`DB_EXERCISES` registry** (คู่ขนาน CUSTOM_EXERCISES) + `exerciseGifUrl()`;
  `getExercise`/`allExercises` รวม db; fetch ใน `loadUserData` (paginate).
- **D. UI** LibraryPage: incremental render (50/หน้า + IntersectionObserver) + GIF thumbnail (fallback icon) +
  คลิก→ route `/library/:exerciseId` (`ExerciseDetailPage` ใหม่: GIF/steps/target/secondary, fetch full-row เอง);
  SwapSheet/AccessoryEditSheet/CreateProgramPage ได้ชุดเต็มผ่าน `allExercises()` + cap 80 + hint; attribution.

### ต่างจากแผนเดิม (+เหตุผล)
- fetch ใช้ **load-on-init + Zustand registry** ไม่ใช่ TanStack Query — `getExercise()` เป็น sync ใช้ทั่วแอป
  ต้องมี registry พร้อมก่อน render (loadUserData await ก่อน initialized).
- list ใช้ **incremental render** ไม่เพิ่ม react-window.
- table เก็บเฉพาะ 1,324 (ไม่ seed builtin ซ้ำ).

### 🐛 bug/ข้อจำกัดที่เจอตอน verify (แก้แล้ว)
- **PostgREST cap 1000 แถว/req** → `.select()` ได้แค่ 1000 → `fetchAllExercises()` (useAuthStore) วน `.range()` ดึงครบ.
- **SQL Editor paste limit ~120KB** → seed แตกเป็น 14 ไฟล์ (100 แถว/ไฟล์). ไฟล์รวมไว้ใช้ psql/CLI. (error `relation "a"` = paste ถูกตัดกลางแถว)
- **ExerciseDetailPage** ต้อง fetch full-row (`select *`) เอง เพื่อให้ hard-load ทำงาน (registry ยังไม่ warm).

### ⚠️ GIF ปิดไว้ (deferred)
CDN `static.exercisedb.dev` = **NXDOMAIN ทั้งโลก** (host ฟรีของ ExerciseDB ตายแล้ว; แม้แต่ API `oss.exercisedb.dev`
ก็คืน URL ที่ชี้ไป host ตาย; cloudfront เก่าก็ตาย). `exerciseGifUrl()` คืน null ผ่าน `const MEDIA_HOST = ''` ใน `utils.ts`
— แก้สตริงนี้เพื่อเปิดกลับถ้าเจอ host ที่ใช้ได้. `gif_path` (=media_id) เก็บใน table/registry พร้อมแล้ว. UI fallback ไอคอน.

### verify (390px, Playwright) — ผ่าน, 0 console errors
Library 1363, filter ทุกกลุ่ม (รวม Other 31), incremental scroll, detail page `db-0001` โชว์ steps/target/secondary,
regression 12-week SBD (Back Squat 137.5 / Bench 90 / Deadlift 150 คำนวณจาก 1RM ถูก, ไม่ทับ ID เดิม). build+lint ผ่าน.

### ไม่ทำรอบนี้
- GIF (host ตาย), ไม่แปล instructions เป็นไทย, ไม่ host รูปเอง, ไม่รวม 19 ท่าเดิมเข้า dataset

---

## 2026-06-26 — รอบ 16: muscle group ในหน้า Create Program (Add Exercise)

แก้ไฟล์เดียว `apps/web/src/features/programs/CreateProgramPage.tsx` (ใช้ helper เดิม getExercise/muscleColor/allExercises)
1. **chips กรองตามกล้ามเนื้อ** ([All][Chest][Back][Legs][Shoulders][Arms][Core]) ใต้ search bar — chip ที่เลือกใช้สี `muscleColor`
2. **จัดกลุ่ม list ตามกล้ามเนื้อ** ใน picker — หัวข้อ sticky + จุดสี, จัดกลุ่มจาก filtered คงลำดับ
3. **โชว์ muscle group ในแถวท่าที่เพิ่มลงวัน** (WEEK TEMPLATE) ใต้ชื่อท่า — ดึงสดจาก `getExercise(exerciseId).group` (ไม่แก้ data model)
- ไม่แตะ `AccessoryEditSheet` (picker คล้ายกัน — ทำให้เหมือนกันทีหลังได้)
- Playwright หลุด session นี้ → ทดสอบแค่ build/lint

---

## 2026-06-26 — รอบ 15: Phase 5 Part A — Web Push (VAPID) foundation + event push

ทำเฉพาะ Part A (PWA + push พื้นฐาน + event push, ไม่ใช้ cron) — Part B (เตือนวันซ้อม scheduled) รอบหน้า

### โค้ด (build+lint ผ่าน)
- **PWA:** `public/manifest.webmanifest`, ไอคอน PNG (192/512/maskable + apple-touch-icon) gen จาก favicon.svg
  ด้วย `scripts/gen-icons.mjs` (sharp, devDep), แก้ `index.html` head (manifest/theme-color/apple-touch/apple-meta)
- **Service worker:** `public/sw.js` (push + notificationclick), register ใน `main.tsx`
- **VAPID:** gen P-256 ด้วย Node Web Crypto → public key ใน `apps/web/.env.local` (`VITE_VAPID_PUBLIC_KEY`),
  private/keypair ใน `vapid-secret.local` (gitignored) ไว้ set เป็น edge secret `VAPID_JSON`
- **DB:** `push_subscriptions` table + `program_state.reminder_opt_in` (SQL section 2i ใน SUPABASE_SETUP.md)
- **Client:** `lib/pushApi.ts` (subscribe/unsubscribe/support+iOS detection) + toggle "Push reminders" ใน Profile PREFERENCES
  (states: unsupported / iOS-ต้อง-install / permission-denied / on-off)
- **Edge:** `_shared/push.ts` (sendPushToUser ผ่าน `jsr:@negrel/webpush`, prune 404/410) + `send-push` fn
  + ผูก push เข้า 3 จุดใน `coach/index.ts` (resolve-link/add-athlete/respond-link accept)

### ⛔ ค้าง — เจ้าของต้องทำใน dashboard (ดู SUPABASE_SETUP.md §2i)
1. รัน SQL section 2i ใน Supabase
2. `supabase secrets set VAPID_JSON='<vapid-secret.local>'` + `CRON_SECRET='<สุ่ม>'`
3. `supabase functions deploy send-push` + `supabase functions deploy coach`
4. เพิ่ม `VITE_VAPID_PUBLIC_KEY` ใน Vercel env → redeploy
5. ทดสอบ push บน Chrome (DevTools Push) / Android / iOS (ต้อง Add to Home Screen ก่อน)

> Playwright MCP หลุด session นี้ → ทดสอบแค่ build/lint, ยังไม่ได้ verify push บน browser จริง

---

## 2026-06-26 — รอบ 14: stable React keys + DateField คืนปฏิทิน (คง dd/mm/yyyy)

### A. Stable React keys (กัน element จับคู่ผิดตอนลบ/สลับกลางลิสต์)
- เพิ่ม `id?: string` (optional, backward-compat) ใน `WorkoutSet`/`WorkoutExercise`/`StructuredExercise` (`packages/shared/src/types.ts`)
- generate id ตาม convention เดิม `'<prefix>'+Date.now()` (+index กันชนใน map): `useAppStore` startWorkout (`we…`/`ws…`),
  addExerciseToWorkout, LoggerPage `addSet` (`ws…`), AccessoryEditSheet `addExercise` (`ax…`)
- เปลี่ยน key: LoggerPage exercise chips `key={e.id??i}`, set rows `key={s.id??i}`; AccessoryEditSheet `key={ex.id??i}`
- **บั๊กจริง = AccessoryEditSheet** (มี `remove(idx)` ลบกลางลิสต์); Logger เป็น defensive (ปัจจุบัน append อย่างเดียว)
- WeekDetailPage (read-only) ไม่แก้ (นอกขอบเขต)

### B. DateField คืนปฏิทิน native + คง dd/mm/yyyy
- เขียน `components/DateField.tsx` ใหม่ (Props เดิม → caller 4 จุดไม่ต้องแก้): native `<input type=date>` opacity:0 ทับด้านบน
  (tap → เปิดปฏิทิน OS เหมือนเดิม) + ชั้นข้อความ `formatDMY` โชว์ dd/mm/yyyy ด้านหลัง + `IconCalendar` (เพิ่มใหม่ใน icons)
- `showPicker()` ใน onClick (try/catch) เป็นของแถมเดสก์ท็อป; `colorScheme:'dark'` ให้ปฏิทินเข้าธีม
- ทิ้ง dropdown 3 ช่องเดิม (select/pad/daysInMonth/years/emit/useMemo)
- ทดสอบ: build+lint ผ่าน (Playwright MCP หลุด session นี้ → manual/device verify ตอนใช้งานจริง)

---

## 2026-06-26 — รอบ 13: sync queue ผูก user-id (กันเขียนข้ามบัญชีบนเครื่องร่วม)

**บั๊ก:** `QUEUE_KEY` เป็น global ไม่ผูก user → A enqueue op ตอน offline, sign out, B login → `flushQueue`
เขียน op ของ A ลงบัญชี B (ข้อมูล corrupt)

**แก้ (`lib/syncQueue.ts`):**
- เปลี่ยน queue จาก `SyncOp[]` → `QueueEntry[]` = `{ userId: string|null; op: SyncOp }`
- `enqueue(op, userId)` ติด userId ทุก op (จาก `attempt()` ที่รู้ id, หรือ `null` ตอนไม่มี session)
- `flushQueue`: เขียนเฉพาะ entry ที่ `userId === currentId` หรือ `userId === null` (legacy/unowned = ของ user ปัจจุบัน);
  entry ของ user อื่น **เก็บไว้ในคิว ไม่ทิ้ง** → เจ้าของ login มาเองค่อย flush
- program-state dedup เป็น per-user (A/B มี snapshot แยกกันได้)
- migration: queue เก่า (bare `SyncOp` ไม่มี `.op`) → map เป็น `{ userId: null, op }` อัตโนมัติ

**ทดสอบ:** build+lint ผ่าน + logic test 9/9 (scratchpad: migration, cross-account guard,
rightful-owner flush, unowned→current, per-user dedup) — Playwright e2e ทำไม่ได้รอบนี้ (MCP หลุด)

## 2026-06-26 — ปิด gap: Coach RLS isolation e2e (athlete.b ตัวจริง) ✅ 8/8

ค้างจาก Phase 4: เคยทดสอบ RLS isolation ด้วยวิธี unlink เพราะสร้าง athlete.b ไม่ได้ (email rate limit)
- สร้าง athlete.b ผ่าน signup REST endpoint (rate limit รีเซ็ตแล้ว) → admin (owner) confirm ใน /admin
- **ทดสอบแบบ API-level ล้วน** (`scratchpad/rls-test.mjs`, node + REST + edge fn `coach`) — ไม่ต้องใช้ browser:
  athlete.b insert session → ISOLATION (coach อ่านไม่ได้ 0 rows) → resolve-link → LINKED (coach อ่านได้ 1 row)
  → unlink → RE-ISOLATION (0 rows) → cleanup. ผ่านครบ 8/8
- พิสูจน์ policy `coach reads athlete sessions` (user_id IN active coach_athlete) ทำงานถูกทั้งเปิด/ปิด access

---

## 2026-06-26 — รอบ 12: date `DD/MM/YYYY` (ค.ศ.) ทั้งแอป + bug fixes

ปี = **ค.ศ.** (Gregorian, `getFullYear()`) — ไม่แปลงเป็น พ.ศ. ตามที่ผู้ใช้เลือก

### A. Date format `-` → `/` (DD/MM/YYYY) ทั้งระบบ
- `utils.ts`: `formatDMY()` → `DD/MM/YYYY`, `formatDM()` → `DD/MM` (เปลี่ยน separator `-` → `/`)
- ยุบ `formatDate()` ที่เขียนซ้ำใน `ProgramOverviewPage`, `ProgramSetupSheet`, `ImportProgramSheet`
  → ใช้ `formatDMY` ตัวกลางแทน (DRY)
- History card คงดีไซน์เลขวันใหญ่ + weekday + หัวข้อกลุ่ม "MONTH YEAR" (เป็น idiom ปฏิทิน ไม่ใช่ date-text)

### B. Bug fixes (จาก audit 3 agent: date/time, store/sync, UI flows)
1. **BMR เพี้ยน** — `energy.ts` calcBMR ใช้ Katch-McArdle แม้ %ไขมัน >100/<0 → lean mass ติดลบ
   → gate `bodyFat > 0 && bodyFat < 100` (ไม่งั้น fall through ไป Mifflin)
2. **General program โชว์ 1RM ปลอม** — ProgramOverviewPage banner โชว์ `S0 B0 D0` สำหรับโปรแกรม general
   → ซ่อนคอลัมน์ 1RM เมื่อ `programType === 'general'`
3. **input ไม่มีขอบเขต** — เพิ่ม min/max: Fat 0–100, Weight 0–500, Muscle 0–200, height 0–300, 1RM 0–1000 (+clamp ≥0)
4. **endDate off-by-one (timezone)** — ProgramSetupSheet/ImportProgramSheet parse `YYYY-MM-DD` เป็น UTC
   แล้ว format กลับผ่าน UTC → คลาดวันใน TZ บางโซน (UTC+7 ไม่กระทบ) → คำนวณด้วย local date components

### C. Native date picker → custom DateField (dd/mm/yyyy ค.ศ.)
- ปัญหา: `<input type=date>` แสดงตาม locale browser (en-US = mm/dd/yyyy) override ไม่ได้
- สร้าง `components/DateField.tsx` — 3 dropdown (วัน/เดือน/ปี) เรียง DD/MM/YYYY เสมอ, ปี ค.ศ., รองรับ min/max + clamp วันตามเดือน
- แทนทุกจุด: RunsPage (LOG A RUN), ProfilePage (BIRTH DATE — แยกเต็มแถว), ProgramSetupSheet + ImportProgramSheet (START DATE)
- e2e (Playwright 390px athlete.a): Runs DATE = 26/06/2026, Bio BIRTH DATE = 15/03/1995 เรียง dd/mm/yyyy ถูกต้อง, 0 console errors

### รายงานบั๊กที่ "ไม่แก้รอบนี้" (ต้อง e2e เต็มก่อน — เสี่ยง)
- sync queue ไม่ผูก user-id → ถ้าสลับบัญชีบนเครื่องเดียวตอน offline อาจ sync ข้ามบัญชี (architectural)
- index-based React keys ใน LoggerPage/AccessoryEditSheet (กระทบเฉพาะตอน reorder)
- false positives ที่เช็คแล้วไม่ใช่บั๊ก: trend NaN (มี guard `length>=2`), RPE/sets-reps มี fallback guard

---

## 2026-06-25 — ปิดงานรอบ 11: SQL 2h + e2e เต็ม + commit/deploy (`3632ef8`)

> เก็บงานค้าง 4 ข้อของรอบ 11 จนจบ → push `main` → Vercel auto-deploy

### 1. แก้ UI bug "Save bio popup โดน bottom nav บัง" — เจอ root cause จริง (ไม่ใช่ z-index)
`.screen-enter` ใช้ `animation: slidein .25s ease both` → fill-mode `forwards` ทำให้ค้าง
`transform: translateY(0)` ถาวร → ทุก element ที่มี non-`none` transform จะกลายเป็น **containing block**
ของ `position:absolute/fixed` descendant → `.sheet-backdrop { inset:0 }` เลยอ้างอิงกับ `.atlas-screen`
(ตัวที่ scroll) แทน `.atlas-app` → backdrop ถูกจำกัดอยู่แค่ส่วนจอที่เห็น ไม่คลุมทั้งแอป → bottom nav โผล่ใต้ปุ่ม
- **แก้:** `index.css` เปลี่ยน `.screen-enter` เป็น `… ease backwards;` (สถานะ rest = translateY(0)/opacity 1
  เหมือนเดิมเป๊ะ แต่ไม่ค้าง transform หลัง animation จบ) + เพิ่ม `maxHeight: '92%'` + `overflowY: auto`
  ใน bio sheet กันยาวเกินจอเตี้ย
- verify (Playwright 390px): ทั้ง 1RM popup และ bio popup คลุมเต็มจอ, ปุ่ม Save อยู่ล่างสุด, nav ไม่โผล่

### 2. รัน SQL section 2h — ✅ ผู้ใช้รันใน Supabase (`rhilcsfhibymgyoaltem`, "Success. No rows returned")

### 3. e2e เต็ม (Playwright 390px) — ✅ ผ่าน
- **bio sync cross-device:** save bio → POST `program_state` **200** (ก่อนรัน SQL = 400) → reload pull จาก cloud
  → TDEE 2555→2703 (activity ×1.465→×1.55) · 0 console errors
- **date format:** History (`JUNE 2026` + tile `23 TUE` = label จัดกลุ่ม คงเดิมตามดีไซน์) · ProgramOverview
  START `10-06-2026` / END `02-09-2026` + week range `10-06 – 16-06` · WeekDetail range DD-MM
- **coach dashboard (coach.test เปิด athlete.a):** list row `● 2 days ago · 6 this wk · 15.9k` · Adherence (6/2 +
  6-week volume chart) · Body&Energy (น้ำหนัก/bodyFat + **BMR 1744 / TDEE 2703**) · Strength (**SBD 540**)
  → **พิสูจน์ว่า coach อ่าน bio/1RM ของลูกศิษย์ผ่าน RLS policy ใหม่ของ SQL 2h ได้จริง**
- **Excel general import:** สร้างไฟล์ทดสอบ `program_type=general` → import → WeekDetail แสดงท่า **ไม่มี kg** (ไม่คำนวณน้ำหนัก)
- **Strength-card gate:** show-path e2e ผ่าน; hide-branch (`programs.every general && !oneRMset`) code-verified

### 4. 🐛 bonus fix ที่เจอตอน e2e
**Setup Program (ImportProgramSheet + ProgramSetupSheet) บังคับกรอก 1RM แม้โปรแกรมเป็น general** →
ปุ่ม "เริ่มโปรแกรม" disabled, เริ่มไม่ได้ทั้งที่ general ไม่ใช้ 1RM. **แก้:** เช็ค `programType==='general'`
→ ซ่อน 1RM inputs + เปลี่ยน copy เป็น "เลือกวันเริ่มต้น…" + `isValid` ขอแค่ `startDate` + `oneRMs` fallback `|| 0`

### 5. commit + deploy — ✅
- `pnpm build` ผ่าน · `pnpm lint` สะอาด · `grep -ri service_role apps/web/dist` = 0
- commit `3632ef8` บน `main` (22 files, +787/−58, ไฟล์ใหม่ `lib/energy.ts`) → push → Vercel auto-deploy

### ⚠️ ข้อจำกัด/หมายเหตุ
- **RLS isolation เต็มยังเทสไม่ได้** — `athlete.b` ไม่เคยถูกสร้าง (email rate limit, ดู TEST_ACCOUNTS.md).
  policy ใหม่ใช้ subquery `status='active'` แบบเดียวกับ sessions/programs ที่ผ่าน isolation รอบ 6–7 มาแล้ว
- **native `<input type=date>` ใน Setup โชว์ MM/DD/YYYY** ตาม browser locale (headless = en-US) — คุมจากแอปไม่ได้
  (อยู่นอกขอบเขต date-format text ของรอบนี้); ค่า END DATE ที่แอป render เองยังเป็น DD-MM-YYYY ถูกต้อง
- **prod retest บน Vercel ยังไม่ได้ทำ** (deploy เพิ่ง trigger) — งานค้างข้อเดียวถ้าต้องการ

---

## 2026-06-24 — รอบ 11: BMR/TDEE + Coaching dashboard + date format (DD-MM-YYYY)

> สถานะ: **โค้ดเสร็จ (build+lint ผ่าน, service_role ไม่หลุด dist) + ทดสอบ local ฝั่ง client ผ่านบางส่วน**
> ⛔ **ยังไม่ได้รัน SQL section 2h + ยังไม่ได้ e2e coaching dashboard เต็ม + เจอ UI bug 1 จุด** (ดู "ต้องทำต่อ")

### A. Date format → `DD-MM-YYYY` ทั้งระบบ
- `utils.ts`: เพิ่ม `formatDMY()` (DD-MM-YYYY) + `formatDM()` (DD-MM, สำหรับ range); `formatDate()` คงป้ายสัมพัทธ์
  (TODAY/YESTERDAY/N DAYS AGO) แต่ fallback วันที่จริง → DD-MM-YYYY; `getDayOfWeek()` header → `WEDNESDAY · 24-06-2026`
- แก้ en-GB formatters → DD-MM-YYYY ใน `ProgramOverviewPage`, `ProgramSetupSheet`, `ImportProgramSheet`, `WeekDetailPage` (range ใช้ DD-MM)
- คงไว้: HistoryPage section header (`JUNE 2026`) + calendar tile (เลขวัน+weekday) = label จัดกลุ่ม ไม่ใช่วันที่เต็ม

### B. BMR / TDEE (Phase 1–3)
- **types.ts:** `Sex`, `ActivityLevel` (6 ระดับ), `UserBio {sex,heightCm,birthDate,activityLevel}`, `EnergyResult`;
  `ProgramStateSnapshot` += `bio?` + `personalOneRMs?`
- **`lib/energy.ts` (ใหม่):** `calcLBM`, `calcAge` (จากวันเกิด), `calcBMR` (**Katch-McArdle ถ้ามี bodyFat / Mifflin-St Jeor fallback**),
  `calcEnergy` (TDEE = BMR × multiplier), `ACTIVITY` map (6 ระดับ + label + ×1.2…1.9), `suggestActivityFromDays`
- **Storage/sync:** `useAppStore` เพิ่ม `bio` + `setBio` (persist + เรียก `syncSettings`); `setPersonalOneRMs` ก็ sync ด้วยแล้ว;
  `clearMetrics` reset bio+1RM (กัน leak ข้ามบัญชี); `useProgramStore.queueStateSync` รวม bio+1RM จาก useAppStore →
  `program_state` row เดิม + action `syncSettings`; `syncQueue` upsert คอลัมน์ `bio`/`personal_one_rms`;
  `useAuthStore.loadUserData` pull bio+1RM ตอน login
- **ProfilePage:** section **ENERGY (BMR/TDEE)** = การ์ดโชว์ BMR/TDEE + method badge + เป้า CUT/MAINTAIN/BULK (−500/0/+500) +
  ปุ่ม **Bio & Energy popup** (sex/height/วันเกิด `<input type=date>`/activity 6 ระดับพร้อม label; activity pre-fill จาก
  daysPerWeek ของ program ที่ setup); น้ำหนัก/bodyFat ดึงจาก bodyMetrics ล่าสุดอัตโนมัติ

### C. Excel `program_type` (Phase 4)
- `excelImport.ts`: อ่าน optional Meta key `program_type` → `program.programType` (default `powerlifting` = back-compat)
- อัปเดต `docs/excel-import-guide.md` + `CLAUDE.md` (Meta table) + regenerate `public/atlaslog-program-template.xlsx` (เพิ่มแถว program_type)

### D. Coaching Dashboard (Phase 5)
- `coachApi`: เพิ่ม `getAthleteBodyMetrics`, `getAthleteState` (อ่าน bio+1RM จาก program_state ผ่าน RLS)
- `CoachPage` list: แต่ละแถวโชว์ **last active** (●เขียว/ส้มถ้า >7วัน) + **N workouts this wk · Xk** (fetch sessions ต่อ athlete)
- `AthleteDetailPage`: 3 การ์ดใหม่ — **Adherence** (this week done/planned + weekly volume chart 6 สัปดาห์),
  **Body & Energy** (น้ำหนัก/bodyFat trend + BMR/TDEE ลูกศิษย์), **Strength** (S/B/D + SBD total —
  **โชว์เฉพาะ active program = powerlifting**, ซ่อนถ้า general ล้วน)
- **SQL section 2h (ใหม่ ใน SUPABASE_SETUP.md):** ALTER `program_state` ADD `bio`/`personal_one_rms` +
  policy `coach reads athlete body_metrics` + `coach reads athlete program_state`

### ✅ ทดสอบ local (Playwright 390px) — ผ่านบางส่วน (client-only)
- Date format: dashboard header = `WEDNESDAY · 24-06-2026` ✓
- BMR/TDEE: Katch จาก bodyFat 17.7% → BMR **1744** (=370+21.6×LBM 63.6), TDEE **2093** (×1.2); เปลี่ยน activity →
  ×1.465 → TDEE **2555** ✓; popup โชว์ 6 ระดับ + label + multiplier ครบ ✓

### ✅ ปิดงานรอบ 11 — DONE 2026-06-25 (e2e Playwright 390px)
1. **แก้ UI bug Save bio (root cause):** ไม่ใช่ z-index — `.screen-enter` ใช้ `animation: slidein … both`
   → fill-mode `forwards` ค้าง `transform: translateY(0)` ถาวร → `.atlas-screen` กลายเป็น containing block
   ของ `position:absolute/fixed` descendant → `.sheet-backdrop inset:0` ถูกจำกัดอยู่ในจอที่ scroll แทนที่จะคลุมทั้ง
   `.atlas-app` (เลยเห็น bottom nav โผล่ใต้ปุ่ม). **แก้:** เปลี่ยนเป็น `… ease backwards;` (สถานะ rest เหมือนเดิม
   เป๊ะ ไม่มี transform ค้าง) + เพิ่ม `maxHeight/overflowY` ใน bio sheet กันยาวเกินจอเตี้ย. verify: popup คลุมเต็มจอ,
   Save อยู่ล่างสุด, nav ไม่โผล่
2. ✅ **รัน SQL 2h แล้ว** (ผู้ใช้, "Success. No rows returned")
3. ✅ **e2e ผ่าน:**
   - **bio sync cross-device:** save → POST `program_state` **200** (ก่อนรัน SQL จะ 400) → reload pull จาก cloud →
     TDEE อัปเดต 2555→2703 (activity ×1.465→×1.55) ✓ 0 console errors
   - **date format:** History (header `JUNE 2026` + tile `23 TUE` = label จัดกลุ่ม คงเดิม) · ProgramOverview
     START `10-06-2026` END `02-09-2026` + week range `10-06 – 16-06` · WeekDetail range DD-MM ✓
   - **coach dashboard (coach.test เปิด athlete.a):** list row `● 2 days ago · 6 this wk · 15.9k` · Adherence (6/2 +
     volume chart) · Body&Energy (น้ำหนัก/bodyFat + **BMR 1744/TDEE 2703**) · Strength (SBD **540**) —
     **พิสูจน์ coach อ่าน bio/1RM ลูกศิษย์ผ่าน RLS policy ใหม่ของ SQL 2h ได้จริง**
   - **Excel general import:** import โปรแกรม `program_type=general` → WeekDetail แสดงท่า **ไม่มี kg** (ไม่คำนวณน้ำหนัก) ✓
   - **Strength-card gate:** show-path e2e ผ่าน; hide-branch (`programs.every general && !oneRMset`) code-verified
4. ✅ **commit + deploy** (รอบนี้)

### 🐛 bonus fix ที่เจอตอน e2e
- **Setup Program (ImportProgramSheet + ProgramSetupSheet) บังคับกรอก 1RM แม้โปรแกรมเป็น general** →
  ปุ่ม "เริ่มโปรแกรม" disabled, เริ่มไม่ได้ทั้งที่ general ไม่ใช้ 1RM. **แก้:** เช็ค `programType==='general'` →
  ซ่อน 1RM inputs + เปลี่ยน copy + `isValid` ขอแค่ startDate + oneRMs fallback `|| 0`

### ⚠️ ข้อจำกัด/หมายเหตุ e2e
- **RLS isolation เต็มยังเทสไม่ได้** — athlete.b ไม่เคยถูกสร้าง (email rate limit, ดู TEST_ACCOUNTS.md). policy ใหม่
  ใช้ subquery `status='active'` แบบเดียวกับ sessions/programs ที่ผ่าน isolation รอบ 6–7 มาแล้ว
- **native `<input type=date>` ใน Setup โชว์ MM/DD/YYYY** ตาม browser locale (headless = en-US) — ควบคุมจาก
  แอปไม่ได้ (อยู่นอกขอบเขต date-format text ของรอบนี้); ค่า END DATE ที่แอป render เองยังเป็น DD-MM-YYYY ถูกต้อง

---

## 2026-06-24 — Prod retest รอบ 8–10 + guard race audit

> เก็บงานค้าง 2 ข้อจาก log: (#1) prod retest รอบ 5–10 (เดิม verify แค่ local), (#3) guard race fix `/coach`

### #1 — Prod retest (Playwright 390px, https://atlaslog-web.vercel.app) ✅ ผ่าน
ทดสอบรอบ 8–10 บน prod จริง (ก่อนหน้านี้ B1/B2 เป็นต้นมา verify แค่ local — MCP playwright หลุดตอน kill node):
- **รอบ 9 (gating + visibility):** coach.test เห็นปุ่ม **Create program (+)** + section **PUBLIC PROGRAMS → Public PPL**;
  athlete.a **ไม่มีปุ่ม +** (เหลือ import code/Excel/library) · `/programs/new` ตรง ๆ → **redirect `/programs` สะอาด** (ไม่ flash) · PUBLIC PROGRAMS เห็น Public PPL
- **รอบ 10 (Profile + program type):** BODY COMPOSITION **อยู่เหนือ** 1RM · 1RM เป็น **ปุ่ม → popup** → save coach 200/120/220 → ปุ่มอัปเดตเป็น "200/120/220 →" ·
  เปิด PL Squat → Week 1 **Back Squat 3×5 @8 → 155kg** (คำนวณจาก profile squat 200, **ไม่ต้อง Setup config**)
- **รอบ 8 (custom exercises):** coach มีปุ่ม **Add exercise (+)** + Hack Squat tag CUSTOM + Delete (35 ท่า);
  athlete.a **ไม่มีปุ่ม Add/Delete** แต่เห็นท่า custom ทั้งหมด (pull จาก cloud)
- **console: 0 errors** (เหลือแต่ refresh_token 400 ปกติก่อน login)

### #3 — Guard race fix: ✅ ถูกแก้ครบแล้ว (ไม่ต้องแก้โค้ดเพิ่ม)
ตรวจพบว่า pattern `roleLoaded` (เดิมเพิ่มให้ AdminPage 2026-06-23) ถูกใช้ครบทุก role-gated route แล้ว:
- `AdminPage` / `CoachPage` / `AthleteDetailPage` / `CreateProgramPage` — ทุกหน้า `if (!roleLoaded) return null` ก่อน `if (!canX) return <Navigate>`
- `useAuthStore.roleLoaded`: init(มี user)=รอ role โหลดเสร็จ→true · init(ไม่มี user)=true ทันที · SIGNED_IN=reset false→true · SIGNED_OUT=true
- prod test ยืนยัน: athlete เข้า `/programs/new` ตรง ๆ → redirect ไม่มี flash → **guard race หายแล้ว**

---

## 2026-06-23 — รอบ 10: Profile 1RM popup + program type (general/powerlifting)

- **ProfilePage:** ย้าย **BODY COMPOSITION ขึ้นเหนือ** 1RM; เปลี่ยน PERSONAL 1RM จาก card inline →
  **ปุ่มเมนู** (โชว์ค่า S/B/D ปัจจุบัน) → กดเปิด **popup sheet** (inputs + Save)
- **Program type:** `StructuredProgram.programType?: 'general' | 'powerlifting'` (undefined = powerlifting, legacy)
  - **CreateProgramPage:** selector **PROGRAM TYPE** (General / Powerlifting)
  - **General** → ไม่คำนวณน้ำหนัก (log เอง); **Powerlifting** → คำนวณจาก 1RM
- **Weight calc (WeekDetailPage):** `isPowerlifting ? (config.oneRMs ถ้ามี else personalOneRMs โปรไฟล์) : null`
  - powerlifting created program → ใช้ **profile 1RM ไม่ต้อง setup**; built-in เดิมที่มี config 1RM ยังใช้ config (ไม่ regress)
- ไม่มี SQL/edge — programType อยู่ใน program jsonb (sync ผ่าน custom_programs เอง)
- **ผล:** `pnpm build` + `pnpm lint` ผ่าน
- ✅ **e2e (Playwright 390px):**
  - Profile: BODY อยู่เหนือ 1RM · 1RM เป็นปุ่ม → popup → save 150/100/180 (athlete) / 200/120/220 (coach)
  - PL program (Back Squat main, RPE8, **ไม่ setup config**) → week แสดง **155kg** (= profile squat 200 × RPE8@5 ≈77.5%)
  - General program (Back Squat RPE8) → **ไม่มี kg** (ไม่คำนวณ) · 0 console errors

---

## 2026-06-23 — รอบ 9: Create gating + program visibility (Public programs)

> (1) เฉพาะ coach/admin สร้างโปรแกรมได้ (2) ตอนสร้างเลือก visibility: Private / Code / Public.
> user ธรรมดาใช้ได้แค่ public programs + import code

- **DB:** `alter table shared_programs add column is_public boolean default false` (SUPABASE_SETUP **2g**)
- `shareApi` — `createShare(program, isPublic)` + `listPublicPrograms()` (select is_public=true) + type `PublicProgram`
- **CreateProgramPage** — guard `!canCreate (isCoach||isAdmin)` → redirect /programs; selector
  **VISIBILITY: Private / Share by code / Public**; on create → addCustomProgram +
  (code→createShare แล้วโชว์โค้ด, public→createShare is_public) ; rename canCreate→canSave
- **ProgramsPage** — ปุ่ม **+** เฉพาะ coach/admin; section ใหม่ **PUBLIC PROGRAMS** (listPublicPrograms
  ตอน mount) → กด GET → importShare(code) → addCustomProgram → overview
- **ผล:** `pnpm build` + `pnpm lint` ผ่าน
- ✅ **รัน SQL 2g แล้ว + e2e ผ่าน (Playwright 390px, 2026-06-23):**
  - athlete.a: **ไม่มีปุ่ม +** · `/programs/new` ตรง ๆ → redirect `/programs` (guard)
  - coach.test: สร้าง "Public PPL" (Public) → โผล่ใน **PUBLIC PROGRAMS**; สร้าง "Code PPL" (Code) →
    ได้โค้ด `ZSC6YG`
  - athlete.a: เห็น **Public PPL** แต่ **Code PPL ไม่ขึ้น** (is_public=false ถูกตัด) → กด GET → import
    เข้า MY PROGRAMS + ไป overview · 0 console errors
  - ไม่ต้อง redeploy edge fn (RLS ตรง ๆ)

---

## 2026-06-23 — รอบ 8: Custom exercises (coach/admin เพิ่มท่าใน Library)

> coach/admin เพิ่มท่าเองได้ในหน้า Library เก็บ cloud (ทุกคนเห็น, แก้/ลบเฉพาะเจ้าของ) ตามแพทเทิร์น body_metrics/runs

- **DB:** ตารางใหม่ `custom_exercises` (id, name, **muscle_group** (group=reserved), equipment, created_by)
  + RLS: authed read / insert+delete own-row (SUPABASE_SETUP **section 2f**)
- `data.ts` — `CUSTOM_EXERCISES` live binding + `setCustomExercisesRegistry()` + `allExercises()` +
  `EXERCISE_GROUPS` + `EQUIPMENT_OPTIONS` + `makeExerciseId()` (slug + กัน id ซ้ำ)
- `utils.getExercise` — หา custom ด้วย (ผ่าน live binding) → History/Logger resolve ชื่อท่า custom ได้
- `syncQueue` — ops `exercise-upsert/delete` + fns; `useAppStore` `customExercises[]` +
  add/remove/set (อัปเดต registry mirror + sync) + persist + onRehydrate set registry + clear ตอน signout
- `useAuthStore.loadUserData` — pull `custom_exercises` (ทุกแถว ไม่ filter user) ตอน login
- **LibraryPage** — ปุ่ม **+** เฉพาะ `isCoach||isAdmin` → sheet New Exercise:
  **name** (text, บังคับ) · **group** (select EXERCISE_GROUPS, บังคับ) · **equipment** (input+datalist,
  เลือกหรือพิมพ์เอง, optional); custom row มี tag CUSTOM + ลบได้ (coach/admin); list/pickers ใช้ allExercises()
- pickers (SwapSheet, AccessoryEditSheet, CreateProgram ExercisePicker) → `allExercises()` เห็นท่า custom
- **ผล:** `pnpm build` + `pnpm lint` ผ่าน
- ✅ **รัน SQL section 2f แล้ว + e2e ผ่าน (Playwright 390px, 2026-06-23):**
  - coach.test → Library ปุ่ม + → New Exercise "Hack Squat" / Legs / Machine → ขึ้นใน Library
    tag **CUSTOM** (count 19→20), id `hack-squat`, sync-queue=`[]` (push cloud สำเร็จ)
  - **cross-device + gating:** `localStorage.clear()` → login **athlete.a** → Hack Squat ขึ้น
    (pull จาก cloud) แต่ **ไม่มีปุ่ม +** (gating coach/admin ทำงาน)
  - picker Create Program (athlete) เห็น Hack Squat ด้วย · 0 console errors
  - ไม่ต้อง redeploy edge function (ใช้ RLS ตรง ๆ ไม่ผ่าน edge fn)
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
- ✅ **consent flow — SQL 2e + redeploy edge fn เสร็จ + e2e ผ่าน (Playwright 390px, 2026-06-23):**
  - coach.test ADD athlete.a → "Request sent" + badge **PENDING**
  - **พิสูจน์ pending กันอ่าน:** โค้ชเปิด detail athlete.a ตอน pending → **0 WORKOUTS** (RLS ตัด
    แม้ athlete.a มี session จริง)
  - athlete.a login → Home การ์ด **COACH REQUEST** "coach.test wants to coach you" → กด **Accept** →
    การ์ดหาย
  - coach.test login → athlete.a เป็น **ATHLETE (active)** → detail เห็นข้อมูลจริง (6 WORKOUTS,
    16k KG, PROGRAMS 2) → RLS เปิด access หลัง active · 0 console errors

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
| A1/A2 | History แสดงทุก set + sync program progress ข้ามเครื่อง (`program_state`) | ✅ Done (2026-06-23) — e2e + deploy |
| B1/B2 | Body composition (น้ำหนัก/กล้ามเนื้อ/ไขมัน) + Running/Cardio (`/runs`) | ✅ Done (2026-06-23) — e2e + deploy |
| UX 2–3 | Logger +Add exercise·Library คลิกได้·run date·Home FAB ออก·Running weekly·formatDate | ✅ Done (2026-06-23) — e2e + deploy |
| UX 4–5 | COACHING ใน Profile เฉพาะ coach/admin (ปุ่มเดียว → /coach) | ✅ Done (2026-06-23) — e2e + deploy |
| 6 | Coach add athletes (edge action `add-athlete`) | ✅ Done (2026-06-23) — e2e + deploy |
| 7 | Athlete consent (pending→Accept) + Create Program (`/programs/new`, 1 wk × N) | ✅ Done (2026-06-23) — e2e + deploy |
| 8 | Custom exercises ใน Library (coach/admin เพิ่มท่า, cloud `custom_exercises`) | ✅ Done (2026-06-23) — e2e + deploy |
| 9 | Create=coach/admin only + program visibility Private/Code/**Public** (Discover) | ✅ Done (2026-06-23) — e2e + deploy |
| 10 | Profile: BODY เหนือ 1RM + 1RM เป็น popup · program type general/powerlifting (PL คำนวณจาก profile 1RM ไม่ต้อง setup) | ✅ Done (2026-06-23) — e2e + deploy |
| — | **Prod retest รอบ 8–10** (Playwright 390px บน prod จริง) + ยืนยัน guard race fix ครบทุก role-gated route | ✅ Done (2026-06-24) — 0 console errors |
| 11 | **BMR/TDEE** (Profile) + **Coaching dashboard** (adherence/body/strength gate) + **date DD-MM-YYYY** + Excel program_type | 🔄 โค้ดเสร็จ (build+lint ผ่าน) — ⛔ ค้าง: รัน SQL 2h + e2e เต็ม + แก้ z-index Save bio + commit |

> **Supabase ที่ต้องมี (รันครบแล้ว):** SUPABASE_SETUP sections 2 / 2b / 2c (`program_state`) /
> 2d (`body_metrics`,`runs`) / 2e (coach_athlete `pending`) / 2f (`custom_exercises`) /
> 2g (`shared_programs.is_public`) + edge functions `admin-users`, `coach`
> (deploy ล่าสุดมี add-athlete/respond-link). รอบ 10 ไม่มี SQL/edge ใหม่ (programType อยู่ใน program jsonb)

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
