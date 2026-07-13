# Code Review — Atlaslog (2026-07-13)

> Senior review แบบเต็ม ครอบ 4 ด้าน: state/sync, domain logic + Excel import, security/privacy, UI workout flows
> ทุกข้อ verify กับโค้ดจริงแล้ว (อ้าง `file:line`). ยังไม่มี unit test / E2E เลยสักไฟล์ — เป็นความเสี่ยงหลัก
> ใช้ไฟล์นี้เป็น backlog: ติ๊ก `[x]` เมื่อแก้เสร็จ แล้วอ้าง commit

## สรุปภาพรวม

โครงสร้างดีและ guard หลายจุดถูกต้อง (workout ค้าง refresh ไม่หาย, route admin/coach มี guard จริง,
`getExercise` มี fallback, ไม่มี secret หลุด, ไม่มี XSS sink) **แต่** ชั้น sync/offline และ Excel import
มีบั๊กที่ทำ **ข้อมูลผู้ใช้หายจริง** หลายจุด และมี **crash จอขาวที่ trigger ได้ด้วย cell เดียวใน Excel**

**ลำดับที่ควรลุยก่อน:** (1) กลุ่ม sync data-loss 4 ตัว → (2) Excel validation (crash + pct + id) →
(3) security 3 ตัว

---

## 🔴 ระดับสูง — ควรแก้ก่อนปล่อยจริง

- [ ] **Sync queue เขียนทับ op ที่ต่อคิวระหว่าง flush** — `apps/web/src/lib/syncQueue.ts:211,236`
  `flushQueue` snapshot คิว แล้วตอนจบ `writeQueue(remaining)` เขียนทับทั้ง key ด้วย snapshot เก่า →
  ถ้า user log เวิร์กเอาต์ระหว่าง flush รอ network อยู่ op นั้นถูกลบทิ้งเงียบ ๆ ไม่เคย sync
  **แก้:** re-read คิวตอนเขียนกลับแล้ว merge ส่วนที่เพิ่มใหม่; ให้ entry มี id เพื่อ diff แม่นยำ

- [ ] **Op ที่ต่อคิวตอน sign-out ถูก sync เข้าบัญชีคนถัดไป** — `apps/web/src/lib/syncQueue.ts:149,225`
  op ตอนไม่ล็อกอิน enqueue เป็น `userId:null`, flush ถือว่า null = user ปัจจุบัน →
  เครื่องแชร์: A ล็อกเอาต์แล้ว log, B ล็อกอิน → เวิร์กเอาต์ A ไปโผล่ใน cloud ของ B
  **แก้:** stamp entry ด้วย last-known user id แทน null; null สงวนไว้เฉพาะ migration entry เก่า

- [ ] **Debounce timer + sign-out ล้าง program_state บน cloud เป็นค่าว่าง** — `apps/web/src/store/useProgramStore.ts:42`, `apps/web/src/features/profile/ProfilePage.tsx:31`
  แตะสถานะวันแล้ว sign-out ภายใน 800ms → timer ไม่ถูกยกเลิก, `handleSignOut` เคลียร์ state,
  timer ยิงอ่าน state ว่าง → enqueue snapshot ว่าง → ล็อกอินกลับ progress/1RM/bio หายหมด
  **แก้:** export `cancelStateSync()` เรียกใน `signOut`; ห้าม enqueue snapshot ตอน userId null

- [ ] **`loadUserData` แข่งกับ `flushQueue` ตอน sign-in** — `apps/web/src/store/useAuthStore.ts:166`
  ทั้งคู่รันพร้อมกัน; `loadUserData` แทนที่ history/state ทั้งก้อนด้วย cloud →
  เซ็ตที่ log offline (ยังในคิว) ถูก cloud เก่าทับ หายจากจอ
  **แก้:** `await flushQueue()` ก่อน `loadUserData`; หรือ merge ตาม id แทน replace

