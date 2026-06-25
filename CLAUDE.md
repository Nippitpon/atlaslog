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

**Sheet 1 — `Program`** (one row per exercise entry):

| Column | Type | Required | Example |
|--------|------|----------|---------|
| `week` | number | ✅ | `1` |
| `phase` | string | ✅ | `Accumulation` |
| `day_of_week` | Mon/Tue/Wed/Thu/Fri/Sat | ✅ | `Mon` |
| `focus` | string | ✅ | `Squat Focus` |
| `exercise_name` | string | ✅ | `Back Squat` |
| `exercise_id` | string | ✅ | `squat` |
| `type` | main/accessory | ✅ | `main` |
| `sets` | number | ✅ | `1` |
| `reps` | number or `AMRAP` | ✅ | `5` |
| `pct` | number 0–1 | optional | `0.75` |
| `rpe` | number 6–10 | optional | `7` |
| `note` | string | optional | `เน้น bar path` |

**Sheet 2 — `Meta`**:

| Column | Example |
|--------|---------|
| `name` | My 8 Week Program |
| `description` | สำหรับ intermediate lifter |
| `focus` | Squat · Bench · Deadlift |
| `program_type` *(optional)* | `powerlifting` (default) หรือ `general` (ไม่คำนวณน้ำหนัก) |

### Import UI Flow

```
ProgramsPage → [+ Import from Excel]
  → file picker (.xlsx / .xls only)
  → SheetJS parse → validate (error shows row number)
  → preview modal (week/day summary table)
  → ProgramSetupSheet (start date + 3× 1RM)
  → save to useProgramStore.customPrograms
  → redirect to ProgramOverviewPage
```

---

## Core TypeScript Interfaces

All in `packages/shared/src/types.ts`:

```
StructuredExercise  → exerciseId, name, type, sets, reps, pct?, rpe?, note?
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

> หมายเหตุ: "Phase 4" เดิมรวม push notifications ไว้ด้วย แต่ push ถูกแยกเป็น Phase 5 (ROI ต่ำ:
> iOS ต้องติดตั้ง PWA ก่อน + free tier ไม่มี cron). Phase 4 ใช้ in-app reminder แทน (ฟรี)
