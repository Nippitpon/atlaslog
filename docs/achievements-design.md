# Achievements, Milestones & EXP — Design (draft)

> สถานะ: **ออกแบบ ยังไม่ลงมือ** · ต่อยอดจาก `log.md` รอบ 75 (Gamification PLANNED) + `DESIGN.md` §6 (Athlete Tier, 4 EXP Pillars, Tier Roadmap)
> ตัวเลขทั้งหมดเป็นค่าตั้งต้น ปรับได้ — ค่าที่ต้องยืนยันก่อนลงมืออยู่ท้ายไฟล์

## 1. หลักการ

1. **คำนวณจากข้อมูลที่มีอยู่แล้วเท่านั้น** — `Session[]`, `RunEntry[]`, `OneRMEntry[]`, `BodyMetricEntry[]`, program `progress` · ไม่ต้องให้ผู้ใช้กรอกอะไรเพิ่ม · ไม่ต้องมีตารางใหม่ใน Supabase (v1)
2. **ไม่เก็บ EXP/achievement** — derive on the fly แบบ e1RM (`buildLiftSeries`) → แก้/ลบ session แล้วตัวเลขถูกเสมอ ไม่มีบั๊ก sync · เก็บแค่ "รายการที่ผู้ใช้เห็นแล้ว" ไว้แสดง toast ตอนปลดล็อกใหม่
3. **1 Level รวม** ของผู้ใช้ — ทั้ง 3 หมวดให้ EXP เข้ากระเป๋าเดียว · แต่ละหมวดมีความคืบหน้าของตัวเอง (x/y achievements)
4. **นับเฉพาะของจริง** — session ต้องมี ≥ 1 set ที่ `done` · run ต้อง `distanceKm > 0` · มี cap ต่อวัน/สัปดาห์กัน farm
5. **ทุกคนเห็นทั้ง 3 หมวด แต่ Powerlifting / Hybrid ล็อกไว้จนกว่าจะผ่านเงื่อนไข** (ดู §1.1) — หมวดที่ล็อกแสดงเป็น "เป้าหมายถัดไป" พร้อมบอกวิธีปลดล็อก
6. **ข้อยกเว้นเดียวของ "derive ล้วน"** คือการปลดล็อกหมวด ต้องจดไว้ถาวร (เหตุผลใน §1.1)

### 1.1 เงื่อนไขปลดล็อกหมวด

**Program tag** — แอปติดให้อัตโนมัติจาก `programType` (ที่ผู้สร้างเลือก) + เนื้อหาโปรแกรม ไม่มีช่องให้เลือก tag เอง · ไม่ต้องเพิ่ม field/คอลัมน์ใหม่

| `programType` | มีวันวิ่ง (`type: 'running'`) + วันยก | Tag |
|---|---|---|
| Powerlifting (หรือไม่ระบุ = built-in) + มีท่า SBD | ไม่มี | **POWERLIFTING** |
| Powerlifting + มีท่า SBD | มี | **POWERLIFTING + HYBRID** |
| General | มี | **HYBRID** |
| General | ไม่มี | **FITNESS** |

- "มีวิ่ง" = มี**อย่างน้อย 1 สัปดาห์**ที่มีทั้งแถว running และแถวยกน้ำหนัก (ไม่ใช่ running) — อยู่วันเดียวกันหรือคนละวันในสัปดาห์นั้นก็ได้ · โปรแกรมวิ่งล้วน หรือยกกับวิ่งแยกกันคนละสัปดาห์ (ไม่มีสัปดาห์ไหนมีครบทั้งคู่) → ไม่ใช่ hybrid
- **POWERLIFTING ต้องมีท่า SBD จริง** — `programType` = powerlifting **และ** มีแถวที่ `exerciseId` อยู่ใน `SBD_IDS` (`lib/rpeTable.ts`: `squat` / `bench` / `deadlift`) อย่างน้อย 1 ท่า · ถ้า programType = powerlifting แต่ไม่มีท่า SBD → ตัดสินเหมือน General (FITNESS หรือ HYBRID)
  - ท่าแปรผัน (Pause / Tempo / Pin / Sumo / Competition ฯลฯ) ใน Excel ใส่ในคอลัมน์ `Variant` → `exerciseId` ยังเป็น squat/bench/deadlift จึงนับ
  - ท่าจาก dataset (`db-*` เช่น barbell full squat, front squat) **ไม่นับ** — ไม่ได้คำนวณจาก 1RM ของแอป
  - ✅ ตัดสินแล้ว (2026-11-13): ใช้ `SBD_IDS` เดิม 3 ท่า ไม่เพิ่ม `db-0117` barbell sumo deadlift · Sumo ในหน้า Create/Edit ให้เลือก `Deadlift` + ใส่ label "Sumo" (Excel `Sumo Deadlift` ถูก map เป็น `deadlift` อยู่แล้ว) · มี SBD ≥ 1 ท่าก็พอ (Bench-only นับ)
