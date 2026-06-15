# Atlaslog — Development Log

> อัปเดตล่าสุด: 2026-06-15

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

### ยังค้างอยู่

- [ ] **ขั้นที่ 4** — ใส่ env vars ใน Vercel (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) +
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
| **signUp UI bug (ใหม่)** | เมื่อ Confirm email ปิด signUp ได้ session ทันที แต่ UI ยังโชว์ "Check your email" (ควรเช็ค session แล้ว navigate ไป `/` แทน) | ต่ำ |
| **pull เฉพาะตอน SIGNED_IN** | reload หน้าใช้ local persist (INITIAL_SESSION ไม่ trigger pull) — ปกติพอ แต่ถ้าแก้ข้อมูลจากอีกเครื่องจะไม่ refresh จนกว่าจะ re-login | ต่ำ |
| **ยังไม่ได้ทดสอบ production** | env vars ยังไม่ใส่ใน Vercel จริง | กลาง |

---

## Phase 4 — แผนงานถัดไป (ยังไม่เริ่ม)

> รอ Phase 3 stable ก่อน

- Coach-athlete linking (invite code หรือ email)
- Coach dashboard: ดู progress ของนักกีฬาหลายคน
- Push notifications: เตือนวันซ้อม
- Program sharing: share ลิงก์ custom program ให้คนอื่น import

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