- [ ] **reps ทศนิยม/ไม่ถูกต้องจาก Excel → crash จอขาว** — `apps/web/src/lib/rpeTable.ts:21`, `apps/web/src/lib/excelImport.ts:111`
  importer รับ `reps=2.5` (`Number()||1` ไม่กรอง) → `getRpePct` ทำ `RPE_TABLE[1.5]`=undefined →
  TypeError บน **render path** ของหน้า week + dashboard → จอขาวตราบที่ยังตั้งโปรแกรมนี้
  **แก้:** `Math.round(reps)` ใน `getRpePct` + validate reps เป็นจำนวนเต็มบวก/AMRAP ฝั่ง import

- [ ] **pct ไม่ตรวจช่วง** — `apps/web/src/lib/excelImport.ts:114`
  กรอก `75` แทน `0.75` ได้ → 180×75 = **13,500 kg** prefill เข้า logger; pct ติดลบก็ผ่าน
  **แก้:** reject ถ้า `pct<=0 || pct>1.05` พร้อมเลข row (หรือ auto-หาร 100 ถ้าอยู่ 1–100 แล้วเตือน)

- [ ] **คีย์ override ชนกัน → เซ็ต back-off prefill น้ำหนักเท่า top set** — `apps/web/src/features/programs/WeekDays.tsx:250` + importer/CreateProgram ไม่ใส่ `id`
  Excel import (`excelImport.ts:139`) และ CreateProgramPage (`ExerciseDraft`) ไม่เคยใส่ `id` →
  2 row ลิฟต์เดียวกัน rpe เท่ากัน / pct-only (rpe=undefined) → key ชนกัน →
  เช่น "Squat 5×5@75%" + "3×3@85%" prefill 85% ทั้งคู่ = เทรนหนักเกิน 10%
  **แก้:** ใส่ `id` ต่อ row ตอน import/create (`w{n}-{day}-e{i}`) หรือ key ด้วยตำแหน่ง row

- [ ] **แก้ไขโปรแกรมที่ import จาก Excel → สร้างใหม่ทุกสัปดาห์จาก week 1** — `apps/web/src/features/programs/CreateProgramPage.tsx:48,159`
  edit mode อ่านแค่ `weeks[0].days` แล้ว regenerate ทุกสัปดาห์ → periodization
  (accessory ไต่ pct, วัน/ท่าเฉพาะสัปดาห์หลัง) หายหมดแค่กด "Save"
  **แก้:** reconstruct จากทุกสัปดาห์ key ด้วย exercise id; หรือบล็อกการแก้เมื่อสัปดาห์ไม่ uniform

- [ ] **ปุ่ม "Continue"/START ทับ workout ที่ค้าง ไม่มีทาง resume** — `apps/web/src/features/programs/WeekDays.tsx:243`, `apps/web/src/store/useAppStore.ts:77`
  `startWorkout` แทนที่ workout เสมอ, ไม่มี UI กลับไปเวิร์กเอาต์ค้าง →
  log 15 เซ็ตแล้วกด back, กลับมากด Continue = เซ็ตหายหมด ไม่มี confirm
  **แก้:** ถ้า programId ตรงกับ workout ค้าง → navigate เฉย ๆ; ถ้าต่าง → confirm; เพิ่ม banner "มีเวิร์กเอาต์ค้าง"

- [ ] **ลบ custom program แตะเดียว ไม่ confirm ลบทั้ง cloud** — `apps/web/src/features/programs/ProgramsPage.tsx:274`
  ไอคอนถังขยะเรียก `removeCustomProgram` ทันที ลบ progress+config+cloud (LibraryPage มี `confirm` แต่หน้านี้ไม่มี)
  **แก้:** ครอบด้วย confirm dialog ให้เหมือน `LibraryPage.handleDelete`

