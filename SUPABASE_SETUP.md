# Supabase Setup — Atlaslog Phase 3

## 1. Create Supabase Project

1. Go to https://supabase.com and create a free account
2. Click **New project** — ตั้งชื่อ `atlaslog`, เลือก region ใกล้ที่สุด
3. รอจนโปรเจกต์ ready (~1 min)

## 2. Run SQL Schema

ไปที่ **SQL Editor** แล้ว paste และ run:

```sql
-- Sessions table (workout history)
create table sessions (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  program_id text,
  name text not null,
  date timestamptz not null,
  duration int not null,
  volume numeric not null,
  set_count int not null,
  exercises jsonb,
  created_at timestamptz default now()
);

alter table sessions enable row level security;
create policy "own sessions" on sessions for all using (auth.uid() = user_id);

-- Custom programs table
create table custom_programs (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  program jsonb not null,
  created_at timestamptz default now()
);

alter table custom_programs enable row level security;
create policy "own programs" on custom_programs for all using (auth.uid() = user_id);
```

## 2b. Phase 4 — Social (Coach-Athlete / Sharing / Notifications)

รัน SQL เพิ่มใน **SQL Editor** (ตารางใหม่ 3 ตัว + policy ให้โค้ชอ่านข้อมูลลูกศิษย์):

```sql
-- ความสัมพันธ์โค้ช-ลูกศิษย์
create table public.coach_athlete (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references auth.users(id) on delete cascade,
  athlete_id uuid references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz default now(),
  unique (coach_id, athlete_id)
);
alter table public.coach_athlete enable row level security;
create policy "see own links" on public.coach_athlete for select
  using (auth.uid() = coach_id or auth.uid() = athlete_id);
create policy "delete own links" on public.coach_athlete for delete
  using (auth.uid() = coach_id or auth.uid() = athlete_id);

-- โค้ชอ่าน sessions/custom_programs ของลูกศิษย์ที่ active (policy เพิ่ม ไม่แตะของเดิม)
create policy "coach reads athlete sessions" on public.sessions for select using (
  user_id in (select athlete_id from public.coach_athlete
              where coach_id = auth.uid() and status = 'active'));
create policy "coach reads athlete programs" on public.custom_programs for select using (
  user_id in (select athlete_id from public.coach_athlete
              where coach_id = auth.uid() and status = 'active'));

-- แชร์โปรแกรมด้วยโค้ดสั้น (code เดาไม่ได้ → ใช้เป็น capability)
create table public.shared_programs (
  code text primary key,
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  program jsonb not null,
  created_at timestamptz default now()
);
alter table public.shared_programs enable row level security;
create policy "insert own share" on public.shared_programs for insert
  with check (auth.uid() = owner_id);
-- NOTE: use `to authenticated using (true)` — NOT `auth.role() = 'authenticated'`
-- (deprecated; returns null in some projects → cross-account reads silently fail
-- → importer gets "Program not found for that code")
create policy "any authed reads by code" on public.shared_programs for select
  to authenticated using (true);
create policy "delete own share" on public.shared_programs for delete
  using (auth.uid() = owner_id);

-- in-app notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  type text not null,            -- 'coach_linked' | 'program_shared'
  data jsonb,
  read_at timestamptz,
  created_at timestamptz default now()
);
alter table public.notifications enable row level security;
create policy "own notifications" on public.notifications for all using (auth.uid() = user_id);
```

## 2c. Program State sync (cross-device progress)

> แก้บั๊ก: progress/1RM/วันเริ่มโปรแกรม เดิมอยู่ localStorage เครื่องเดียว → เปิดอีกเครื่องแล้ว
> Active Program ไม่รู้ว่าซ้อมถึงวันไหน. ตารางนี้ sync ทั้ง state (1 row/user) ขึ้น cloud.

รัน SQL เพิ่มใน **SQL Editor**:

```sql
-- per-user program progress + configs (1RM/start date) + custom accessories
create table public.program_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  progress jsonb not null default '{}',
  configs jsonb not null default '{}',
  custom_accessories jsonb not null default '{}',
  updated_at timestamptz default now()
);
alter table public.program_state enable row level security;
create policy "own program state" on public.program_state for all using (auth.uid() = user_id);
```

## 2d. Body Composition + Running (Phase B)

> เก็บน้ำหนักตัว/มวลกล้ามเนื้อ/%ไขมัน (เผื่อคำนวณ BMR·TDEE ใน phase ถัดไป) + log การวิ่ง.
> รัน SQL เพิ่มใน **SQL Editor**:

```sql
-- body composition log
create table public.body_metrics (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  date timestamptz not null,
  weight_kg numeric not null,
  skeletal_muscle_kg numeric,
  body_fat_pct numeric,
  created_at timestamptz default now()
);
alter table public.body_metrics enable row level security;
create policy "own body metrics" on public.body_metrics for all using (auth.uid() = user_id);

-- running / cardio log
create table public.runs (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  date timestamptz not null,
  distance_km numeric not null,
  duration_min numeric not null,
  note text,
  created_at timestamptz default now()
);
alter table public.runs enable row level security;
create policy "own runs" on public.runs for all using (auth.uid() = user_id);
```

## 2e. Coach consent — pending status (2026-06-23)

> โค้ช add นักกีฬา → ลิงก์เริ่มเป็น `pending` (นักกีฬาต้องกด Accept ก่อน โค้ชถึงอ่านข้อมูลได้).
> RLS coach-read มีเงื่อนไข `status = 'active'` อยู่แล้ว → pending = โค้ชยังอ่านไม่ได้โดยอัตโนมัติ.
> ต้องขยาย CHECK constraint ให้รับค่า `pending`:

```sql
alter table public.coach_athlete drop constraint if exists coach_athlete_status_check;
alter table public.coach_athlete add constraint coach_athlete_status_check
  check (status in ('pending','active','archived'));
```

> หลังรัน SQL นี้ → **redeploy edge function `coach`** (มี action `add-athlete` แบบ pending +
> `respond-link` ใหม่)

## 2f. Custom exercises (coach/admin เพิ่มท่าใน Library)

> coach/admin เพิ่มท่าเองได้ในหน้า Library → เก็บใน cloud, ทุกคน (authenticated) อ่านได้
> (ทีมใช้ท่าเดียวกัน), แก้/ลบได้เฉพาะเจ้าของ. `group` ใช้ชื่อคอลัมน์ `muscle_group` (`group` เป็น reserved word)

```sql
create table public.custom_exercises (
  id text primary key,
  name text not null,
  muscle_group text not null,
  equipment text,
  created_by uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.custom_exercises enable row level security;
create policy "authed read exercises" on public.custom_exercises for select to authenticated using (true);
create policy "insert own exercise" on public.custom_exercises for insert with check (auth.uid() = created_by);
create policy "delete own exercise" on public.custom_exercises for delete using (auth.uid() = created_by);
```

> หมายเหตุ: การจำกัด "เฉพาะ coach/admin" บังคับฝั่ง UI (ปุ่มเพิ่มโชว์เฉพาะ `isCoach || isAdmin`)
> เหมือน coach features อื่น ๆ; RLS บังคับ insert/delete เป็น own-row

## 2g. Public programs (Discover)

> ตอน Create Program (coach/admin) เลือก visibility ได้: Private / Share-by-code / **Public**.
> Public = โผล่ใน section "PUBLIC PROGRAMS" ให้ทุกคนเห็น+import. ใช้ตาราง `shared_programs` เดิม
> + คอลัมน์ `is_public`. (select policy เดิม `to authenticated using(true)` อ่าน public list ได้อยู่แล้ว)

```sql
alter table public.shared_programs add column if not exists is_public boolean not null default false;
```

## 2h. BMR/TDEE bio + coach dashboard reads (2026-06-24)

> (1) เก็บ `bio` (เพศ/ส่วนสูง/วันเกิด/activity) + `personal_one_rms` ใน program_state row เดิม
> (sync cross-device) (2) ให้โค้ชอ่าน body_metrics + bio/1RM ของลูกศิษย์ active เพื่อโชว์ใน dashboard

```sql
-- 1) เพิ่มคอลัมน์ user settings ใน program_state (sync พร้อม progress)
alter table public.program_state add column if not exists bio jsonb not null default '{}';
alter table public.program_state add column if not exists personal_one_rms jsonb;

-- 2) โค้ชอ่าน body_metrics + program_state (bio/1RM) ของลูกศิษย์ active
create policy "coach reads athlete body metrics" on public.body_metrics for select using (
  user_id in (select athlete_id from public.coach_athlete
              where coach_id = auth.uid() and status = 'active'));
create policy "coach reads athlete program state" on public.program_state for select using (
  user_id in (select athlete_id from public.coach_athlete
              where coach_id = auth.uid() and status = 'active'));
```

> หมายเหตุ: ไม่ต้อง redeploy edge function — ทั้งหมดผ่าน RLS ตรง ๆ

## 2i. Web Push (Phase 5 Part A) — push_subscriptions + reminder opt-in (2026-06-26)

> เก็บ Web Push subscription ต่อ device + flag เปิด/ปิด reminder ใน program_state

```sql
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,        -- 1 row ต่อ browser/device endpoint
  subscription jsonb not null,          -- PushSubscription.toJSON() เต็ม
  user_agent text,
  created_at timestamptz default now()
);
alter table public.push_subscriptions enable row level security;
create policy "own push subs" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index push_subscriptions_user_idx on public.push_subscriptions(user_id);

alter table public.program_state add column if not exists reminder_opt_in boolean not null default false;
```