- แสดงเป็น badge ใน Programs / Program Overview / หน้า Coach (แทน `GENERAL` / `POWERLIFTING` เดิม) + ใช้กรองในคลังโปรแกรมได้

| หมวด achievement | ปลดล็อกเมื่อ |
|---|---|
| **Fitness Tracking** | ตั้งแต่แรก ไม่ต้องปลดล็อก (โปรแกรม tag FITNESS ไม่ได้ปลดหมวดอะไรเพิ่ม) |
| **Powerlifting** | จบโปรแกรมที่มี tag **POWERLIFTING** ≥ 1 โปรแกรม |
| **Hybrid** | จบโปรแกรมที่มี tag **HYBRID** ≥ 1 โปรแกรม |

- **"จบ"** = `isProgramComplete` (`lib/programStatus.ts`) ตามที่แอปนับอยู่แล้ว — วันที่ **skip ก็นับ** (ตัดสินใจแล้ว ไม่ตั้งเกณฑ์ done % เพิ่ม)
- **Routine ประจำสัปดาห์ (`program.weekly`) ไม่นับ** — `finishedAt` ของมันคือการกดจบเอง ไม่ใช่การซ้อมจนครบโปรแกรม
- **โปรแกรมเดียวปลดได้ 2 หมวดพร้อมกัน** เช่น Hybrid Powerlifting Sumo มีทั้ง SBD และวันวิ่ง
- **ปลดแล้วถาวร** — `restartProgram` และ `removeCustomProgram` ลบ `progress[programId]` ทิ้ง (`store/useProgramStore.ts`) ถ้าคำนวณสดอย่างเดียว กด Restart แล้วหมวดจะกลับไปล็อก จึงจดไว้ใน
  `programCompletions: { programId, name, kinds: ('pl' | 'hybrid')[], completedAt }[]` (append-only)
  - บันทึกตอน `setDayStatus` ทำให้ `isProgramComplete` เปลี่ยนจาก false → true
  - **backfill** ตอนโหลดแอป: โปรแกรมที่จบอยู่แล้ววันเปิดฟีเจอร์ → จดให้ทันที (ผู้ใช้เก่าปลดล็อกเลย)
  - Restart / ลบโปรแกรม **ไม่ลบ** รายการนี้ · จบโปรแกรมเดิมซ้ำหลัง Restart = จดเพิ่มอีกแถว (ซ้อมจริงอีกรอบ)
  - sync ลง `program_state` คอลัมน์ jsonb ใหม่ `program_completions` (ใช้ `program_meta` ไม่ได้ เพราะผูกกับ programId และถูกลบตามโปรแกรม)
- **ได้ย้อนหลังทั้งหมด** (ตัดสินใจแล้ว) — achievement ของหมวดที่ล็อกยังคำนวณเบื้องหลัง พอปลดล็อกได้ทุกขั้นที่ทำถึงแล้วทันที + toast รวมอันเดียว เช่น "🔓 ปลดล็อกหมวด Powerlifting · ได้ 4 achievements +1,350 EXP"
- **EXP จากการซ้อม (§6 ก) ไม่ถูกล็อก** — ที่ล็อกคือ EXP จาก achievement (§6 ข) ของหมวดนั้นเท่านั้น ไม่นับเข้า Level จนกว่าจะปลด

## 2. ระดับของ Achievement

| ระดับ | สี (ตาม DESIGN.md) | EXP เมื่อปลดล็อก |
|------|------|------|
| Bronze | ทองแดง | 100 |
| Silver | เงิน | 250 |
| Gold | ทอง | 500 |
| Platinum | crimson glow `#ff2d55` | 1,000 |
| Special (ครั้งเดียว) | crimson | 300 |