- [ ] **🔒 coach edge function เปิดให้ harvest อีเมลผู้ใช้ทุกคน** — `supabase/functions/coach/index.ts:59`
  `resolveUser` match ด้วย **prefix ของ UUID** + function ไม่เช็ค role ฝั่ง server →
  เรียก `addAthlete("a")` ไล่ prefix ดึงอีเมลผู้ใช้ทุกคนออกมาได้ (privacy breach)
  **แก้:** บังคับ role coach/admin ฝั่ง server; ตัด prefix-match ให้ต้องเป็น UUID เต็ม/อีเมลตรง; rate-limit

---

## 🟡 ระดับกลาง

### กลุ่มควรแก้ก่อน

- [ ] **calories หายตอน round-trip cloud** — `syncQueue.ts:61`, `useAuthStore.ts:74`
  `sessionRow` ไม่ส่ง `calories`, load กลับไม่อ่าน → ล็อกอินแล้ว calories หายจากทุก session
  **แก้:** เพิ่มคอลัมน์ `calories` ใน row + mapping
- [ ] **ไม่มี retry limit/backoff/แยกชนิด error** — `syncQueue.ts:139,229`
  RLS deny/constraint fail แยกจาก network blip ไม่ได้ → op fail ถาวรวนไม่จบ ผู้ใช้ไม่รู้
  **แก้:** นับ attempt, drop/dead-letter หลัง N, ถือ 4xx เป็น permanent
- [ ] **`flushing` guard ตั้งหลัง `await`** — `syncQueue.ts:210,218`
  ตั้ง `flushing=true` หลัง `await getUser()` → SIGNED_IN + `online` ยิงพร้อมกัน = flush ซ้อน
  **แก้:** ตั้ง `flushing=true` เป็นบรรทัดแรกแบบ sync
- [ ] **SIGNED_OUT ไม่ล้าง store** — `useAuthStore.ts:190`
  เคลียร์อยู่แค่ในปุ่ม ProfilePage → session หมดอายุ/ล็อกเอาต์ tab อื่น → ข้อมูล A ค้าง, B ล็อกอินได้ต่อ
  **แก้:** ย้ายการเคลียร์ทั้งหมด (รวม `workout:null` + cancel timer) ไป handler `SIGNED_OUT`
- [ ] **persist ไม่มี `version`/`migrate` (ทั้ง 2 store)** — `useAppStore.ts:196`, `useProgramStore.ts:228`
  เปลี่ยน shape ครั้งหน้า → user เดิม rehydrate ของเก่าทับ = error/field หาย; key `atlas:v1` เก่ายังค้าง
  **แก้:** เพิ่ม `version:1`+`migrate` เดี๋ยวนี้ + ลบ key `atlas:v1`
- [ ] **sets ไม่จำกัดเพดาน + ไม่เช็คจำนวนเต็ม** — `excelImport.ts:103`
  `sets=1000000` ผ่าน → `Array.from({length})` สร้าง state ล้าน element → tab ค้าง/quota แตก
  **แก้:** บังคับจำนวนเต็ม 1–50 พร้อมเลข row
- [ ] **วันที่คำนวณแบบ UTC ทั้งแอป** — `DashboardPage.tsx:129`, `ProgramSetupSheet.tsx:54`, `RunsPage.tsx:13`, `ProgramOverviewPage.tsx:193`
  `new Date('YYYY-MM-DD')`=UTC midnight → ไทย (UTC+7) ช่วง 00:00–07:00 "วันนี้"=เมื่อวาน:
  default start date เพี้ยน, สัปดาห์ปัจจุบันเลื่อน, RunsPage `max` บล็อกวันนี้
  **แก้:** helper parse เป็น local date จุดเดียว (แบบ `useProgramStore.ts:178`)
- [ ] **week นับ "done" หลังทำวันแรกวันเดียว** — `ProgramsPage.tsx:130`, `ProgramOverviewPage.tsx:263`
  นับด้วย `every(s==='done')` บน key เฉพาะวันที่แตะ → ทำ 1/4 วัน = สัปดาห์นับ done → ขัดกับ dashboard
  **แก้:** ใช้ `getWeekStatus(...)` เทียบ `week.days.length` ทั้ง 3 จุด
