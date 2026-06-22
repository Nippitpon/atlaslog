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

### Deploy Edge Function `coach`

เหมือน `admin-users` — Supabase inject `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` ให้อัตโนมัติ
(ไม่ต้องตั้ง secret เพิ่ม). Deploy ผ่าน Dashboard (Edge Functions → New function → วางโค้ดจาก
`supabase/functions/coach/index.ts`) หรือ CLI:

```
supabase functions deploy coach
```

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

จากนั้น **Redeploy** เพื่อให้ค่าใหม่มีผล

## 5. Local Dev

สร้างไฟล์ `apps/web/.env.local`:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

ไฟล์นี้อยู่ใน `.gitignore` แล้ว ไม่ต้องกังวล