Achievement แบบขั้นบันได (ladder) ใช้ id รูปแบบ `<หมวด>.<ชื่อ>.<ขั้น>` เช่น `fit.sessions.50` — ปลดทีละขั้น แต่ละขั้นได้ EXP ของระดับนั้น

## 3. หมวด 1 — Fitness Tracking (คนทั่วไป)

เน้น "มาสม่ำเสมอ" มากกว่าความหนัก

| Achievement | เงื่อนไข | ขั้น (Bronze / Silver / Gold / Platinum) | ข้อมูลที่ใช้ |
|---|---|---|---|
| **First Step** | จบ workout แรก | Special | `Session` |
| **Showing Up** | จำนวน workout (ยก + วิ่ง) | 10 / 50 / 150 / 365 | `Session` + `RunEntry` |
| **Weekly Habit** | สัปดาห์ติดกันที่ซ้อม ≥ 3 ครั้ง | 4 / 12 / 26 / 52 สัปดาห์ | วันที่ของ session + run (สัปดาห์ จันทร์ → อาทิตย์ ตาม `startOfTrainingWeek`) |
| **Time Under Iron** | เวลาซ้อมรวม | 10 / 50 / 150 / 500 ชม. | `Session.duration` + `RunEntry.durationMin` |
| **Heavy Mover** | น้ำหนักยกรวม (tonnage) | 10 / 100 / 500 / 2,000 ตัน | `Session.volume` |
| **Full Body Week** | ใน 1 สัปดาห์ฝึกครบ 6 กลุ่ม (Chest/Back/Legs/Shoulders/Arms/Core) | 1 / 4 / 12 / 26 สัปดาห์ | `exercises[].exerciseId` → กลุ่มกล้ามเนื้อจาก `getExercise()` |
| **Know Yourself** | บันทึกน้ำหนักตัว (สัปดาห์ที่มีการชั่ง) | 1 / 4 / 12 / 52 สัปดาห์ | `BodyMetricEntry` |
| **Composition Check** | บันทึก % ไขมัน หรือมวลกล้ามเนื้อครั้งแรก | Special | `BodyMetricEntry.bodyFatPct` / `skeletalMuscleKg` |
| **Comeback** | กลับมาซ้อมหลังหายไป ≥ 21 วัน | Special | ช่องว่างระหว่าง session |
| **Early Bird** | ซ้อมก่อน 07:00 | 1 / 10 / 30 / 100 ครั้ง | เวลาใน `Session.date` / `RunEntry.date` |

## 4. หมวด 2 — Powerlifting

เน้นความแข็งแรงของ Squat / Bench / Deadlift และการทำตามโปรแกรม

| Achievement | เงื่อนไข | ขั้น | ข้อมูลที่ใช้ |
|---|---|---|---|
| **Tested** | บันทึก 1RM test ครั้งแรก | Special | `OneRMEntry` |
| **Plate Club — Squat** | 1RM Squat | 100 / 140 / 180 / 220 kg | 1RM ล่าสุดต่อท่า (ค่าสูงสุดใน `oneRMHistory`) |
| **Plate Club — Bench** | 1RM Bench | 60 / 100 / 140 / 180 kg | เหมือนข้างบน |
| **Plate Club — Deadlift** | 1RM Deadlift | 140 / 180 / 220 / 260 kg | เหมือนข้างบน |
| **The Total** | SBD Total (ผลรวม 1RM ดีที่สุดสามท่า) | 300 / 450 / 600 / 750 kg | `oneRMHistory` |
| **Relative Strength** | Total ÷ น้ำหนักตัว | 4× / 5× / 6× / 7× | `oneRMHistory` + น้ำหนักตัวที่ใกล้วันที่ทดสอบที่สุด (ต้องเคยชั่ง) |
| **PR Hunter** | จำนวน PR (e1RM ใหม่สูงสุดของท่านั้น) | 1 / 10 / 25 / 50 | `buildLiftSeries` (นับได้สูงสุด 1 PR ต่อท่าต่อสัปดาห์) |
| **Program Finisher** | จบโปรแกรม periodized (ทุกวัน done/skipped) | 1 / 3 / 6 / 12 โปรแกรม | `programCompletions` ที่มี `'pl'` (§1.1) · Bronze = รางวัลของการปลดหมวด |
| **Iron Discipline** | จบโปรแกรมโดย skip ≤ 10% ของวัน | 1 / 3 / 6 / 12 | `progress` (`done` vs `skipped`) |
| **Peak Week** | ทำครบทุกวันของสัปดาห์ Peaking / Taper | 1 / 3 / 6 / 12 | `week.phase` + `progress` |
| **Competition Reps** | จำนวน rep ของท่าหลัก (`isMain`) ที่ done | 1,000 / 5,000 / 15,000 / 40,000 | `exercises[].sets` |
| **Self-Aware** | set ที่บันทึก RPE จริง | 50 / 250 / 1,000 / 3,000 | `WorkoutSet.rpe` (ไม่นับค่า prefill — แอปไม่ prefill อยู่แล้ว) |