- [ ] **🔒 coach function ไม่เช็ค role + resolve-link auto-active** — `coach/index.ts:38,62`
  ไม่มี role check ฝั่ง server; `resolve-link` สร้าง link `active` โดยเป้าหมายไม่ต้องยินยอม (spam/impersonate)
  **แก้:** เพิ่มเช็ค `profiles.role` แบบเดียวกับ admin-users; resolve-link เริ่ม `pending`
- [ ] **🔒 `shared_programs` SELECT `using(true)`** — `SUPABASE_SETUP.md:85`
  policy ให้อ่านทุก row ไม่ใช่เฉพาะ code ที่รู้ → authed คนไหนก็ดึงโปรแกรมที่แชร์ของทุกคน + owner_id ได้
  **แก้:** `using(is_public=true OR owner_id=auth.uid())` + import-by-code ผ่าน RPC `security definer`

### กลุ่มแก้ทีหลัง

- [ ] **re-enqueue ทำลำดับ op พัง → record ที่ลบแล้วฟื้น** — `syncQueue.ts:143` — เมื่อคิวไม่ว่างให้ enqueue แทน attempt ตรง; หรือ compact per-entity
- [ ] **queue โตไม่จำกัดสำหรับ user ที่ไม่เคย sign-in + quota เงียบ** — `syncQueue.ts:40` — ข้าม enqueue ถ้าไม่เคยล็อกอิน; cap คิว; surface quota
- [ ] **ไม่มี cross-tab reconciliation** — ทั้ง 2 store — ฟัง `storage` event แล้ว `persist.rehydrate()`
- [ ] **week ไม่ต่อเนื่อง (1,2,4) เพี้ยน + rpe ไม่เช็คช่วง** — `excelImport.ts:161` — validate week ต่อเนื่องจาก 1; validate rpe∈[6,10]
- [ ] **swap ท่าไม่เปลี่ยนชื่อ/RPE เป้า** — `LoggerPage.tsx:274` — ตอนเลือกให้เซ็ต `name` ใหม่ + เคลียร์ `targetRpe`
- [ ] **ไม่มี route 404 / errorElement** — `router.tsx:19` — เพิ่ม catch-all `path:'*'` + `errorElement` บน shell
- [ ] **`/workout` เมื่อไม่มี workout = จอว่างตัน** — `LoggerPage.tsx:31` — `return <Navigate to="/" replace/>` แทน `null`
- [ ] **Redo วัน done แล้ว cancel → ตกเป็น in_progress ถาวร** — `LoggerPage.tsx:42` — set `in_progress` เฉพาะตอนสถานะเดิม `not_started`
- [ ] **Finish 0 เซ็ต → mark done + session ว่างลบไม่ได้** — `useAppStore.ts:106` — disable Confirm เมื่อ `setCount===0`; เพิ่มลบ session ใน History
- [ ] **drag ไม่จับ `pointercancel`** — `CreateProgramPage.tsx:124` — ฟัง `pointercancel` handler เดียวกัน หรือ `setPointerCapture`

---

## 🟢 ระดับต่ำ — polish

