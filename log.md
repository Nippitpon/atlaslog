# Atlaslog — Development Log

> อัปเดตล่าสุด: 2026-06-19

---

## สถานะปัจจุบัน

| Phase | งาน | สถานะ |
|-------|-----|-------|
| 1 | Core UX (Router, Dashboard, Logger, History, Library, Profile) | ✅ Done |
| 2 | Excel Import (.xlsx → StructuredProgram) | ✅ Done |
| 3 | Supabase Auth + Cloud Sync | ✅ Done — เชื่อม Supabase จริง + ทดสอบ local ผ่าน (เหลือ Vercel env vars สำหรับ production) |
| 4 | Social / Coach-Athlete features | 🔜 Not started |

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
| **admin guard race (ใหม่)** | navigate ตรงไป `/admin` ทันทีหลัง login ถูก redirect กลับ `/` เพราะ `loadRole()` async ยังไม่เสร็จ — กดปุ่มจาก Profile ใช้ได้ปกติ | ต่ำ |
| **pull เฉพาะตอน SIGNED_IN** | reload หน้าใช้ local persist (INITIAL_SESSION ไม่ trigger pull) — ปกติพอ แต่ถ้าแก้ข้อมูลจากอีกเครื่องจะไม่ refresh จนกว่าจะ re-login | ต่ำ |
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