> ⚠️ PR จาก row ที่สั่งด้วย RPE: ถ้าผู้ใช้บันทึก `rpe === targetRpe` e1RM จะเท่า 1RM ที่ตั้งไว้พอดี (ดู CLAUDE.md) → ไม่เกิด PR ปลอม แต่ PR จะมาช้ากว่า row ที่สั่งด้วย % — ยอมรับได้

## 5. หมวด 3 — Hybrid Training

เน้นการเป็นทั้งคนแรงและคนอึด

| Achievement | เงื่อนไข | ขั้น | ข้อมูลที่ใช้ |
|---|---|---|---|
| **First Run** | บันทึกการวิ่งครั้งแรก | Special | `RunEntry` |
| **Mileage** | ระยะวิ่งรวม | 25 / 100 / 500 / 1,500 km | `RunEntry.distanceKm` |
| **Distance Badge** | วิ่งครั้งเดียวได้ระยะ | 5K / 10K / Half 21.1 / Full 42.2 | `RunEntry.distanceKm` |
| **Pace Setter** | วิ่ง ≥ 5 km ด้วย pace เฉลี่ย ≤ | 6:00 / 5:30 / 5:00 / 4:30 นาที/km | `durationMin ÷ distanceKm` |
| **Double Day** | ยก + วิ่งในวันเดียวกัน | 1 / 10 / 30 / 100 วัน | วันที่ของ session + run |
| **Hybrid Week** | สัปดาห์ติดกันที่ยก ≥ 2 + วิ่ง ≥ 2 | 2 / 8 / 16 / 32 สัปดาห์ | session + run รายสัปดาห์ |
| **Balanced Month** | ในเดือนเดียว ยก ≥ 8 ครั้ง และวิ่ง ≥ 40 km | 1 / 3 / 6 / 12 เดือน | session + run รายเดือน |
| **Strong & Fast** | Total ≥ 4× น้ำหนักตัว **และ** มี 5K ≤ 25:00 ภายใน 90 วันเดียวกัน | Special (Platinum glow) | `oneRMHistory` + body + run |
| **1000 lb + 10K** | Total ≥ 453.6 kg **และ** เคยวิ่ง 10K | Special | `oneRMHistory` + run |
| **Hybrid Plan Done** | จบโปรแกรมที่มีทั้งวันยกและวันวิ่ง | 1 / 3 / 6 / 12 | `programCompletions` ที่มี `'hybrid'` (§1.1) · Bronze = รางวัลของการปลดหมวด |

## 6. EXP — แหล่งที่มา

EXP มาจาก 2 ทาง: **(ก) ทุกการซ้อม** (ได้ทุกครั้ง มี cap) และ **(ข) ปลดล็อก achievement** (ครั้งเดียวต่อขั้น)

### (ก) EXP จากการซ้อม