- [ ] Service worker เปิด URL จาก push payload ได้ทุก origin (ต้องมี CRON_SECRET) — `sw.js:22` → รับเฉพาะ same-origin/relative
- [ ] `send-push` เทียบ secret ด้วย `!==` (timing) — `send-push/index.ts:26` → constant-time compare
- [ ] `fetchAllExercises` ถือ error กลาง pagination เป็น end-of-data → library ขาด — `useAuthStore.ts:53` → throw บน error
- [ ] Session id ใช้ `Date.now()` เป็น PK → 2 เครื่อง finish มิลลิวินาทีเดียวทับกัน — `useAppStore.ts:118` → `crypto.randomUUID()`
- [ ] `formatPace` เรนเดอร์ "4:60" ได้ — `utils.ts:99` → carry `if(s===60){m++;s=0}`
- [ ] back/backdrop ทิ้ง draft โปรแกรมทั้งชุด ไม่ confirm — `CreateProgramPage.tsx:224`, `ImportProgramSheet.tsx:122`
- [ ] `navigate()` ตอน render (React warning) — `ProgramOverviewPage.tsx:50`, `WeekDetailPage.tsx:46` → ใช้ `<Navigate>`
- [ ] BottomNav highlight Home บน nested route — `BottomNav.tsx:17`
- [ ] label "Week 13/12" ไม่ clamp — `ProgramsPage.tsx:179`
- [ ] duration ไม่ cap เวิร์กเอาต์ค้างข้ามคืน — `useAppStore.ts:109`
- [ ] `App.tsx` เป็น dead Vite template ไม่มีใคร import → ลบทิ้ง
- [ ] `init()` ไม่ idempotent, ไม่ unsubscribe (StrictMode double-mount subscribe ซ้ำ) — `useAuthStore.ts:161` → `if(initialized) return` ต้นฟังก์ชัน

---

## จุดที่ควรเพิ่ม test (เรียงตามความคุ้ม)

1. **`flushQueue`/`enqueue`** (`syncQueue.ts`) — เสี่ยงสุด, mock supabase + fake localStorage:
   enqueue-ระหว่าง-flush, null-owner attribution, double-flush, ลำดับ op ตอน fail — ตอนนี้ 0% บน path เดียวที่ทำข้อมูลหาย/ปนบัญชี
2. **`parseExcelFile`** — pure `File→ImportResult` ครอบข้อ import ทั้งชุด (pct/rpe/reps/sets range, error+เลข row, AMRAP, week ต่อเนื่อง); fixture = xlsx buffer เล็ก
3. **`getRpePct`/`calcWeight`/`structuredWeight`** — pure math: fractional-reps crash, interpolation 8.8/9.3, clamp ขอบ, precedence pct-over-rpe, rounding 2.5, `oneRM=0`
4. **date helper** — แยก "สัปดาห์ปัจจุบันจาก startDate" + "endDate" เป็น pure function แล้วเทสต์ขอบสัปดาห์/timezone/off-by-one
5. **E2E (Playwright):** logger lifecycle (start→check→reload→finish→assert); interrupt/resume (regression ข้อสูง #9); custom program delete (#10); deep-link & guard (`/workout` ว่าง, program ไม่มี, `/admin` เป็น user, 404); date boundary ด้วย mocked clock อาทิตย์ 00:30/23:30

---

## ✅ ตรวจแล้วปลอดภัย (ไม่ใช่บั๊ก)

- ไม่มี secret หลุด (grep `eyJ`/`service_role`/`PRIVATE_KEY` เจอแต่ placeholder + `.env.local`/vapid gitignored)
- ไม่มี `dangerouslySetInnerHTML`/XSS sink — string จาก Excel/program render เป็น text (escape อัตโนมัติ)
- `admin-users` เช็ค JWT + `profiles.role==='admin'` ฝั่ง server ครบ, กัน self-demote/self-delete
- `profiles` RLS มีแค่ SELECT `auth.uid()=id` ไม่มี INSERT/UPDATE → user self-promote เป็น admin/coach ไม่ได้
- share code ใช้ CSPRNG (`crypto.getRandomValues`)
- refresh กลางเวิร์กเอาต์ไม่หาย — `workout` อยู่ใน persist `partialize`, rehydrate sync
- double-tap "Confirm & Finish" ปลอดภัย — ครั้งที่ 2 เจอ `if(!workout) return null`
- route `/admin`, `/coach`, `/coach/:id` มี guard จริง (`if(!isAdmin) <Navigate to="/"/>`)
- `getExercise` ไม่ crash บน id ที่ไม่รู้จัก — คืน stub `{id, name:'Exercise'}`
- division-by-zero ใน stats guard แล้ว (`Math.max(1, ...)`, `formatPace` คืน '—')
