# Atlaslog — Developer Guide

## Project Overview

Mobile-first powerlifting tracker. Track workouts, run structured periodized programs,
and calculate working weights from 1RM + RPE. Built as a pnpm monorepo.

Target users: powerlifting athletes and coaches who want to track SBD training.

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React 19, TypeScript 6, Vite 8 | |
| Routing | React Router v7 | |
| State | Zustand 5 + localStorage persist | keys: `atlas:v1`, `atlas:v1:program-progress` |
| Data fetching | TanStack Query 5 | wired up when API exists |
| Excel import | SheetJS (`xlsx`) | parse .xlsx in-browser, MIT license |
| Styling | CSS custom properties + inline styles | theme via CSS vars |
| Icons | Lucide React | |
| Hosting | Vercel (Hobby free tier) | auto-deploy from GitHub |
| Backend *(Phase 3)* | Supabase | PostgreSQL + Auth, free tier |

---

## Monorepo Structure

```
apps/web/          → Main React application
packages/shared/   → Shared TypeScript types (StructuredProgram, Session, etc.)
```

Build tool: pnpm workspaces. Root `package.json` orchestrates both packages.

---

## Key Files

```
apps/web/src/
  main.tsx                          → React entry point
  router.tsx                        → React Router v7 config (all routes)
  lib/
    twelveWeekProgram.ts            → Built-in 12-week SBD periodized program
    rpeTable.ts                     → RPE → % of 1RM conversion table (Tuchscherer)
    excelImport.ts                  → Excel (.xlsx) → StructuredProgram parser
    data.ts                         → Exercise seed data (23 exercises)
    utils.ts                        → Volume calc, date format, color helpers
  store/
    useProgramStore.ts              → Program progress, ProgramConfig (1RMs + dates), custom programs
    useAppStore.ts                  → Theme, workout history, active workout state
  features/
    programs/
      ProgramsPage.tsx              → Program library + Import from Excel button
      ImportProgramSheet.tsx        → File upload → validate → preview → setup flow
      ProgramSetupSheet.tsx         → Enter Start Date + Squat/Bench/Deadlift 1RM
    logger/LoggerPage.tsx           → Active workout set-by-set recording
    dashboard/DashboardPage.tsx     → Weekly stats, SBD total, quick start
    history/HistoryPage.tsx         → Completed session list
    library/LibraryPage.tsx         → Exercise database
    profile/ProfilePage.tsx         → User settings

packages/shared/src/
  types.ts                          → All TypeScript interfaces (source of truth)
```

---

## Data Flow

```
1. User imports Excel OR selects built-in program
2. ProgramSetupSheet: enter Start Date + Squat 1RM / Bench 1RM / Deadlift 1RM
   → stored in useProgramStore as ProgramConfig
3. Logger: working weight = config.oneRMs[exerciseId] × exercise.pct
4. Finish workout → session saved to useAppStore history
5. (Phase 3) history + programs sync to Supabase on write
```

---

## Excel Import Feature

### Template Format

`excelImport.ts` normalizes headers (case-insensitive alias map) and accepts **two column vocabularies
in one parser** — full details + coach guide in `docs/excel-import-guide.md`.

**Hybrid/Coach format** — single sheet `Template` (or first sheet with recognizable headers):

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `Week` | int ≥ 1 | ✅ | |
| `Day` | Mon–Sat | ✅ | also full names + Thai (`จันทร์`) |
| `Lift` | string | ✅ | `Squat`/`Bench`/`Deadlift` → mapped to `squat`/`bench`/`deadlift` for 1RM calc |
| `Sets` | int 1–50 | ✅ | |
| `Reps` | int ≥ 1 or `AMRAP` | ✅ | |
| `Phase` | string | opt | `Accum*`/`Intens*`/`Peak*`/`Taper*`/`Test*` → mapped; `Taper/Test`→`Taper` |
| `Variant`+`Prescription` | string | opt | joined into `StructuredExercise.label` (e.g. "Competition · Top set") |
| `PCT` | 0–1.1 | opt | attempts may exceed 100% |
| `RPE` | number | opt | non-numeric (e.g. `<6.0`) preserved into `note` |
| `Type` | Work/Test/accessory | opt | Work/Test/blank → `main` |
| `Notes` | string | opt | |
| `Target Weight (kg)` | — | — | **ignored** — app recomputes from user 1RM |

**Legacy format** (still supported) — sheet `Program` + optional `Meta`: lowercase
`week/phase/day_of_week/focus/exercise_name/exercise_id/type/sets/reps/pct/rpe/note`.

**Program name:** `Meta.name` if present, else derived from the **file name**, editable in Setup step.
`Meta` sheet is optional; `program_type` `powerlifting` (default) / `general`.

**Key invariants:** every imported row gets a stable per-row `id` (`w{week}-{Day}-e{idx}`) so a Top set +
Back-off of the same lift never collide on the weight-override key. `label` is threaded through
`ProgramExercise`/`WorkoutExercise` and shown in WeekDays / LoggerPage / FinishReview.

### Import UI Flow

```
ProgramsPage → [Import from Excel]
  → file picker (.xlsx / .xls only)
  → SheetJS parse → normalize headers → validate (error shows row number)
  → preview (week summary + first-day sample with labels)
  → ProgramSetupSheet (editable name + start date + 3× 1RM)
  → save to useProgramStore.customPrograms
  → redirect to ProgramOverviewPage
```

---

## Core TypeScript Interfaces

All in `packages/shared/src/types.ts`:

```
StructuredExercise  → exerciseId, name, label?, type, sets, reps, pct?, rpe?, note?
StructuredDay       → id, dayOfWeek, focus, exercises[]
StructuredWeek      → id, weekNumber, phase, days[]
StructuredProgram   → id, name, description, totalWeeks, daysPerWeek, focus, weeks[], isCustom?, source?
ProgramConfig       → startDate, endDate, oneRMs: { squat, bench, deadlift }
Session             → completed workout record (date, volume, duration, sets)
```

---

## Dev Commands

```bash
pnpm dev          # start dev server → http://localhost:5173
pnpm build        # production build (check TypeScript errors)
pnpm lint         # ESLint
```

---

## Coding Conventions

- No comments unless the WHY is non-obvious
- All new types go in `packages/shared/src/types.ts`
- Mobile-first: design and test at 390px viewport width
- No backend calls in Phase 1–2 — all state lives in Zustand + localStorage
- New exercises must be added to `apps/web/src/lib/data.ts` EXERCISES array
- Program `id` must be unique: built-ins use `sbd-12w`, custom imports use `custom-<timestamp>`

---

## Deployment (Vercel)

1. Push repo to GitHub
2. Import project on vercel.com → select `apps/web` as root directory
3. Build command: `pnpm build`
4. Output directory: `dist`
5. Every push to `main` auto-deploys; every PR gets a preview URL

---

## Phase Roadmap

| Phase | Work | Backend needed |
|-------|------|----------------|
| 1 | Fix App.tsx router, Dashboard stats, Logger flow, History display | No |
| 2 | Excel import feature (xlsx + ImportProgramSheet) | No |
| 3 | Supabase Auth + cloud sync for history and custom programs | Yes |
| 3.5 | Admin-confirms-users (signup approval gate) — done | Yes |
| 4 | Social: coach-athlete + program sharing + in-app reminder | Yes |
| 5 | Push notifications (Web Push / VAPID) — deferred | Yes |
| 6 | EXERCISES Library dataset migration (1,324 ท่า + GIF) — planned | Yes |

---

## Phase 6 — EXERCISES Library Dataset Migration (planned)

ขยาย Library จาก 23 ท่า (hardcode ใน `data.ts`) → ฐานข้อมูลจริง 1,324 ท่า จาก
`hasaneyldrm/exercises-dataset` (ต้นฉบับ ExerciseDB v1) พร้อม GIF สาธิต + คำอธิบายทีละขั้น

**การตัดสินใจที่ยืนยันแล้ว**
- Storage: ตาราง Supabase `exercises` + ดึงผ่าน TanStack Query (ไม่ bundle ใน JS); 23 ท่าเดิมเป็น local fallback
- Fields: ขยาย `Exercise` type เพิ่ม `target`, `secondaryMuscles`, `instructions` (en), `gifPath` (optional ทั้งหมด)
- Media: ExerciseDB CDN ตรง (`static.exercisedb.dev/media/{id}.gif`) — เก็บ path relative, ประกอบ URL ด้วย `exerciseGifUrl()` จุดเดียว
- License: non-commercial เท่านั้น → ใส่ attribution + ห้ามนำไปใช้เชิงพาณิชย์

**ข้อห้าม / ข้อควรระวัง**
- ⚠️ ห้ามเปลี่ยน ID ของ 23 ท่าเดิม (`squat`/`bench`/`deadlift` ฯลฯ) — programs, `SBD_IDS`, history ผูกอยู่
  → dataset ใช้ namespace `db-<id>` กันชน
- กลุ่มกล้ามเนื้อ dataset (`waist`/`upper arms`/`lower legs`/`neck`/`cardio` ฯลฯ) ต้อง map → `Chest/Back/Legs/Shoulders/Arms/Core/Other` (เพิ่มกลุ่ม `Other`)
- equipment dataset เป็น lowercase → normalize เป็น Title Case ให้ตรง `EQUIPMENT_OPTIONS`
- ไม่มีภาษาไทย → ใช้ instructions ภาษา en

**ขั้นตอน**
- A. ETL: `scripts/build-exercises.mjs` แปลง `data/exercises.json` → `exercises.seed.json` (map group/equipment, เก็บ `instruction_steps.en`, ตัดภาษาอื่น/created_at)
- B. DB: migration `supabase/migrations/<ts>_exercises.sql` — ตาราง `exercises` (id, name, muscle_group, equipment, target, secondary_muscles[], instructions[], gif_path, is_builtin) + RLS `select to authenticated using (true)`; seed 23 builtin + 1,324
- C. Types/data: ขยาย `Exercise` ใน `packages/shared/src/types.ts`; เพิ่ม `exerciseGifUrl()` + hook `useExercises()` (TanStack Query, fallback local 23); ปรับ `getExercise`/registry
- D. UI: `LibraryPage` แสดง GIF thumbnail + pagination/virtualized + กลุ่ม `Other` + detail page (GIF ใหญ่ + steps); SwapSheet/AccessoryEditSheet/CreateProgramPage ใช้ชุดเต็ม; ใส่ attribution

> รายละเอียดเต็ม + checklist verify อยู่ใน log.md (รอบ 17 — planned)

> หมายเหตุ: "Phase 4" เดิมรวม push notifications ไว้ด้วย แต่ push ถูกแยกเป็น Phase 5 (ROI ต่ำ:
> iOS ต้องติดตั้ง PWA ก่อน + free tier ไม่มี cron). Phase 4 ใช้ in-app reminder แทน (ฟรี)