| การกระทำ | EXP | Cap | Pillar (DESIGN §6.2) |
|---|---|---|---|
| จบ session ยก (≥ 1 set done) | 40 + 2 × set ที่ done | สูงสุด 100 / session | Volume & Effort |
| วิ่ง | 30 + 10 × km | สูงสุด 150 / run | Volume & Effort |
| ทำวันในโปรแกรมครบ (`done`) | +20 | — | Consistency |
| ทำครบทุกวันของสัปดาห์ในโปรแกรม | +100 | — | Consistency |
| จบโปรแกรม | +500 | — | Mastery & PRs |
| PR ใหม่ (e1RM หรือ 1RM test) | +100 | 1 ครั้ง/ท่า/สัปดาห์ | Mastery & PRs |
| สัปดาห์ active (ซ้อม ≥ 3 ครั้ง) ต่อเนื่อง | +25 × จำนวนสัปดาห์ต่อเนื่อง | สูงสุด +250/สัปดาห์ | Consistency |
| ฝึกกลุ่มกล้ามเนื้อใหม่ที่ยังไม่ได้ฝึกในสัปดาห์นั้น | +10 / กลุ่ม | สูงสุด +60/สัปดาห์ | Diversity |
| ชั่งน้ำหนักตัว | +10 | 1 ครั้ง/สัปดาห์ | Consistency |

- **Cap รวมต่อวัน (เฉพาะ ก):** 400 EXP — กันการบันทึก session ซ้ำ ๆ ในวันเดียว
- ผู้ใช้ที่ซ้อมปกติ (ยก 4 + วิ่ง 1 / สัปดาห์ ตามโปรแกรม) ได้ประมาณ **600–800 EXP/สัปดาห์**

### (ข) EXP จาก achievement — ตามตารางระดับในข้อ 2

## 7. Level & Tier

**EXP ที่ต้องใช้จาก Level L → L+1 = 200 + 50 × (L − 1)**
(Lv1→2 = 200 · Lv10→11 = 650 · Lv50→51 = 2,650) · Level สูงสุด 99

| Level | EXP สะสม | ใช้เวลาโดยประมาณ (~700 EXP/สัปดาห์ + achievements) |
|---|---|---|
| 5 | 1,100 | ~1–2 สัปดาห์ |
| 10 | 3,600 | ~1 เดือน |
| 20 | 12,350 | ~4 เดือน |
| 35 | 34,850 | ~10 เดือน |
| 50 | 68,600 | ~1.8 ปี |
| 75 | 149,850 | ~4 ปี |
| 99 | 257,250 | ระยะยาวมาก (สำหรับสายจริงจัง) |

**Tier (ช่วงของ Level — ใช้กับ Tier Roadmap ใน DESIGN.md §6.3):**

| Tier | Level | ความหมาย |
|---|---|---|
| Rookie | 1–9 | เพิ่งเริ่ม สร้างนิสัย |
| Iron | 10–19 | มาสม่ำเสมอแล้ว |
| Steel | 20–34 | ซ้อมจริงจังต่อเนื่อง |
| Ironforged | 35–49 | ผ่านหลาย cycle |
| Titan | 50–74 | ระดับนักกีฬา |
| Legend | 75–99 | ระยะยาวหลายปี |

## 8. หน้าจอ (แนวทาง)

- **Dashboard (hero card):** วงกลม avatar + `LV. 28` + ชื่อ Tier + EXP bar (DESIGN §6.1) · กดเข้าไปหน้า Achievements
- **หน้า `/achievements` ใหม่:** 3 แท็บ Fitness / Powerlifting / Hybrid · แต่ละ achievement แสดงขั้นที่ได้แล้ว + progress ไปขั้นถัดไป (เช่น "Mileage 78 / 100 km") · ที่ยังล็อกแสดงเป็นสีเทา (`status-locked`)
- **แท็บหมวดที่ยังล็อก (§1.1):** ไอคอนแม่กุญแจบนแท็บ · หัวแท็บ "จบโปรแกรม Powerlifting 1 โปรแกรมเพื่อปลดล็อก" (Hybrid: "จบโปรแกรมที่มีทั้งยกและวิ่ง 1 โปรแกรม") + ปุ่มไปหน้า Programs · รายการ achievement แสดงแบบเทา/เบลอเป็นตัวอย่าง · hero card ไม่เปลี่ยน
- **Profile:** 4 Pillars 2×2 (DESIGN §6.2) + Tier Roadmap (§6.3)
- **Toast ตอนปลดล็อก:** หลัง Finish workout / บันทึก run / บันทึก 1RM → เทียบกับรายการที่เคยเห็น (เก็บ `seenAchievements` ใน localStorage) แล้วเด้ง "🏆 ปลดล็อก PR Hunter · Silver +250 EXP"