### Deploy Edge Functions `send-push` (+ redeploy `coach`)

1. ตั้ง secret (private VAPID key — อยู่ในไฟล์ `vapid-secret.local` ที่ generate ไว้, gitignored):
   ```
   supabase secrets set VAPID_JSON='<เนื้อหาใน vapid-secret.local>'
   supabase secrets set CRON_SECRET='<สุ่มสตริงยาว ๆ>'
   ```
   (`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` Supabase inject ให้อัตโนมัติ)
2. Deploy:
   ```
   supabase functions deploy send-push
   supabase functions deploy coach     # redeploy: เพิ่มยิง push ตอนมี coach event
   ```
3. เพิ่ม `VITE_VAPID_PUBLIC_KEY` (public key จาก `apps/web/.env.local`) ใน Vercel env ด้วย

> Part B (เตือนวันซ้อม scheduled) = อีก function `send-reminders` + Supabase Cron — ทำรอบถัดไป

### Deploy Edge Function `coach`

เหมือน `admin-users` — Supabase inject `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` ให้อัตโนมัติ
(ไม่ต้องตั้ง secret เพิ่ม). Deploy ผ่าน Dashboard (Edge Functions → New function → วางโค้ดจาก
`supabase/functions/coach/index.ts`) หรือ CLI:

```
supabase functions deploy coach
```

## 2j. Exercises Library dataset (Phase 6 / รอบ 17) — 1,324 ท่า + GIF (2026-07-01)

> ขยาย Library เป็น 1,324 ท่าจาก ExerciseDB (`hasaneyldrm/exercises-dataset`) เก็บใน cloud,
> ทุกคน (authenticated) อ่านได้ (read-only, ไม่มี write policy). 19 ท่า builtin เดิมยังอยู่ local
> ใน `data.ts` (ไม่ต้อง seed ซ้ำ) → ตารางนี้เก็บเฉพาะ 1,324 ท่า namespace `db-<id>` กันชน ID เดิม.
> Media (GIF) ไม่เก็บในตาราง — เก็บ `gif_path` = ExerciseDB `media_id` แล้วประกอบ URL
> `static.exercisedb.dev/media/{gif_path}.gif` ฝั่ง client (`exerciseGifUrl()`). License: non-commercial.

**ขั้นที่ 1 — สร้างตาราง + RLS (SQL Editor):**

```sql
create table public.exercises (
  id text primary key,
  name text not null,
  muscle_group text not null,
  equipment text,
  target text,
  secondary_muscles text[],
  instructions text[],
  gif_path text,
  created_at timestamptz default now()
);
alter table public.exercises enable row level security;
create policy "authed read exercises" on public.exercises
  for select to authenticated using (true);
```

**ขั้นที่ 2 — seed 1,324 แถว (paste ทีละไฟล์):** เปิดไฟล์ `supabase/seed/exercises.seed.part01.sql`
… ถึง `part14.sql` (auto-gen จาก `scripts/build-exercises.mjs`, ~62KB/ไฟล์ = 100 แถว) → paste
**ทีละไฟล์** ใน SQL Editor แล้ว Run จนครบ 14 ไฟล์ (`on conflict do nothing` → รันซ้ำได้)

> ⚠️ **อย่า paste ไฟล์รวม `exercises.seed.sql` (818KB) รวดเดียว** — SQL Editor มีลิมิตความยาว paste
> (~120KB) → ตัด string กลางแถว → error `relation "…" does not exist`. ไฟล์ part ทำมาเล็กกว่าลิมิต
> (แต่ละไฟล์รันเดี่ยวได้). ถ้าถนัด `psql`/CLI จะรันไฟล์รวมทีเดียวก็ได้

**ขั้นที่ 3 — verify:**

```sql
select count(*) from public.exercises;                -- = 1324
select muscle_group, count(*) from public.exercises group by 1 order by 2 desc;
```

> ถ้าต้อง re-gen seed หลัง dataset อัปเดต: clone `hasaneyldrm/exercises-dataset` แล้ว
> `node scripts/build-exercises.mjs <path/to/data/exercises.json>` → commit ไฟล์ seed ใหม่

## 3. Get API Keys

ไปที่ **Settings → API**:
- `Project URL` → `VITE_SUPABASE_URL`
- `anon public` key → `VITE_SUPABASE_ANON_KEY`

## 4. Add to Vercel

ไปที่ Vercel project → **Settings → Environment Variables** แล้วเพิ่ม:

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` |
| `VITE_VAPID_PUBLIC_KEY` | `B...` (Web Push public key — จาก `apps/web/.env.local`) |

จากนั้น **Redeploy** เพื่อให้ค่าใหม่มีผล

## 5. Local Dev

สร้างไฟล์ `apps/web/.env.local`:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

ไฟล์นี้อยู่ใน `.gitignore` แล้ว ไม่ต้องกังวล
