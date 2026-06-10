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