## 9. โครงสร้างโค้ด (ตอนทำจริง)

- `lib/achievements.ts` (ใหม่, pure) — นิยาม achievement เป็นข้อมูล (`id`, หมวด, ขั้น, ฟังก์ชันวัดค่า) + `evaluateAchievements(data) → { id, tier, value, nextTarget }[]`
- `lib/exp.ts` (ใหม่, pure) — `computeExp(data)` (รวม ก + ข, ใช้ cap ต่อวัน) · `levelFromExp(exp)` · `tierFromLevel(level)`
- Reuse: `buildLiftSeries` (`lib/oneRM.ts`), `startOfTrainingWeek` / `isProgramComplete` (`lib/programStatus.ts`), `getExercise` + กลุ่มกล้ามเนื้อ (`lib/utils.ts`), `latestWeightKg` (`lib/calories.ts`)
- `lib/programKind.ts` (ใหม่, pure) — `programTags(program) → ('powerlifting' | 'hybrid' | 'fitness')[]` ตามตาราง §1.1 (ตัวเดียวใช้ทั้ง badge และการปลดล็อก) · `achievements.ts` มี `unlockedCategories(completions)`
- Store: `programCompletions` + `recordCompletion()` ใน `useProgramStore` (เรียกจาก `setDayStatus` + backfill ตอน hydrate) · sync ผ่าน `syncProgramState` / hydrate ใน `useAuthStore`
- Supabase migration: `alter table program_state add column program_completions jsonb not null default '[]'`
- Types ใหม่ (`AchievementDef`, `AchievementProgress`, `ExpSummary`) → `packages/shared/src/types.ts`
- เทส: ทุก achievement มีเคส "ยังไม่ถึง / พอดีเกณฑ์ / เกิน" · cap ต่อวัน · streak ข้ามเดือน/ปี · ข้อมูลว่าง = Lv1 0 EXP · `programTags` ครบ 4 แถวของตาราง + วิ่งล้วน + ยก/วิ่งอยู่คนละสัปดาห์ (ไม่ใช่ hybrid) + ยก/วิ่งคนละวันในสัปดาห์เดียวกัน (hybrid) + weekly · Restart หรือลบโปรแกรมแล้วหมวดยังปลดอยู่ · backfill จดครั้งเดียวไม่ซ้ำ

## 10. ต้องตัดสินใจก่อนลงมือ

1. **ลบ session แล้ว EXP/Level ลดได้ไหม?** — แนะนำ: **ลดได้** (derive ล้วน ง่าย ถูกต้อง กันโกง) · ถ้าไม่อยากให้ถอย ต้องเก็บ snapshot ลง Supabase (`program_state`) ซึ่งเพิ่มงาน sync
2. **ข้อมูลย้อนหลังที่มีอยู่แล้วนับไหม?** — แนะนำ: **นับ** วันเปิดฟีเจอร์ผู้ใช้เก่าจะได้ Level ตามประวัติจริงทันที (toast รวบเป็นข้อความเดียว ไม่เด้ง 30 ครั้ง)
3. **Relative Strength / Strong & Fast** ต้องมีน้ำหนักตัว — ถ้าไม่เคยชั่ง แสดงเป็น "ล็อก · ชั่งน้ำหนักใน Profile เพื่อปลดล็อก"
4. **ตัวเลขเกณฑ์** (plate club, pace, ระยะ, EXP ต่อการกระทำ) — ปรับตามกลุ่มผู้ใช้จริง
5. **Coach เห็น Level ของนักกีฬาไหม** — ข้อมูลอยู่แล้ว (coach อ่าน sessions ได้) แต่ต้องตัดสินใจเรื่อง UI/ความเป็นส่วนตัว
6. ✅ **เงื่อนไขปลดล็อกหมวด (ตัดสินใจแล้ว 2026-11-13)** — PL/Hybrid ต้องจบโปรแกรมชนิดนั้น 1 โปรแกรม · "จบ" ใช้ `isProgramComplete` เดิม (skip นับ) · ปลดแล้วได้ achievement ย้อนหลังทั้งหมด · ถ้าภายหลังพบคนกด skip ทั้งโปรแกรมเพื่อปลดล็อก → เพิ่มเกณฑ์ done ≥ X% ที่ `programKind.ts` จุดเดียว
