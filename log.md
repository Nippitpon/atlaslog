# Atlaslog — Development Log

> อัปเดตล่าสุด: 2026-09-03 (รอบ 41 — ✅ SHIPPED: วันวิ่งในโปรแกรมขึ้น DONE ได้แล้ว)
>
> 📘 คู่มือ Coaching: `docs/coaching-guide.md`

---

## 2026-09-03 — รอบ 41 (✅ SHIPPED, deploy main): วันวิ่งในโปรแกรมขึ้น DONE ได้แล้ว (ผูก run → program day)

commit `9c879bb` (feat) · **Supabase: รัน `alter table public.runs add column if not exists day_ref text;`
ไปแล้ว 2026-09-03** (ยืนยัน `day_ref | text | YES` ใน information_schema) — ถ้าตั้ง project ใหม่ DDL ใน
`SUPABASE_SETUP.md` มีคอลัมน์นี้อยู่แล้ว

ผู้ใช้ทักว่า *"วิ่งเสร็จแล้วบันทึกค่าลงในแอพ แต่ในโปรแกรมยังไม่ขึ้น done"* — เป็นช่องว่างที่**รอบ 23 จดค้างไว้เองใน
"ไม่ทำรอบนี้"** (`running-only day ไม่ได้ track "done" status ผ่าน Logger`) ไม่ใช่ bug ที่เพิ่งเกิด

### ทำไมมันไม่เคยขึ้น done (root cause 4 ชั้น)
- `'done'` ถูกเขียนจากที่เดียวในทั้งแอป — `finishWorkout()` (`useAppStore.ts`) อ่าน `workout.programId`
  รูป `programId/weekId/dayId` แล้ว `setDayStatus(..., 'done')`
- แถว `type: 'running'` ถูกกรองออก**ก่อน**ถึง Logger ทุกทาง (`dayToProgram` + `resolveDayExercises`)
  → วันวิ่งล้วนไม่มี workout ให้เริ่ม → `finishWorkout` ไม่เคยทำงาน → ค้าง `not_started` ตลอดกาล
- `/runs` เป็น log แยกที่ไม่รู้จักโปรแกรม — ปุ่ม "Go Run"/"LOG →" ยิง `navigate('/runs')` เปล่า ๆ ไม่ส่ง context
- `RunEntry` ไม่มี field ผูก program/week/day และ `addRun` ไม่แตะ `useProgramStore` เลย

**ผลข้างเคียงที่หนักกว่าอาการที่เห็น (แก้ไปด้วยในรอบนี้):** `isWeekDone` ต้องการทุกวัน `done`
→ สัปดาห์ที่มีวันวิ่ง **done ไม่ได้ตลอดกาล** → `pickActiveWeek` ตรึงการ์ดไว้สัปดาห์นั้น (ต่อจากรอบ 40 ตรง ๆ),
`remainingDays` ค้าง ≥1, โปรแกรมไม่มีวันขึ้น `COMPLETED`

### ทำอะไร
- **`types.ts`** — `RunEntry.dayRef?: string` = composite `programId/weekId/dayId` (convention เดียวกับ
  `Session.programId` ที่ `dayToProgram` ปั๊ม) · optional → backward compatible กับ run เก่าทั้งหมด
- **`programStatus.ts`** — `dayRef(programId, weekId, dayId)` สร้าง composite + `resolveDayRef(ref, programs)`
  คืน `{program, week, weekNum, day}` หรือ `null` ถ้า malformed/id หายไปแล้ว (กัน dayRef ค้างหลัง
  `resetProgram`/`updateCustomProgram` prune ids) — pure, รับ programs เป็น argument ตามแบบไฟล์นี้
- **`useProgramStore`** — action ใหม่ `setRunDayStatus(dayRef, logged)` เก็บ invariant ไว้ใน store ที่เดียว:
  วันวิ่งล้วน → `'done'` / `'not_started'` · mixed day → ยกจาก `not_started` เป็น `in_progress` เท่านั้น
  ห้ามทับ `'done'` ของเวท · เช็ค "วิ่งล้วน" ด้วย `resolveDayExercises` (ไม่ใช่ `day.exercises` ดิบ) →
  ถ้าผู้ใช้ Edit เพิ่ม accessory เข้าวันวิ่ง สิทธิ์ `'done'` กลับไปเป็นของ Logger อัตโนมัติ
- **`useAppStore`** — `addRun` → ถ้ามี `dayRef` เรียก `setRunDayStatus(ref, true)` · `removeRun` → อ่าน dayRef
  ก่อนลบ แล้วถอยสถานะ**เฉพาะเมื่อไม่มี run อื่นของวันนั้นเหลือ** (วิ่ง 2 รอบในวันเดียวเป็นเรื่องปกติ)
- **`WeekDays`** — `onOpenRun` ส่ง `/runs?day=<encoded ref>` · แถว RUNNING โชว์ `✓ LOGGED 5.2 km · 28 min`
  เมื่อมี run ผูกอยู่ (ทำให้เห็นว่าทำไมวันนั้นเขียว) · footer วันวิ่งล้วนเพิ่มปุ่ม ghost `✓ Mark done`/`Undo`
- **`DashboardPage`** — `runHref` ตัวเดียวใช้ทั้งการ์ดวันวิ่งล้วนและแถววิ่งบนวันเวท (ปุ่ม Running บนแถบ
  shortcut **ไม่**ส่ง dayRef — เป็นการวิ่งอิสระ)
- **`RunsPage`** — `useSearchParams` อ่าน `?day=` → แถบ `LOGGING FOR W3 · Wed — <focus>` + `TARGET 5 km · 30 min`
  + ปุ่ม ✕ ยกเลิกการผูก (บันทึกเป็น free run) · prefill ระยะ/เวลาจากที่โปรแกรมสั่ง (ปิดช่องว่างอีกข้อของรอบ 23)
  · บันทึกแล้ว `navigate(-1)` กลับไปเห็นการ์ดวันเขียวทันที
- **sync** — `syncQueue` run-upsert เพิ่ม `day_ref` · `useAuthStore` map `day_ref → dayRef` ·
  `SUPABASE_SETUP.md` เพิ่ม `day_ref text` ใน DDL + snippet `alter table` สำหรับ project ที่สร้างตารางไปแล้ว

### ผลกระทบ (จัดการแล้ว)
สถานะยังอยู่ใน `progress` blob ที่เดียว → `isWeekDone`/`weekStatus`/`remainingDays`/`pickActiveWeek`/
`countDoneWeeks` ได้ของฟรีทั้งหมด ไม่ต้องแก้ (นี่คือเหตุผลที่ **ไม่**เลือกทาง "derive จากวันที่ปฏิทิน"
ซึ่งจะต้องยัด `runs` เข้าไปในทุกฟังก์ชันของ `programStatus.ts`) · ไม่มี import cycle ใหม่
(`useProgramStore` → `programStatus`/`dayLayout`/`twelveWeekProgram` ล้วน pure ไม่ย้อนกลับมาที่ store) ·
วันที่ในฟอร์ม `/runs` ไม่มีผลกับ done — `dayRef` เป็นตัวตัดสิน สอดคล้องกับ `progress` ทั้งระบบที่ไม่เคยผูกวันที่ ·
run ที่ ref หายแล้ว → `resolveDayRef` คืน null → บันทึกเป็น free run เงียบ ๆ ไม่ crash

### verify
`tsc -b` + ESLint + `vite build` ผ่าน (125 modules) · **ยังไม่ได้ click-through e2e** (แอป gate ด้วย Supabase auth)
แต่รอบนี้เทสตรรกะจริงด้วย harness ชั่วคราว (`vite build --ssr` + stub localStorage → รัน store จริงใน node),
ผ่าน 12/12: run→done · ลบ run รองยัง done · ลบตัวสุดท้าย→not_started · mixed day→in_progress ·
mixed day done แล้ว run ไม่ทับ/ไม่ถอย · stale dayRef ไม่ crash · free run ไม่แตะวัน ·
วันวิ่งที่ Edit เพิ่ม accessory→in_progress ไม่ใช่ done · `isWeekDone` true + `remainingDays` 0 (คือบั๊กพ่วง)
→ ควร click-through: กด Go Run จากการ์ดวัน → เห็นแถบ LOGGING FOR + prefill → Add Run → เด้งกลับ เห็นการ์ดเขียว ·
`/runs` ที่เข้าตรง ๆ (ไม่มี `?day=`) ต้องเหมือนเดิมทุกอย่าง

### ไม่ทำรอบนี้
ไม่ derive done จากวันที่ปฏิทิน (run ที่บันทึกก่อนรอบนี้จึงไม่ขึ้น done เอง — ใช้ปุ่ม `✓ Mark done` แตะย้อนหลัง) ·
mixed day ยังนับ done จากเวทเสร็จอย่างเดียว ไม่บังคับให้ต้องบันทึกวิ่ง (ผู้ใช้เลือกเอง) ·
`HistoryPage` RunCard ยังไม่บอกว่า run นั้นผูกกับวันไหนของโปรแกรม · ไม่มี unit test ถาวร (harness ลบทิ้งแล้ว)

---

## 2026-09-01 — รอบ 40 (✅ SHIPPED, deploy main): Home/ACTIVE PROGRAM ยึดสัปดาห์ปฏิทิน + บรรทัดวันค้าง + ยุบสูตร "สัปดาห์จบ" เหลือตัวเดียว

commit `3399a0c` (fix) — ก้อนเดียว เพราะสูตรสัปดาห์กับการรวม `countDoneWeeks` แยกกันไม่ได้
(`pickActiveWeek` เรียก `isWeekDone` ตัวเดียวกับที่ไปแทน `getWeekStatus`)

ผู้ใช้ทักว่า *"active program ไม่ตรงกับ week ปัจจุบัน เพราะมีวันที่ค้างอยู่จาก week ก่อนหน้า"*
— **นี่คือกฎที่รอบ 38 ตั้งใจใส่ไว้ ทำงานถูกต้องตามสเปกทุกประการ** `DashboardPage` เดิมเลือก
"สัปดาห์แรกที่ยังไม่ `done`" → วันค้าง**วันเดียว**ใน W1 ตรึงการ์ดไว้ที่ W1 ถาวร และ
TODAY'S SESSION ก็หยิบวันของ W1 มาสั่งซ้อมทั้งที่ปฏิทินไป W2 แล้ว · `startDate` ถูกใช้แค่ทำป้าย
"ช้ากว่าแผน N สัปดาห์" ไม่มีผลกับสัปดาห์ที่แสดงเลย

### 🔴 ทำไมกลับไปยึดปฏิทินดื้อ ๆ ไม่ได้ (อ่านก่อนคิดจะย้อน)

รอบ 38 แก้บั๊กตรงข้ามมาแล้ว: โปรแกรมที่ตั้งไว้ 5 สัปดาห์แต่ไม่เคยเล่นเลย ปฏิทินเด้งไป **W6**
ข้าม accumulation block ทิ้ง แล้วสั่งเบนช์ **105kg @8.5** ให้คนที่ยังไม่เคยซ้อม
→ ต้องได้ทั้งสองเคสพร้อมกัน ไม่ใช่สลับข้างบั๊ก

### สูตรที่ใช้ (`pickActiveWeek` ใน `lib/programStatus.ts`)

```
week = clamp( max(firstUnfinished, min(scheduled, ceiling)), 1, totalWeeks )

ceiling = trained > 0 ? trained + (สัปดาห์นั้น done ? 1 : 0)   ← ซ้อมสัปดาห์ไหนในสัปดาห์ปฏิทินนี้
                      : lastTouched + 1                        ← ไม่ได้ซ้อม = กฎรอบ 38
```

- `min(scheduled, ceiling)` = **กฎรอบ 38** ห้ามกระโดดข้ามบล็อกที่ยังไม่เคยแตะ
- `max(firstUnfinished, …)` = ห้ามย้อนไปโชว์สัปดาห์ที่ทำจบแล้ว

**ทำไมต้องมี `trained` (อย่าตัดทิ้งเพราะคิดว่าซับซ้อนเกิน)** — ร่างแรกใช้แค่
`min(scheduled, lastTouched + 1)` แล้วพัง: progress ของ "W1 ค้าง ปฏิทิน W2" กับ
"W2 ค้าง ปฏิทิน W8" **หน้าตาเหมือนกันเป๊ะ** ต่างกันแค่ `scheduled` → คนที่กำลังไล่ซ้อม W2 อยู่จริง
จะโดนดันไป W3 และโดนดันหนีทุกสัปดาห์ · แยกด้วย progress อย่างเดียวไม่ได้ **ต้องใช้สัญญาณเวลา**
ซึ่งมีอยู่แล้วไม่ต้องเก็บอะไรเพิ่ม: `Session.programId` = `programId/weekId/dayId` + `Session.date`
และ `'done'` ถูกเขียนที่เดียวตอน finish (`useAppStore.ts`) → **ทุกวันที่ done มี session เสมอ**

⚠️ นับสัปดาห์ปฏิทินแบบ **จันทร์–เสาร์** ไม่ใช่อาทิตย์–เสาร์ เพราะ `StructuredDay.dayOfWeek`
ไม่มี `'Sun'` → วันอาทิตย์เป็นของสัปดาห์ที่เพิ่งจบ กันการ์ดกระโดดเช้าวันอาทิตย์

### ทำอะไร

- **`lib/programStatus.ts`** — `isWeekDone` / `weekStatus` / `remainingDays` /
  `scheduledWeekNum` / `trainedWeekNumSince` / `pickActiveWeek` + type `ActiveWeek`
  · `countDoneWeeks` refactor ให้เรียก `isWeekDone` · **`ActiveWeek` ประกาศในไฟล์นี้เอง**
  (precedent `ProgramStatus`) ไม่แตะ `packages/shared` เพราะไม่มีอะไรถูก persist
- **ยุบสูตร "สัปดาห์จบแล้ว" จาก 3 ตัวเหลือ 1** — เดิมขัดกันเอง 3 หน้า:
  | ที่ | สูตรเดิม | ปัญหา |
  |---|---|---|
  | `useProgramStore.getWeekStatus` | `doneCount === dayCount` | **id-blind** — day id ตกค้าง (แก้โปรแกรม/import ทับ/hydrate cloud เก่า) นับผิดได้ทั้งสองทาง · สัปดาห์ว่างคืน `'done'` (`0===0`) |
  | `programStatus.countDoneWeeks` | `w.days.every(d => days[d.id] === 'done')` | ✅ ถูก — ใช้เป็นมาตรฐาน |
  | `ProgramOverviewPage.ProgressSummary` | `every(s => 'done')` ไม่เช็ค `days.length` | สัปดาห์ 4 วันที่ log ไว้วันเดียวแล้วจบ = นับจบทั้งสัปดาห์ |
- **ลบ `getWeekStatus` ออกจากสโตร์ทั้งตัว** ไม่ใช่แก้ signature — พารามิเตอร์ `dayCount` คือต้นเหตุ
  ที่ทำให้ id-blind · callers 3 ที่มี `week` object อยู่แล้วทุกที่ · ผลพลอยได้: ทิ้ง
  `eslint-disable react-hooks/exhaustive-deps` ใน `DashboardPage` ได้ (ที่ต้องใส่เพราะ
  `getWeekStatus` แอบอ่าน `get()` ข้างใน) → `progress` เป็น dep ตรง ๆ แล้ว
- **บรรทัดวันค้างบนการ์ด** — `↩ W1 ยังค้าง 1 วัน →` สีเหลือง `#f59e0b` ใต้ progress bar
  ชี้ไป**สัปดาห์เก่าสุด** ที่ยังค้าง · ค้างหลายสัปดาห์เติม `· อีก N สัปดาห์` (ไล่รายสัปดาห์จะล้นที่ 390px)
  ⚠️ **ต้องผ่าการ์ดเป็น 2 tap target** — เดิมทั้งใบเป็น `<button>` ซ้อนปุ่มไม่ได้ (nested button ผิด HTML)
  → ย้าย `className="card card-tight"` ออกไป `<div>` ข้างนอก ให้ปุ่มค้างเป็น sibling
  (pattern เดียวกับการ์ด TODAY'S SESSION รอบ 38 commit `e0409b6`)
  · `all: 'unset'` ห้ามอยู่ elem เดียวกับ `className` (ล้าง `font-family` ของ class) → `t-mono` ไปไว้ที่ `<span>`
- **`lib/utils.ts` += `dateFromYMD()`** — `new Date('YYYY-MM-DD')` เป็น **UTC = 07:00 เวลาไทย**
  แต่เทียบกับ `new Date()` ที่เป็น local → เลขสัปดาห์เปลี่ยนตอนเจ็ดโมงเช้าแทนเที่ยงคืน
  ขัดกับกฎที่เขียนไว้ชัด ๆ ใน `utils.ts:48-50` เอง · แก้ทั้ง `DashboardPage`, `ProgramOverviewPage`,
  `WeekDetailPage` (ช่วงวันที่รายสัปดาห์เพี้ยนด้วยเหตุเดียวกัน — ยังถูกใน UTC+7 แต่พังใน timezone ติดลบ)
- **TODAY'S SESSION แก้บรรทัดเดียว** — `const { program, week: currentWeek } = activeProgramInfo`
  ให้ shape ที่คืนและผู้ใช้ทุกตัวเหมือนเดิมเป๊ะ แล้วมันได้สัปดาห์ใหม่ตามมาเอง

### ผลกระทบ (จัดการแล้ว)

- **% ของบางโปรแกรมจะลดลง และป้ายบางสัปดาห์อาจกลับเป็น "Not started"** = ค่าที่ถูกต้อง
  ไม่ใช่ regress (precedent เดียวกับรอบ 37 ที่แก้ `countDoneWeeks`) · ตอนนี้ Home / Programs /
  Program Overview รายงานเลขเดียวกันแล้ว เดิมขัดกันเอง 3 ทาง
- **สัปดาห์ว่าง (`days.length === 0`)** — `getWeekStatus` เดิมคืน `'done'` (`0===0`) แต่
  `isWeekDone` คืน false → ใส่ guard `days.length > 0` ใน loop หา `firstUnfinished`
  ไม่งั้นโปรแกรมที่มีสัปดาห์ว่างจะตรึงการ์ดไว้ตลอดกาล
- **เคส dormant ที่ยอมรับแล้ว** — ปฏิทิน W8 · W2 ค้าง · ไม่ได้ซ้อมมาหลายสัปดาห์ → โชว์ W3 + ป้ายค้าง W2
  พอกลับมาซ้อม W2 การ์ดจะตามกลับไปเอง (semantic เดียวกับเคส "W1 ค้าง ปฏิทิน W2" แค่ drift ใหญ่กว่า)
- **`weeksBehind` เก็บไว้เหมือนเดิม ความหมายดีขึ้น** — เคสปกติเป็น 0 (บรรทัดค้างสื่อสารแทน)
  จะเป็นบวกเฉพาะตอน ceiling รั้งไว้จริง = ช้าจริง
- **`in_progress` ที่ค้างไม่มีวันที่** — logger ที่เริ่มแล้วทิ้ง (`LoggerPage` เขียน `in_progress`
  และไม่มีใครล้าง) จะไม่ถูกนับเป็น `trained` เพราะไม่มี session → ไม่ยึดสัปดาห์ให้

### verify

`pnpm build` ผ่าน (125 modules) · ESLint exit 0

**ทดสอบ `pickActiveWeek` ตรงที่ฟังก์ชันด้วยข้อมูลสังเคราะห์ — ผ่าน 7/7**
(bundle ด้วย vite ssr ลง scratchpad แล้วรัน node · fixed `now` = พฤ. 2026-09-03 กัน flaky · ลบ harness ทิ้งแล้ว)

| เคส | ผล |
|---|---|
| ไม่เคยเล่น ปฏิทิน W6 | W1 · behind=5 ✅ กฎรอบ 38 ไม่พัง |
| W1 ค้าง 1 วัน ปฏิทิน W2 | W2 · `W1:1` ✅ เคสที่ผู้ใช้เจอ |
| W1 จบครบ ปฏิทินยัง W1 | W2 ✅ ไม่โชว์สัปดาห์ที่จบแล้ว |
| จบ W1+W3 ค้าง W2 ปฏิทิน W4 | W4 · `W2:4` |
| **กำลังซ้อม W2 สัปดาห์นี้ ปฏิทิน W8** | **W2** ✅ ไม่โดนลากหนี |
| dormant W2 ค้าง ปฏิทิน W8 | W3 · `W2:2` |
| ซ้อมเร็วกว่าแผน จบ W1-W3 ปฏิทิน W2 | W4 · behind=-2 |

> ⚠️ **ยังไม่ได้ click-through e2e / ไม่เคยเห็นการ์ดเรนเดอร์จริง** — ผู้ใช้เลือก ship ก่อน
> (Playwright ไม่อยู่ใน lockfile · ตั้ง `chrome-devtools-mcp` ไว้ใน `.mcp.json` แล้วแต่ต้องรีสตาร์ต
> Claude Code ถึงจะใช้ได้ — **ไฟล์นี้ยังไม่ commit โดยตั้งใจ**)
>
> **ต้องเช็คบน production:** ① หน้าตาการ์ดหลังผ่า 2 tap target (เส้นสี phase ซ้ายมือลากครบใบไหม ·
> padding เพี้ยนไหม) ② กดเนื้อการ์ด → Week ปัจจุบัน · กดบรรทัดเหลือง → Week ที่ค้าง (คนละที่)
> ③ TODAY'S SESSION เป็นท่าของสัปดาห์ใหม่ + START เปิด workout id ถูกสัปดาห์
> ④ เลข % ตรงกันทั้ง 3 หน้า ⑤ ขอบ 07:00 (ตั้ง `startDate` = 7 วันก่อนพอดี เลขต้องไม่เปลี่ยนตอน 06:59→07:01)

### ไม่ทำรอบนี้

- **ไม่เพิ่มสถานะ `skipped`** — ยังไม่มีทางบอกว่า "วันนี้ข้ามไปเลย" วันค้างจึงค้างตลอดจนกว่าจะเล่นจบ
  บรรทัดวันค้างเป็นแค่ทางเข้า ไม่ได้ปิดจ๊อบให้
- **ไม่ทำ fallback "วันนี้ไม่มีในสัปดาห์นี้ → เอาวันค้างมาโชว์แทน"** ใน TODAY'S SESSION —
  ทางเข้าวันค้างมีทางเดียวคือบรรทัดบนการ์ด (คงเจตนารอบ 38)
- **ไม่แก้ `weekNumber` vs ตำแหน่ง array ที่ไม่ตรงกัน** — Excel import ตั้ง
  `totalWeeks = sortedWeekNums.length` ทำให้โปรแกรมที่ week ไม่ต่อเนื่อง (1,2,4) มี `weekNumber`
  ต่างจากตำแหน่ง · โค้ดเดิมยึดตำแหน่งทั้งหมด รอบนี้ยึดตำแหน่งตามเพื่อให้การ์ดสอดคล้องกันเอง
  (ของเดิมค้างอยู่แล้วใน `docs/code-review-2026-07-13.md`)
- **ไม่แตะ backlog 🔴 sync/data-loss** จาก `docs/code-review-2026-07-13.md` ที่ยังค้างครบ ~35 ข้อ
  ไม่ติ๊กสักข้อ — **ยังเป็นความเสี่ยงอันดับ 1 ของ repo**

---

## 2026-08-20 — รอบ 39 (✅ SHIPPED, deploy main): ประวัติ 1RM มีวันที่ + กราฟ progression + RPE ต่อเซ็ต

commit `5c78b62` (feat: 1RM history + chart) · `3909684` (feat: Logger RPE — แยกไว้ revert ง่าย) ·
`836c0ec` (docs) — แยก 3 ก้อนเพราะ Logger เป็นจอที่ใช้บ่อยสุด ถ้า layout พังจะถอยได้โดยไม่เสียกราฟ

ผู้ใช้ถามว่า Personal 1RM เก็บยังไง มี record วันที่ไหม เอาไปทำ line chart ได้ไหม —
**ตรวจแล้วไม่มีวันที่และไม่มีประวัติเลย** (`setPersonalOneRMs` เขียนทับทันที · `program_state.updated_at`
เป็นเวลา sync ของทั้ง blob) → ทำกราฟไม่ได้เพราะไม่มีแกน X. รอบนี้เพิ่มมิติเวลาแล้ววาดกราฟ 2 เส้น

> ✅ **เจ้าของรัน SQL section 2k แล้ว 2026-08-20** (ก่อนหน้านั้น e2e เจอ 404 จริง 4 ครั้งตอน `loadUserData`
> — ถ้า ship ก่อนรัน SQL คิวจะโตไม่หยุดเพราะ `flushQueue` ไม่มี retry limit)

### ทำอะไร

**ชั้นข้อมูล**
- `types.ts` — `WorkoutSet.rpe?: number` (RPE ที่ยกได้จริง คนละตัวกับ `targetRpe` ที่เป็นค่าสั่ง) ·
  `OneRMLift` / `OneRMSource` / `OneRMEntry { id, date, lift, weightKg, source?, note? }`
  — **1 แถว/ท่า/ครั้ง** ไม่ใช่ 1 แถวเก็บครบ 3 (เส้น e1RM เป็น per-lift อยู่แล้ว → shape เดียวกัน ลบแยกท่าได้)
- `lib/oneRM.ts` (ใหม่, pure) — `setE1RM` / `buildLiftSeries` / `latestOneRMs` / `latestEntryFor` ·
  `rpeTable.getRpePct` เปลี่ยนเป็น `export` เพื่อ **invert ตาราง RPE ของแอปเอง** (ไม่ duplicate)
- `lib/utils.ts` — `todayYMD()` / `isoFromYMD()` (local calendar + local noon)
- `syncQueue.ts` — op `one-rm-upsert` / `one-rm-delete` + `syncOneRM` / `syncOneRMDelete`
  (**แทรกก่อน `else` ปิดท้าย** ที่เป็น `program-delete` แบบ implicit)
- `useAppStore.ts` — `oneRMHistory` + `addOneRMEntry(ies)` / `removeOneRMEntry` / `setOneRMHistory` ·
  helper ภายใน `appendOneRMs` (append+sync **ไม่ promote**) แยกจาก `addOneRMEntries` (append+promote)
- `useAuthStore.ts` — fetch `one_rm_records` เป็น promise ที่ 8 + reconcile ด้วย `useAppStore.setState`
  (ไม่ใช่ action → ไม่เรียก `syncSettings()` → ไม่ write-back loop)
- `SUPABASE_SETUP.md` section **2k** — ตาราง `one_rm_records` + RLS (`with check` ด้วย) + coach-read + index

**UI**
- `components/charts/` (ใหม่) — `MiniBars.tsx` (ดึง WEIGHT TREND ที่ซ้ำใน `ProfilePage` + `AthleteDetailPage`
  ออกมาที่เดียว) · `oneRMScale.ts` (สีท่า + scale เวลาเชิงเส้น) · `OneRMChart.tsx` · `OneRMSparkline.tsx`
- **หน้าแยก `/one-rm`** (`features/profile/OneRMPage.tsx`, route ใหม่ใน `router.tsx`) — กราฟ +
  pill `ALL/SQUAT/BENCH/DEAD` + legend 3 ท่า + ปุ่ม `Log a 1RM test` + ประวัติเต็มลบได้
  (`window.confirm` ตาม `RunsPage`) + ชีต `Edit current →` (ค่า 1RM ปัจจุบันที่โปรแกรมใช้คำนวณ)
  - **ตอนแรกทำเป็น section ในหน้า Profile แต่ผู้ใช้บอกว่ารก** → ย้ายออกมาทั้งก้อน
    Profile เหลือ **การ์ดปุ่มแถวเดียว** (`Personal 1RM · 200/120/220 kg · TOTAL 540 · PROGRESSION →`)
    ตาม pattern ปุ่มเมนูเดิม · หน้า Profile สั้นลงเหลือ scrollHeight 1492px
  - โครงหน้าลอก `RunsPage` (back button + form/list + delete) ซึ่งเป็น precedent เดียวในแอป
- `LogOneRMSheet.tsx` (ใหม่) — เลือกท่า + `DateField` (default วันนี้, `max` กันอนาคต) + น้ำหนัก + delta
- Dashboard — การ์ด sparkline ระหว่างการ์ดสถิติกับการ์ดโปรแกรมพัก กดแล้วไป `/one-rm` (`VIEW →` ไม่ใช่ตัวเลข
  เพราะเหนือขึ้นไป 200px มี "SBD TOTAL (WEEK)" ที่คนละความหมาย)
- Logger — คอลัมน์ RPE: grid `36px 1fr 1fr 60px` → `30px 1fr 1fr 56px 56px` ·
  `FinishReview` โชว์ `@8.5` ท้ายบรรทัดเซ็ต

### การตัดสินใจที่สำคัญ (อย่าย้อน)

- **Brzycki ไม่ใช่ Epley** — ที่ 1 rep Brzycki คืน `w` เป๊ะ (162.5→162.5) ส่วน Epley คืน `w×1.0333`
  (162.5→167.9) = bias +3.3% ทุกซิงเกิล บนกราฟที่มีไว้ดูเทรนด์ = ตัดทิ้ง · clamp `r` ที่ 10 ทั้งสองทาง
- **ไม่ prefill `rpe` จาก `targetRpe` ใช้ `placeholder` แทน** — ค่าที่ prefill แยกไม่ออกจากค่าที่รู้สึกจริง
  = แอปผลิตข้อมูล "actual" เอง แล้วไปป้อน `calcWeight` ต่อ · `targetRpe` ยังเป็น per-exercise ไม่ใช่ per-set ·
  `addSet` / `startWorkout` ก็ห้าม copy `rpe`
- **backdate ไม่ promote / ลบไม่ rewind** — ย้อนวันที่ใส่ของเก่าต้องไม่ทับน้ำหนักที่โปรแกรมกำลังใช้
  และการลบจุดบนกราฟต้องไม่เปลี่ยนน้ำหนักที่สั่งทั้งโปรแกรมเงียบ ๆ
- **`ALL` โชว์เส้น manual อย่างเดียว** — 3 ท่า × 2 เส้น = 6 polyline บน plot 284px อ่านไม่ออก
- **ไม่ seed แถวย้อนหลังให้ค่าที่มีอยู่แล้ว** — เคยเขียนไว้แล้วถอดออก: เราไม่รู้ว่า 1RM เดิมวัดวันไหน
  การประทับ "วันนี้" คือการกุวันที่ (หลักการเดียวกับข้อ prefill RPE) · ผู้ใช้เก่าจะเห็นค่าปัจจุบันใน legend
  แต่กราฟยังว่างจนกว่าจะกด Log a 1RM test

### ผลกระทบ (จัดการแล้ว)

- **ช่อง RPE ว่างต้องไม่ดูเหมือนมีข้อมูล** — `.set-row.complete .input-num` ทาสี lime ตอนติ๊กเซ็ต →
  เพิ่ม `.set-row.complete .input-rpe:placeholder-shown` override ให้คงสีกลาง (ยืนยันด้วย e2e:
  KG = `rgba(212,255,58,0.08)` แต่ RPE = `rgb(28,28,28)`)
- **แก้บั๊กเก่าไปด้วย** — `.set-row` เปลี่ยนเป็น `align-items: end` + `.set-num` สูง 56px:
  เดิม hint `prev` ทำให้ช่อง KG/REPS สูง 68px แต่ปุ่ม ✓ 56px จัดกึ่งกลาง → ปุ่มต่ำไป ~6px
- **2 session วันเดียวกัน → เส้นตั้งฉาก** — เจอตอน e2e (บัญชีทดสอบมี 3 session ลงวันที่ 23/06 เหมือนกัน)
  จุด e1RM 2 จุดอยู่ x เดียวกัน → `thinEstimated` ยุบเหลือ **max ต่อวัน** ก่อน แล้วค่อยยุบเป็นรายสัปดาห์
  เมื่อเกิน 120 จุด
- **guard ของ sparkline ต้องนับต่อท่า** — เดิมนับจุด manual รวมทุกท่า → คนที่ log squat 1 + bench 1
  วันเดียวกันเห็นการ์ดเปล่า · แก้เป็น `series.some(s => s.manual.length >= 2)` ทั้งใน `DashboardPage`
  และในตัว component เอง
- **ชื่อไฟล์ชนกันบน Windows** — `OneRMChart.tsx` กับ `oneRMChart.ts` ต่างกันแค่ case → TS1149/TS1261
  เปลี่ยนชื่อ primitives เป็น `oneRMScale.ts`
- `components/charts/*` **ห้าม import store** — รับ `LiftSeries[]` ทาง props อย่างเดียว เพื่อให้หน้าโค้ช
  เสียบใช้ได้ทันทีเมื่อ `coachApi` คืนข้อมูลมา (policy coach-read เตรียมไว้ใน 2k แล้ว)
- persist ไม่มี `version`/`migrate` — `oneRMHistory` เป็น **key ใหม่** จึงปลอดภัย (zustand shallow-merge
  blob ที่ persist ทับ initializer → blob เดิมที่ไม่มี key นี้ได้ `[]`) เหตุผลเดียวกับตอนเพิ่ม `programMeta` รอบ 37

### ⚠️ e1RM วนกลับหาตัวเองบางส่วน — จดไว้กันลืม

`w` ที่ log ถูก prebake จาก 1RM ที่กรอก (`twelveWeekProgram.ts:344-361` → `weightOverrides`)

- แถวสั่งด้วย **RPE ล้วน** + log `rpe === targetRpe` → `e1RM = w ÷ pct = oneRM` **เป๊ะ** → เส้นแบนโดยโครงสร้าง
  (ยืนยันด้วยเลข: 1RM 200 @RPE8×5 → สั่ง 155kg → e1RM 200.3)
- แถวสั่งด้วย **PCT** → **ไม่แบน** เพราะ `w = oneRM × pct` แต่หารด้วย `getRpePct(r, rpeจริง)`
  (80% ของ 200 = 160kg → log @8×5 ได้ 206.7 · @9.5×5 ได้ 188.2 = สัญญาณจริง)
- โปรแกรม 12 สัปดาห์ในตัวใส่ทั้ง `pct` และ `rpe` และ `structuredWeight` เลือก **pct ก่อน** → เส้นมีความหมาย ·
  Excel import ที่เว้นคอลัมน์ PCT จะได้เส้นแบน
- `OneRMPoint` เก็บ `basis` / `reps` / `rpe` ไว้แล้ว → ทำ filter "ซ่อนจุด echo ล้วน" ทีหลังได้โดยไม่แก้ schema

### verify

- `pnpm build` ผ่าน (124 modules) · `pnpm --filter web lint` ผ่าน
- **สูตร e1RM ตรวจแยกด้วย node** — Brzycki r=1 คืน `w` เป๊ะ · clamp r>10 · RPE table invert ถูก ·
  ยืนยันเคส circularity ทั้ง RPE-ล้วนและ PCT ตามตัวเลขข้างบน
- **e2e Playwright 390×844, login จริง (`athlete.a`), 0 console errors** (นอกจาก 404 ของตารางที่ยังไม่สร้าง):
  - DateField default = **วันนี้ตาม local** (`2026-08-20`) + `max` กันอนาคต ✅
  - กด Save ทั้งที่ไม่แก้อะไร → ปุ่ม disabled → ไม่เกิดแถวซ้ำ ✅
  - log 205 วันนี้ → promote เป็น `personalOneRMs.squat = 205` ✅
  - backdate 180 (01/05) → **squat ยังเป็น 205** ✅
  - ลบ entry → **squat ยังเป็น 205** (ไม่ rewind) ✅
  - Logger: placeholder = `7` (targetRpe), `step 0.5 / min 6 / max 10 / inputMode decimal`, ค่าเริ่มต้นว่าง ✅
  - ติ๊กเซ็ตโดยไม่กรอก RPE → ช่องคงสีกลาง ✅ · พิมพ์ `8.5` แล้วลบ → `rpe` **หายจาก object ไม่กลายเป็น 0** ✅
  - ความกว้าง KG ที่ 390px: cell 88px / content `102.5` = 86px → **ไม่ตัด** ✅
  - `FinishReview` โชว์ `@9` ✅
  - Dashboard: 1 จุด/ท่า → การ์ด**ซ่อน** ✅ · squat 3 จุด → การ์ดโผล่ + มีเส้น + กดไป `/profile` ✅
  - empty state / จุดเดียว / estimate-only (เส้นประอย่างเดียว) ครบ ✅ (ทดสอบผ่าน hook `window.__store` ชั่วคราวใน
    `main.tsx` — **ถอดออกแล้ว**)
  - light theme: เส้น + gridline + label อ่านออก ✅
- **cloud e2e หลังรัน SQL 2k — ผ่านครบ**:
  - write → `POST 201` ขึ้น `one_rm_records` ทันที คิวเหลือ 0 ✅
  - **sign out → sign in**: `clearMetrics` ล้าง `oneRMHistory` เกลี้ยง แล้วดึงกลับจาก cloud ครบ +
    `personalOneRMs.squat` = แถวล่าสุด (207.5) ตาม invariant ✅
  - **offline → online**: กด Save ตอน offline → op เข้าคิว 2 ตัว → `dispatchEvent('online')` →
    flush หมด → ยืนยันด้วยการอ่าน cloud ตรง ๆ ว่าค่า 213 ขึ้นจริง ✅
  - **RLS isolation**: login เป็น `athlete.b` แล้ว `select * from one_rm_records` ได้ **0 แถว** ✅
  - cleanup: ลบแถวทดสอบทั้ง 4 + restore `personal_one_rms` ของ athlete.a กลับเป็น 200/120/220 ·
    ยืนยัน athlete.b ไม่มีแถวหลงเหลือ (พิสูจน์ว่า entry `userId: null` ไม่ได้ไหลข้ามบัญชีในรอบนี้)
- ⚠️ **สังเกตจาก e2e offline**: `syncOneRM` เข้าคิวด้วย `userId: null` เพราะ
  `supabase.auth.getUser()` ตอน offline คืน `{user: null}` (พร้อม console error `Failed to fetch`)
  ไม่ได้ throw · นี่คือข้อ (b) ใน "sync data-loss 4 ตัว" ที่จดไว้แล้ว (`log.md` งานค้าง) —
  op ใหม่ของรอบนี้ไปอยู่บนพื้นผิวเดียวกัน **ไม่ได้ทำให้แย่ลง** แต่ก็ยังไม่ได้แก้
- **หลังย้ายเป็นหน้า `/one-rm` เทสต์ซ้ำ ผ่านหมด**: Profile ไม่เหลือกราฟ · การ์ดปุ่มกดเข้าหน้าใหม่ได้ ·
  log test จากหน้าใหม่ → กราฟ + ประวัติขึ้น · `Edit current →` เปิดชีต 3 ช่องได้ · back กลับ `/profile` ·
  การ์ด Dashboard เด้งไป `/one-rm` · light theme อ่านออก · 0 console errors
- ⚠️ **เจอ quirk ของ `.scr-header`**: มัน `justify-content: space-between` อยู่แล้วใน `index.css:121`
  การใส่ inline `display:flex` ทับไม่ได้ override ตัวนี้ → title ถูกดันไปชิดขวาห่างจากปุ่ม back
  **`RunsPage` ก็เป็นแบบเดียวกัน** (วัดได้ `h1` อยู่ที่ x=234 แทนที่จะเป็น 20) — หน้าใหม่ใส่
  `justifyContent: 'flex-start'` แก้แล้ว แต่ **ไม่ได้แตะ RunsPage** (นอก scope ที่ผู้ใช้สั่ง)
- ⚠️ **บทเรียนตอนทำ cleanup**: อย่าเปิด 2 บัญชีใน browser context เดียวกัน — Supabase session
  อยู่ใน localStorage ต่อ origin การ login athlete.b ทับ session ของ athlete.a ทั้ง context
  ทำให้ `delete().eq('user_id', ...)` ไปลงบัญชีผิด (รอบแรกรายงาน "0 rows left" ทั้งที่ยังเหลือ 4 แถว)
  → ต้องแยก `browser.newContext()` ต่อบัญชี

### ไม่ทำรอบนี้

- toggle `MANUAL / ALL` ในรายการประวัติ (ตอนนี้โชว์เฉพาะ manual — แถวที่ทุกอันเขียน "MANUAL" ไม่ให้ข้อมูลอะไร
  และ estimate ~120 แถวคือ noise; ถ้าจะทำให้แทรกเฉพาะ **estimated PR**)
- แก้ UTC-today อีก 3 จุด (`ImportProgramSheet:59`, `ProgramSetupSheet:54`, `RunsPage:13`) —
  `todayYMD()` มีแล้ว เหลือแค่เปลี่ยนที่เรียก
- ปิดช่อง `with check` ของ `body_metrics` / `runs` (policy `for all using(...)` ไม่คุม INSERT) — 🟡 แยกรอบ
- `coachApi.getAthleteOneRMs()` + กราฟในหน้าโค้ช — policy พร้อมแล้วใน 2k
- ยุบ 6-week volume bars ของ `AthleteDetailPage` เข้า `MiniBars` (normalization คนละสูตร + มี `isCurrent`)
- เปลี่ยน `DashboardPage.tsx:108-110` ให้ใช้ `SBD_IDS` แทน string literal
- edit-in-place ของ entry (ลบแล้วเพิ่มใหม่ เหมือน Runs)
- แก้ `.scr-header` ของ `RunsPage` ให้ title ชิดซ้าย (quirk เดียวกับที่แก้ในหน้า `/one-rm`)

---

## 2026-08-18 — รอบ 38 (✅ SHIPPED, deploy main): Home/TODAY'S SESSION — ยึดโปรแกรมที่เทรนจริง + สัปดาห์คิดจาก progress

commit `310618c` (fix)

ผู้ใช้ทักว่า *"Today session ต้องแสดงข้อมูลตามโปรแกรมล่าสุด"* พอไล่ state จริงเจอ **3 เรื่องแยกกัน**
และเรื่องที่ 3 คือบั๊กที่หนักที่สุดเท่าที่เจอมาในหน้า Dashboard

### 🔴 บั๊กหลัก — Dashboard ข้ามสัปดาห์ 1–5 ทิ้ง

`DashboardPage.tsx` เดิมคำนวณสัปดาห์ปัจจุบัน **จากปฏิทินล้วน ๆ** แล้ว loop
`for (w = calendarWeekNum; w <= totalWeeks; w++)` **สแกนไปข้างหน้าอย่างเดียว ไม่เคยถอยกลับ**

state จริงตอนเจอ: `Hybrid` startDate `13/07` → ผ่านมา 36 วัน → `calendarWeekNum = 6` ·
แต่ `progress` ของโปรแกรมนี้ = `{}` (**ยังไม่เคยเล่นจบวันไหนเลย**)

| | ก่อน | หลัง |
|---|---|---|
| Dashboard | **W6** ACCUMULATION | **W1** ACCUMULATION |
| หน้า Programs | "Not started" (`doneWeeks + 1`) | เท่ากัน = W1 |
| TODAY'S SESSION | 1×2 **@8.5 105kg** / 4×2 @8 100kg | 1×5 **@7 90kg** / 4×5 @6 85kg |

คือ 2 หน้าขัดกันเอง และแอป**สั่งให้เบนช์ 105kg @8.5 ทั้งที่ยังไม่ได้ทำ accumulation block เลย**

> 💡 ผู้ใช้เสนอว่า "เก็บวันที่เล่นจริงจาก History ไหม" — **สรุปว่าไม่ต้องเก็บอะไรเพิ่ม และ
> วันเริ่มจริงก็ไม่ใช่ตัวแก้ที่ถูก** เพราะต่อให้ใช้ `firstPlayedAt` ก็ยังข้ามสัปดาห์อยู่ดี (แค่ข้ามน้อยลง)
> ตัวแก้จริงคือ **เลิกคิดสัปดาห์จากวันที่ แล้วคิดจาก progress**

### ทำอะไร

- **`DashboardPage.tsx` — สัปดาห์ปัจจุบัน = สัปดาห์แรกที่ยังไม่จบ** (วนจาก `w = 1`)
  ไม่ชี้ไปสัปดาห์ที่ทำจบแล้วเด็ดขาด · ตรงกับสูตร `doneWeeks + 1` ที่หน้า Programs ใช้
  · วันที่เหลือหน้าที่แค่คำนวณ `weeksBehind = scheduledWeekNum - displayWeekNum` → ป้าย
  **⚠ ช้ากว่าแผน N สัปดาห์** (เหลือง) / **เร็วกว่าแผน N สัปดาห์** (เทา) / ตรงแผน = ไม่มีป้าย
- **`lib/programStatus.ts`** — `programActivity(programId, meta, history)` = `max(lastPlayedAt, activatedAt)`
  · `pickCurrentProgramId()` รับ `history` เพิ่มแล้วจัดอันดับด้วยตัวนี้แทน `activatedAt` เดี่ยว ๆ
  → **เทรนโปรแกรมไหน โปรแกรมนั้นขึ้นเป็นปัจจุบันทันที** (เดิมเทรนกี่ครั้งก็ไม่มีผล)
  ⚠️ **จงใจไม่นับ `updatedAt`** — แค่แก้โปรแกรมที่ไม่ได้เทรน ไม่ควรยึด Dashboard
- **การ์ด TODAY'S SESSION ใช้ `resolveDayExercises()`** — เดิมอ่าน `day.exercises` ดิบจากโปรแกรม
  (`resolveDayExercises` ถูก import ที่ `WeekDays.tsx` ที่เดียว) → ท่าที่ผู้ใช้เพิ่ม/ลบ/สลับลำดับ**ไม่โผล่**
  ⚠️ `runs` ยัง filter จาก `day.exercises` ดิบต่อไป เพราะ `resolveDayExercises` ตัด `type === 'running'` ทิ้ง
  (`DayCard` ก็แยกแบบนี้)
- **ปุ่ม START เริ่มเทรนจริง** — เดิมเขียน `START →` แต่ `navigate(weekHref)` เฉย ๆ ต้องกด Start ซ้ำอีกที
  · แยกการ์ดเป็น **2 tap target** (เนื้อการ์ด → หน้า Week · ปุ่ม → `/workout`) ต้องเปลี่ยนตัวครอบเป็น `div`
  เพราะ nested `<button>` ผิด HTML (precedent เดียวกับ commit `e0409b6`)
  · กัน workout ค้างแบบ `LibraryPage.tsx:79-87` — วันเดียวกัน = ไปต่อไม่ถาม · คนละอัน = `confirm()` ก่อนทับ
- **การ์ดโชว์ accessory + label** (นอกแผน แต่จำเป็นเมื่อดึงรายการจริงมาแสดง) — เดิมโชว์แค่ `type === 'main'`
  ท่าที่เพิ่มเองเลยไม่ขึ้น · และ top set กับ back-off กลายเป็น "Bench Press" เหมือนกัน 2 แถว แยกไม่ออก
  → โชว์ `ex.label` ต่อท้ายชื่อ + จำกัด `PREVIEW_ROWS = 5` + `+N more` เท่า `DayCard`
- **ดึงโค้ดซ้ำออกมาใช้ร่วม** — `DashboardPage` เคยก็อป expression เลือก 1RM มาจาก `WeekDays` แบบคำต่อคำ
  · `lib/rpeTable.ts` += `resolveCalcRMs(program, config, personalOneRMs)`
  · `lib/twelveWeekProgram.ts` += `buildDayProgram(programId, weekId, day, exercises, calcRMs)`
  (ย้าย body ของ `WeekDays.handleStart` มา) → 2 หน้าคำนวณน้ำหนัก/สร้าง workout จากที่เดียวกัน เถียงกันไม่ได้อีก

### ผลกระทบ (จัดการแล้ว)

- **กฎรอบ 37 ทั้ง 2 ข้อยังอยู่ครบ** — `max()` เลือกไว้แทน "เคยเทรนชนะเสมอ" เพราะแบบหลังจะพัง
  กฎ *"เริ่มโปรแกรมใหม่ต้อง active"* (พักตัวเก่าที่มี history แล้ว setup ตัวใหม่ที่ยังไม่มี history
  → การ์ด paused จะค้าง ตัวใหม่ไม่มีวันขึ้น) · ยังไม่กรอง `paused` ออกจาก candidates เหมือนเดิม
- **user เก่าไม่ขยับ** — ไม่มีทั้ง session และ `activatedAt` → fallback วน `Object.keys(configs)` แบบเดิม
- **`weeksBehind` ใช้ `config.startDate`** ที่ผู้ใช้กรอกเอง = ยังเป็นแผน ไม่ได้ไปเขียนทับด้วยวันเล่นจริง
  (ตั้งใจ — startDate เป็น "แผน" ของ periodization/peaking ไม่ควรถูกแก้เงียบ ๆ)
- **สัปดาห์ที่เลือกอาจต่างจาก `doneWeeks + 1`** เฉพาะเคสข้ามไปเล่นสัปดาห์หลังก่อน
  (เช่นจบ week 2 แต่ยังไม่จบ week 1 → รอบนี้ชี้ week 1 = สิ่งที่ควรทำจริง ส่วนหน้า Programs ชี้ week 3)
  เคสปกติเรียงตามลำดับ = เท่ากันเป๊ะ

### verify

`pnpm build` ผ่าน (118 modules) · ESLint exit 0 · **e2e Playwright 390px, 0 console errors** (บัญชีจริง)

**logic การเลือกโปรแกรม** — เทสต์ตรงที่ฟังก์ชันด้วยข้อมูลสังเคราะห์ (dev `import()` ไม่แตะข้อมูลจริง):

| เคส | ได้ |
|---|---|
| เทรน Hybrid วันนี้ vs PL Test setup 3 วันก่อน | **Hybrid** ← ช่องโหว่ที่ผู้ใช้ชี้ ปิดแล้ว |
| setup PL Test เดี๋ยวนี้ vs เทรน Hybrid 2 วันก่อน | PL Test ← กฎรอบ 37 ยังอยู่ |
| Hybrid พักอยู่ แต่ activity ใหม่สุด | Hybrid ← ไม่เด้งไปตัวอื่น ยังอยู่ |
| ไม่มี history + ไม่มี `activatedAt` | fallback เดิม |

**สัปดาห์ + ป้ายช้า/เร็ว** — inject progress แบบ local ล้วน (ยืนยันจาก network ว่ามีแต่ GET ไม่มี POST):

| จบไปถึง | สัปดาห์ | ป้าย |
|---|---|---|
| ยังไม่เล่น | W1 | ช้ากว่าแผน 5 สัปดาห์ |
| สัปดาห์ 1 | W2 | ช้ากว่าแผน 4 สัปดาห์ |
| สัปดาห์ 1–5 | W6 | **ไม่มีป้าย** (ตรงแผนพอดี) |
| สัปดาห์ 1–8 | W9 | เร็วกว่าแผน 3 สัปดาห์ |

**UI** — เทียบการ์ด Home กับหน้า Week วันเดียวกัน: ท่า/ลำดับ/น้ำหนักตรงกันเป๊ะ (105kg top set · 100kg back-off) ·
บันทึกสลับลำดับ + เพิ่ม accessory → การ์ด Home อัปเดตตามทันที · กด START → เข้า `/workout` id
`custom-…/week-6/day-2` ครบ 3 ส่วน (progress ยังทำงาน) · workout วันเดียวกันค้าง → ไปต่อไม่ถาม ·
Quick Session ค้าง → `confirm()` · Cancel แล้วของเดิมไม่หาย · กดเนื้อการ์ด → ไปหน้า Week ·
วันไม่มีวันซ้อม / โปรแกรมพัก → ไม่มีการ์ด · **regression รอบ 37 ผ่าน** (การ์ด PROGRAM PAUSED + ไม่เด้งไปตัวอื่น)

### ไม่ทำรอบนี้

- **ไม่แก้สูตรของหน้า Programs** (`doneWeeks + 1`, `ProgramsPage.tsx:253,361`) — เคสปกติเท่ากันอยู่แล้ว
  ต่างกันเฉพาะเคสข้ามสัปดาห์ ซึ่งอยู่ข้าง ๆ progress bar ที่ขับด้วย `doneWeeks` อยู่ ถ้าแก้จะดูขัดกันเอง
- **ไม่ทำการ์ด "REST DAY" / "NEXT SESSION"** — ผู้ใช้เลือกว่าวันที่ไม่มีวันซ้อมให้เงียบไปเลย
- **ไม่ auto-แก้ `config.startDate` จาก session แรก** — เขียนทับค่าที่ผู้ใช้ตั้งเองแบบเงียบ ๆ ไม่ควรทำ

### ⚠️ หนี้จาก e2e รอบ 37 (ตกลงกับผู้ใช้แล้วว่าปล่อยไว้)

- **`PL Test 6wk` config โดนทับ** ตอน e2e รอบ 37 (กด Start Program ทดสอบข้อ "setup ใหม่ → active")
  → `startDate` เป็น `2026-08-18` · 1RM `180/120/220` (บังเอิญตรงกับ config ของ `Hybrid` ที่ตั้งไว้เอง
  เพราะกรอกตาม placeholder) · **ค่าเดิมกู้ไม่ได้** แต่รอบนี้ทำให้ startDate แทบไม่มีผลแล้ว
  (เหลือแค่ช่วงวันที่ที่โชว์ + ตัวเลขในป้ายช้า/เร็ว) → ผู้ใช้เลือก "ปล่อยไว้"
- **`General Fitness 1W` ค้างสถานะ `paused`** จาก e2e รอบ 37 — ไม่กระทบอะไร (Hybrid เป็นตัวปัจจุบันอยู่แล้ว)
  ผลเดียวคือถ้าวันหลังถึงคิวมัน จะขึ้นการ์ด PROGRAM PAUSED ต้องกดทำต่อก่อน · กดปุ่ม ▶ 1 คลิกก็จบ

---

## 2026-08-18 — รอบ 37 (✅ SHIPPED, deploy main): MY PROGRAMS — ติดดาว + เรียงตามล่าสุด + สถานะ/พักโปรแกรม

commit `0e7f7b1` (feat)

เดิม **MY PROGRAMS ไม่มีการเรียงลำดับเลย** (`customPrograms.map()` ตรง ๆ) → `updateCustomProgram`
ใช้ `[...filter(id), program]` ทำให้**แก้โปรแกรมทีไรตกไปท้ายลิสต์** และ cloud hydrate ไม่มี `.order()`
→ **ลำดับหลัง login มั่ว ไม่คงที่** · ทั้งแอปยังไม่มีคอนเซปต์ "โปรแกรมที่ใช้อยู่" จริง —
Dashboard เดาจาก **key แรกใน `configs` ที่ยังไม่จบ** = ถ้า setup ไว้หลายอันมันสุ่มเลือก

รอบนี้ทำให้ **ติดดาวปักหมุดได้ · เรียงตามเล่น/แก้ล่าสุด · มีป้ายสถานะ · พักโปรแกรมได้**
(ซึ่งปิดบั๊ก "Dashboard สุ่มโปรแกรม" ไปในตัว)

### ⚠️ ต้องรัน SQL ก่อน deploy — **รันแล้ว 2026-08-18** ("Success. No rows returned")

```sql
alter table program_state
  add column if not exists program_meta jsonb not null default '{}'::jsonb;
```

ถ้าไม่รันก่อน → `program_state` upsert **400 ทั้งก้อน** (`syncQueue.ts` ระบุคอลัมน์แบบ explicit)
= progress/configs/customAccessories หยุด sync — **ยืนยันด้วยตาแล้วระหว่าง e2e**: ก่อนรัน SQL
console ขึ้น 400 ทุกครั้งและค่าดาว/พักหายทุก reload (เพราะ `setProgramState` เขียนทับด้วย `{}` จาก cloud)

### ทำอะไร

- **`packages/shared/src/types.ts`** — `ProgramMeta { favorite?, paused?, updatedAt?, activatedAt? }`
  + `ProgramMetaState` (map keyed by programId) · `ProgramStateSnapshot` += `programMeta?`
  ⚠️ **เก็บเป็น map แยก ไม่ใช่ field ใน `StructuredProgram`** — เพราะ built-in (`sbd-12w`) เป็น
  module constant ใน `twelveWeekProgram.ts` แก้ไม่ได้ → ถ้าเก็บในตัว program จะติดดาว/พัก built-in ไม่ได้เลย
- **`lib/programStatus.ts` (ใหม่)** — logic กลางใช้ร่วม 3 หน้า
  `getProgramStatus` (`completed` → `paused` → `active` → `not_setup`) · `sortPrograms` ·
  `pickCurrentProgramId` · `lastPlayedAt` · `PROGRAM_STATUS_STYLE`
  - **`countDoneWeeks` แก้การนับให้ถูก** — เดิมหน้า Programs ใช้ `Object.values(week).every(s => 'done')`
    ซึ่งนับสัปดาห์ 4 วันว่า "จบ" ทันทีที่วันแรกที่ log ไว้เสร็จ → **% พองเกินจริง** ตอนนี้ต้องครบทุกวัน
    (⚠️ ผลข้างเคียงที่ตั้งใจ: % ของบางโปรแกรมจะ**ลดลง** = ค่าที่ถูกต้อง ไม่ใช่ regress)
- **`store/useProgramStore.ts`** — state `programMeta` + `toggleFavorite` / `setProgramPaused` +
  helper `mergeMeta` · **ไม่ต้องเขียน `migrate`** เพราะเป็น top-level key ใหม่ในสโตร์ที่ไม่มี `partialize`
  → zustand merge ตื้นทับ initializer, user เดิม rehydrate ได้ `{}` เอง
  - `setConfig` stamp `activatedAt` + `paused: false` (**setup = เริ่มใช้ → active ทันที**)
  - `addCustomProgram`/`updateCustomProgram` stamp `updatedAt` · `addCustomProgram` **เพิ่ม `queueStateSync`**
    (เดิมไม่มี → `updatedAt` จะไม่ขึ้น cloud)
  - `removeCustomProgram`/`resetProgram` ลบ `programMeta[id]` ตาม cascade เดิม
  - `setProgramState` รับ `programMeta` → **sign-out ที่ `ProfilePage.tsx:32` เคลียร์ให้เอง ไม่ต้องแก้ไฟล์นั้น**
- **`lib/syncQueue.ts`** — `program_meta: op.payload.programMeta ?? {}`
- **`store/useAuthStore.ts`** — hydrate `programMeta: s.program_meta ?? {}` + เพิ่ม `.order('id')`
  ให้ query `custom_programs` (เดิมเป็น query เดียวในไฟล์ที่ไม่มี order)
- **`components/icons/index.tsx`** — `IconStar` (รับ `fill` → ทึบ=ติดดาว) + `IconPause`
  (ไม่ใช้ `lucide-react` ที่อยู่ใน `package.json` — ทั้ง repo ไม่เคย import และ stroke ไม่เข้าชุด custom)
- **`features/programs/ProgramsPage.tsx`** — sort + ดาว + ป้ายสถานะ + ปุ่มพัก **ทั้ง MY PROGRAMS และ
  STRUCTURED PROGRAMS** · local component `StatusPill`/`FavoriteButton`/`PauseButton` + const `CARD_BTN`
  · การ์ด built-in เปลี่ยนจาก `<button>` ครอบทั้งใบ → `div role="button"` (จะมีปุ่มซ้อนข้างใน)
  · **ปุ่มลบเพิ่ม `confirm()`** — ปิดงานค้าง 🟡
- **`features/dashboard/DashboardPage.tsx`** — memo `currentProgram` (เลือกตัว `activatedAt` ใหม่สุด
  **โดยรวมตัวที่ paused ด้วย**) + การ์ด **PROGRAM PAUSED** (ปุ่ม ทำต่อ / Programs) · `todayReminder` เงียบตอนพัก
- **`features/programs/ProgramOverviewPage.tsx`** — ป้ายสถานะในแถว pill + ปุ่มดาว/พักใน header

### ผลกระทบ (จัดการแล้ว)

- **กฎที่ผู้ใช้กำหนดเอง:** *"พักแล้วยังไม่ต้อง active โปรแกรมอื่น แต่ถ้าเริ่มโปรแกรมใหม่ต้อง active"*
  → `pickCurrentProgramId` **ไม่กรอง paused ออก** (ถ้ากรอง Dashboard จะเด้งไปโปรแกรมถัดไปทันที)
  แล้วให้ Dashboard เรนเดอร์การ์ด paused แทน · `setConfig` stamp `activatedAt` ใหม่สุด = ตัวใหม่ชนะเอง
- **user เดิมไม่มี `activatedAt`** → `pickCurrentProgramId` fallback ไปวน `Object.keys(configs)` แบบเดิมเป๊ะ
  = อัปเกรดแล้ว Dashboard ไม่ขยับ
- **weekly routine** ยังไม่ถูกเลือกเป็น current (ไม่มี config) — คงพฤติกรรมเดิมโดยตั้งใจ ไม่ใช่ regress
- **`programMeta` โดนทับตอน login ถ้า cloud ยังไม่มีค่า** — เป็นพฤติกรรมเดียวกับ progress/configs
  (cloud เป็น source of truth ตอน login) ไม่ใช่บั๊กใหม่ แต่หมายความว่า**ต้องรัน SQL ก่อน deploy จริง ๆ**

### verify

`pnpm build` ผ่าน (118 modules) · ESLint exit 0 · **e2e Playwright 390px, 0 console errors**
(บัญชีจริง 9 custom programs + built-in `12 Weeks SBD`)

- `POST program_state` **400 → 200** หลังรัน SQL · ติดดาว+พัก → **reload แล้วรอดครบ** (ดึงกลับจาก cloud)
- ติดดาว `Public PPL` (ตัวล่างสุด) → **เด้งขึ้นอันดับ 1 ทันที**
- ติดดาว **`12 Weeks SBD` (built-in)** ได้ → `programMeta['sbd-12w'].favorite = true` — **ข้อพิสูจน์ว่า map แยกจำเป็น**
- พัก `General Fitness 1W` → Dashboard โชว์ **PROGRAM PAUSED** และ **ไม่เด้งไป `Hybrid`/`PL Test 6wk`
  ที่เป็น ACTIVE อยู่** · แบนเนอร์ today reminder หาย
- Setup `PL Test 6wk` → Dashboard สลับเป็น **ACTIVE PROGRAM | PL Test 6wk** ทันที
- กด **ทำต่อ** → กลับ ACTIVE + re-stamp `activatedAt`
- Edit `Public PPL` → Save → **ท้ายสุด → อันดับ 2** (เดิมตกไปท้ายลิสต์)
- ปุ่มลบ → `confirm()` ขึ้น · กด Cancel → โปรแกรมอยู่ครบ 9 ตัว
- ลำดับสุดท้าย: `★ PL Squat` → `Public PPL` (เพิ่งแก้) → `PL Test 6wk` (เพิ่ง setup) → ที่เหลือเรียงชื่อคงที่

### ไม่ทำรอบนี้

- **ไม่แตก `ProgramCard` component** — การ์ด built-in/custom ยังเป็นสำเนากันอยู่ (ดึงแค่บล็อกคำนวณ
  เข้า `programStatus.ts`) · หน้าเดียวมีการ์ด 4 แบบ เสี่ยง regress เกินคุ้มในรอบนี้
- **ไม่มี flow "เลือกโปรแกรมหลัก" แบบ explicit** — ตัดสินใจร่วมกับผู้ใช้ว่าใช้สถานะที่**คำนวณอัตโนมัติ**
  + ปุ่มพัก ก็พอ ไม่ต้องเพิ่ม `activeProgramId`
- **ไม่แตะ `version`/`migrate` ของ persist** (งานค้าง 🟡 ยังเปิดอยู่) — รอบนี้เลี่ยงได้เพราะเป็น top-level key ใหม่
- `Hybrid_Powerlifting-Template.xlsx` ที่ค้าง untracked ใน repo root **ไม่ได้ commit** (ไม่เกี่ยวกับรอบนี้)

---

## 2026-08-10 — รอบ 35 (✅ SHIPPED, deploy main): Quick Session — เริ่มเทรนจากหน้า EXERCISES ได้ทันที

commit `fdab3bb` (feat)

เดิมจะเริ่มเทรนต้องผ่านโปรแกรมเสมอ (เลือกโปรแกรม → สัปดาห์ → วัน → START) หรือกด Quick Template
ที่หน้า Programs ซึ่งเป็นชุดตายตัว 3 แบบ. รอบนี้เพิ่มปุ่ม **QUICK** ที่หัวหน้า Library → กดแล้ว
**เริ่มเซสชันเปล่าทันที** แล้วค่อยหยิบท่าเติมระหว่างเทรน — เหมาะกับวันที่เข้ายิมแล้วค่อยคิดว่าจะทำอะไร

### ทำอะไร

- **`lib/data.ts`** — `QUICK_PROGRAM` template เปล่า (`exercises: []`)
  ⚠️ **id ต้องเป็น `'quick'` ห้ามมี `/`** — `LoggerPage.tsx:47` ทำ `programId.split('/')` แล้วถ้าได้ 3 ชิ้น
  จะไปเขียน `setDayStatus()` ของโปรแกรมจริง · `'quick'` แตกได้ 1 ชิ้น → ข้าม branch นั้นพอดี
- **`logger/EmptyWorkout.tsx` (ใหม่)** — สถานะที่ `LoggerPage` ไม่เคยมีจอรองรับ: workout รันอยู่แต่ยังไม่มีท่า
  header + ● RECORDING · ปุ่ม **Add Exercise** (เปิด `SwapSheet` ตัวเดิม) · ปุ่ม Browse Library · X = ทิ้งเลยไม่ต้อง confirm (ยังไม่มีอะไรให้เสีย)
- **`logger/LoggerPage.tsx`** — แยก guard เดิม `if (!workout || !cur) return null` เป็น 2 เคส:
  ไม่มี workout → `<Navigate to="/" replace/>` · มีแต่ยังว่าง → `<EmptyWorkout/>`
  (**ปิดบั๊กเก่าไปด้วย** — ข้อ "`/workout` เมื่อไม่มี workout = จอว่างตัน" ใน review รอบ 30)
- **`library/LibraryPage.tsx`** — ปุ่ม `IconBolt` **QUICK / RESUME** (ทุกคนเห็น ไม่ใช่แค่ coach)
  handler กัน 3 เคส: quick ค้างอยู่ → resume · โปรแกรมอื่นค้างอยู่ → `confirm()` ก่อนทับ · ไม่มีอะไร → เริ่มใหม่
  (ปิดข้อ "ปุ่ม START ทับ workout ค้าง ไม่มี confirm" ของ review รอบ 30 เฉพาะทางเข้านี้)
- **`logger/FinishReview.tsx`** — `disabled={setCount === 0}` + opacity 0.4 กัน session ว่างที่ลบไม่ได้ใน History

### ได้ฟรี ไม่ต้องเขียน

- **เพิ่มท่าจากหน้ารายละเอียด** — `ExerciseDetailPage.tsx:122` เช็ค `{workout ? ...}` อยู่แล้ว
  พอมี quick session ปุ่ม "Add to current workout" โผล่เอง → **ไม่ได้แตะไฟล์นี้เลย**
- **`addExerciseToWorkout` / ปุ่ม + Add ใน logger / `SwapSheet`** — มีครบอยู่แล้วตั้งแต่รอบก่อน
- **Dashboard / History** — quick session เข้า `history` ปกติ นับ volume/calories เอง ·
  `DashboardPage.tsx:117` วนจาก `configs` ไม่ใช่ `session.programId` → `'quick'` ไม่โผล่ผิดที่ในการ์ดโปรแกรม

### ผลกระทบ (จัดการแล้ว)

- **ไม่ต้องแตะ Supabase** — `sessions.program_id` เป็น `text` เฉย ๆ **ไม่มี FK constraint**
  (`SUPABASE_SETUP.md:18`) → `program_id = 'quick'` upsert ผ่าน ไม่ต้อง migration
- **progress โปรแกรมจริงไม่ขยับ** — ยืนยันด้วย e2e ว่า `split('/')` branch ไม่โดน trigger
- **`prevSets` ได้ผลพลอยได้** — `history.find(h => h.programId === workout.programId)` ทำให้ quick session
  ครั้งถัดไปเห็นน้ำหนักครั้งก่อนเป็น reference อัตโนมัติ

### verify

`pnpm build` ผ่าน (117 modules) · ESLint ผ่าน exit 0 ·
**e2e จริง Playwright 390px, 0 console errors ทุกหน้า** (inject auth ตามวิธีรอบ 26 — revert `main.tsx` แล้ว diff ว่าง):

1. กด QUICK → เข้า `/workout` เห็นหน้า "ยังไม่มีท่า" **ไม่ใช่จอขาว**
2. Add Exercise → Bench Press → เข้า logger ปกติ `0/1 SETS`
3. ไป `/library/squat` → ปุ่ม "Add to current workout" โผล่ → กด → 2 ท่า `programId: 'quick'`
4. กลับ Library กด **RESUME** → เซ็ตที่ติ๊กไว้อยู่ครบ ไม่รีเซ็ต · `startTime` เดิม
5. มีโปรแกรมจริงค้าง (`custom-999/week-1/day-1`) → กด QUICK → เด้ง confirm ·
   **Cancel = เวิร์กเอาต์เดิมอยู่ครบ ไม่ navigate** · Accept = ทับตามที่สั่ง
6. 0 เซ็ต → FINISH → ปุ่ม Confirm `disabled: true, opacity 0.4`
7. ติ๊ก 90kg×8 → Confirm → History ขึ้น "Quick Session" `volume 720, setCount 1` · Dashboard WEEKLY VOLUME 720
8. progress โปรแกรมจริงก่อน/หลังเหมือนเดิมเป๊ะ ไม่มีคีย์ `quick` โผล่ใน progress

ล้างข้อมูลทดสอบแล้ว (cancel workout + ลบ session ทดสอบออกจาก history)

### ไม่ทำรอบนี้

- **ไม่ได้ verify row จริงในตาราง `sessions` บน Supabase** — e2e ใช้ user ปลอมที่ inject เข้าไป
  ไม่มี session จริงให้ sync · ยืนยันได้แค่ระดับ schema ว่า `program_id text` ไม่มี FK
  → ถ้าจะปิดข้อนี้ต้อง login จริงแล้วเทรน quick 1 รอบ แล้วดูตารางใน Supabase dashboard
- **ไม่เซฟ quick session เป็น template** — ตัดสินใจแล้วว่าลง History อย่างเดียว
- ไม่มีปุ่ม QUICK ที่ Dashboard/BottomNav — เข้าทาง Library ทางเดียวก่อน

---

## 2026-08-10 — รอบ 36 (✅ SHIPPED, deploy main): ปิดงานค้าง — layout ไม่รีเซ็ตตอน Save โปรแกรม + ลบไฟล์ขยะที่หลุดเข้า build

commit `7fcaabe` (fix)

เก็บ **WIP ที่ค้างใน working tree ตั้งแต่ 8 ส.ค.** (เขียนไว้หลัง ship รอบ 34 แล้วไม่ได้ test/commit)
คือแก้ ⚠️ caveat ที่รอบ 34 จดไว้เอง: *"กด SAVE CHANGES ในหน้า Edit Program จะ reassign exercise id
ใหม่แบบ positional → layout ที่จัดไว้ของวันนั้นจะ reset"* พร้อมลบไฟล์ขยะ e2e ที่หลุดเข้า `dist/`

### ทำอะไร

- **`CreateProgramPage.tsx`** — `ExerciseDraft` เพิ่ม `originIdx` (index ของแถวในโปรแกรมที่กำลังแก้)
  ตอน save หา id เดิมจาก `editing.weeks[wi].days.find(d => d.id === ...).exercises[originIdx].id`
  → **หา id ใน week นั้น ๆ ไม่ใช่ week 1 เสมอ** เพราะ Excel import ใส่ id คนละตัวต่อสัปดาห์
  (`w1-Mon-e0` vs `w2-Mon-e0`) · fallback: `ex.id` (id ของ week 1) → mint ใหม่ `${dayId}-n${stamp}-${ei}` สำหรับแถวที่เพิ่งเพิ่ม
- **`lib/dayLayout.ts`** — `sameRow(a, b)` guard: ถ้า id ที่ layout เก็บไว้ไม่ได้ชี้ไปท่าเดิมแล้ว
  ให้ตกไปเรียงตามโปรแกรมท้ายลิสต์ แทนที่จะ**สลับเงียบ ๆ เป็นท่าผิด**
  ⚠️ เทียบ `exerciseId` + `name` + `label` — **`exerciseId` อย่างเดียวไม่พอ** เพราะ top set กับ back-off ใช้ร่วมกัน
- **`.gitignore`** — เพิ่ม `apps/web/public/__*.json` + ลบ `apps/web/public/__restore.json` (23 KB)
  ไฟล์ restore ที่ใช้ตอน e2e รอบ 34 วางไว้ใน `public/` → **ถูกก็อปเข้า `dist/` ทุกครั้งที่ build**
  ถ้า deploy ไปจะเปิดสาธารณะที่ `https://<domain>/__restore.json` โดยไม่ต้องล็อกอิน

### verify

`pnpm build` ผ่าน (117 modules) · ESLint ผ่าน exit 0 · `ls dist/` ยืนยันว่า `__restore.json` หายแล้ว ·
**e2e จริง Playwright 390px, 0 console errors** กับ `Hybrid Powerlifting Template` (Excel, 12 สัปดาห์):

- ตั้ง layout ของ `week-1/day-1` เป็น `[Deadlift, Squat Top set, Squat Back-off]` (สลับจากลำดับโปรแกรม)
  → เปิด Edit Program → **Save changes** → หน้า Week ยังโชว์ **Deadlift ขึ้นก่อน** ตามที่จัดไว้
  น้ำหนักแยกถูก 135kg / 125kg (weightOverrides ไม่ปนกัน) · วัน Tue/Thu/Fri ไม่กระทบ
- **id รอดทุกสัปดาห์** — week 1 = `w1-Mon-e0/e1/e2`, week 2 = `w2-Mon-*`, week 12 = `w12-Mon-*`
  (ไม่ถูก re-mint เป็น `day-1-e*` แบบเดิม และแต่ละสัปดาห์ยังเก็บ id ของตัวเอง = จุดที่ `weeks[wi]` lookup แก้)
- **`sameRow` guard** — จงใจแก้ layout ให้ `w1-Mon-e0` อ้างว่าเป็น bench → แถวนั้นถูกปฏิเสธ
  แล้วท่าจริง (Squat Top set) ไปต่อท้าย · ยังครบ **3 exercises** ไม่หาย ไม่ซ้ำ ไม่โชว์ท่าผิด

ล้างข้อมูลทดสอบแล้ว (ลบ layout ของ `custom-1783938627466/week-1/day-1` → กลับเป็นลำดับโปรแกรมเดิม)

### ไม่ทำรอบนี้

- **ไม่ได้แก้ `exercises[originIdx]` กรณีสัปดาห์มีจำนวนท่าไม่เท่ากัน** — ถ้า week N มีท่าน้อยกว่า week 1
  จะ fallback ไปใช้ id ของ week 1 (ไม่ชนกันเพราะ id ฝัง week number) แต่ยังไม่ได้ทดสอบเคสนี้จริง
- ไม่แตะข้อ 🔴 ที่เหลือใน `docs/code-review-2026-07-13.md` — ดูรายการค้างข้างล่าง

---

## 📌 งานค้าง — ตรวจกับโค้ดปัจจุบันแล้ว 2026-08-10 · อัปเดตสถานะ 2026-08-18 (รอบ 37)

> ⚠️ `docs/code-review-2026-07-13.md` **stale** — รอบ 31 เขียน `excelImport.ts` ใหม่ ทำให้ข้อ 🔴 เรื่อง Excel
> (sets/reps/pct/id ชนกัน) **ปิดไปแล้วทั้งหมด** แต่ไม่มีใครติ๊ก · รายการข้างล่างคือที่ verify แล้วว่ายังเปิดอยู่จริง

| ระดับ | ข้อ | ผลกระทบถ้าไม่ทำ |
|---|---|---|
| 🔴 | reps ทศนิยมจาก **Create Program** → `rpeTable.ts:21` `RPE_TABLE[1.5]` = undefined | **จอขาวถาวร** บนหน้า Week + Dashboard (ทางเข้า Excel ปิดแล้ว แต่ input `type="number"` ไม่มี `step` ยังพิมพ์ `2.5` ได้ · `CreateProgramPage.tsx:579,588` `Number(reps)` ไม่กรองจำนวนเต็ม) — แก้ 2 ชั้น: `Math.round()` ใน `getRpePct` + validate ฝั่ง input |
| 🔴 | sync data-loss 4 ตัว | (a) `syncQueue.ts:211/236` flush เขียนทับ op ที่ต่อคิวระหว่าง flush · (b) `:149/225` entry `userId: null` ยังไปโผล่บัญชีคนถัดไป · (c) `useProgramStore.ts:46` debounce timer ยิงหลัง sign-out → snapshot ว่าง (รวมกับ (b) = ทับ progress คนถัดไป) · (d) `useAuthStore.ts:166/182` `loadUserData` แข่ง `flushQueue` → `setHistory` ทับเซ็ตที่ log offline (`[]` ก็ truthy) |
| 🟡 | แก้โปรแกรม Excel → periodization ของ **accessory** หาย | `weekly[]` เก็บรายสัปดาห์เฉพาะ `powerlifting && type === 'main'` · accessory ที่ pct ไต่รายสัปดาห์ + วัน/ท่าที่มีเฉพาะสัปดาห์หลัง + โปรแกรม `general` หายตอนกด Save |
| ~~🟡~~ | ~~ลบ custom program ไม่ confirm~~ | ✅ **ปิดแล้วรอบ 37** — เพิ่ม `confirm()` ใน `ProgramsPage` |
| 🟡 | persist ไม่มี `version`/`migrate` — `useAppStore.ts:198`, `useProgramStore.ts:233` | วันนี้ยังไม่พัง แต่**ใส่ทีหลังไม่ได้** (zustand ถือ state ที่ไม่มี version = version 0) |
| ⚠️ | coach edge function เปิดให้ harvest อีเมล — `supabase/functions/coach/index.ts:47-59` | **ยืนยันว่าเปิดอยู่จริงบน prod**: `resolveUser` match ด้วย prefix ของ UUID (`startsWith`) + ทั้งไฟล์ไม่เช็ค `profiles.role` เลย + `add-athlete` คืน `athleteEmail` เสมอ → authed คนไหนก็ไล่ prefix ดึงอีเมลได้ · **ตัดสินใจแล้วว่ายังไม่แตะ** (ต้อง deploy edge function แยก) |

---

## 2026-08-08 — รอบ 34 (✅ SHIPPED, deploy main): ปรับลำดับท่าในวันซ้อมได้อิสระ (main + accessory)

commit `97dd9f1` (feat)

เดิมสลับลำดับได้เฉพาะหน้า Create/Edit Program ส่วน `AccessoryEditSheet` มีแค่เพิ่ม (ต่อท้ายเสมอ) / ลบ
และ `WeekDays.handleStart` บังคับเรียง main-ก่อน-acc ตอนส่งเข้า logger รอบนี้ทำให้**ลากสลับได้ทุกแถวทั้งวัน** —
accessory ขึ้นก่อน main หรือแทรกกลางได้ ทั้งตอนวางแผนและระหว่างเทรน โดย**ไม่แตะ schema Supabase เลย**

### ทำอะไร

- **`components/ReorderList.tsx` (ใหม่)** — drag-to-reorder กลาง (pointer events, touch + mouse, ไม่ใช้ lib)
  ยกมาจากที่ `CreateProgramPage` เขียน inline · props `items/getKey/onReorder/renderRow/groupId/rowStyle` ·
  `groupId` กันลากข้ามลิสต์ (เช่นข้ามวันในหน้า Create) · `onReorder` เก็บใน ref + `useEffect` (กัน lint `react-hooks/refs`)
- **`lib/dayLayout.ts` (ใหม่)** — `dayRowKey(ex, i)` + `resolveDayExercises(day, stored)`
  รวมลำดับที่ผู้ใช้บันทึกเข้ากับท่าในโปรแกรม · แถว main **ดึงค่าสดจากโปรแกรมเสมอ** (เก็บแค่ลำดับ) ·
  running ไม่เข้าลำดับ · ทุกแถวที่คืนมาถูก stamp `id` เพื่อใช้เป็น key ของ `weightOverrides`
- **`DayEditSheet.tsx`** (rename จาก `AccessoryEditSheet.tsx`) — แสดง main ด้วย ลากได้ทุกแถว ·
  ปุ่มลบเฉพาะ accessory (main ลากได้แต่ลบไม่ได้ คงสัญญาเดิม) · pill `MAIN`/`ACC` · หัวข้อเปลี่ยนเป็น `Exercises`
- **`logger/ReorderSheet.tsx` (ใหม่)** — ปุ่ม `IconGrip` ข้างปุ่ม Swap เปิด sheet ลากสลับระหว่างเทรน ·
  บันทึกแล้ว `currentIdx` วิ่งตามท่าที่กำลังทำ (match ด้วย `ex.id`) · ลำดับนี้ ephemeral ไม่เขียนทับ layout ของโปรแกรม
- **`WeekDays.tsx`** — `handleStart` ตัด `[...mains, ...customAcc]` ทิ้ง ใช้ `ordered` ตรง ๆ ·
  `DayCard` รวม MAIN/ACCESSORIES เป็นลิสต์เดียว eyebrow `EXERCISES` (จุด accent = main) preview 5 แถว + `+N more`
- **`useProgramStore.ts`** — rename action → `getDayLayout`/`setDayLayout`
- **`CreateProgramPage.tsx` / `utils.ts`** — ใช้ `ReorderList` + `moveItem` ร่วมกัน ลบ drag ที่เขียนซ้ำ (~35 บรรทัด)

### ผลกระทบ (จัดการแล้ว)

- **ไม่ต้องทำอะไรใน Supabase** — ชื่อ state ที่ persist ยังเป็น `customAccessories` เหมือนเดิม
  (localStorage `atlas:v1:program-progress` + คอลัมน์ `custom_accessories jsonb`) เปลี่ยนแค่ "เนื้อใน" ของ JSON
  คือมีแถว `type:'main'` ปนได้ · `syncQueue.ts:89` / `useAuthStore.ts:98` / RLS ไม่ต้องแตะ
- **ข้อมูลเก่าปลอดภัย** — `resolveDayExercises` เช็คว่ามีแถว `main` ไหม ถ้าไม่มี = payload เก่า → เรียง main-ก่อน-acc เหมือนเดิมเป๊ะ
- **built-in 12-week ไม่มี `ex.id`** (`twelveWeekProgram.ts` สร้าง object เปล่า) → `dayRowKey` fallback เป็น
  `exerciseId|name|index` ซึ่งแยก "Back Squat" กับ "Back Squat Back-off" ได้
- **แก้โปรแกรมหลังจัดลำดับ** — main ที่ถูกลบจะ drop, main ที่เพิ่งเพิ่มไปต่อท้าย
  ⚠️ กด SAVE CHANGES ในหน้า Edit Program จะ **reassign exercise id ใหม่แบบ positional** (`${dayId}-e${idx}`)
  → layout ที่จัดไว้ของวันนั้นจะ reset กลับเป็นลำดับตามโปรแกรม (ไม่พัง ไม่ซ้ำ แค่ต้องจัดใหม่)
- **weightOverrides ไม่ปนกัน** — ยังคีย์ด้วย `ex.id ?? exerciseId:rpe` เหมือนเดิม Top set + Back-off ของท่าเดียวกันได้น้ำหนักคนละค่า

### verify

- `pnpm build` ผ่าน (116 modules) · ESLint ผ่าน exit 0
- **logic test 10 เคสผ่านหมด** (`resolveDayExercises`): ไม่มี layout / payload เก่า / interleaved order /
  main ถูกลบ+เพิ่ม / ค่า main สดจากโปรแกรม / excel id สลับไม่ปน / running ถูกกรอง / ทุกแถวมี id
- **e2e 390px, 0 console errors** (Playwright + inject auth ตามวิธีในหน่วยความจำรอบ 26 — revert `main.tsx` แล้ว):
  - Create/Edit Program (`Hybrid Powerlifting Template`, 4 วัน 9 แถว) → ลาก Squat Top set จาก idx 0 → 2 สำเร็จ ·
    ลากข้ามวัน (day-0 → day-1) **ถูกบล็อก** ตามที่ตั้งใจ · SAVE CHANGES แล้ว per-week scheme วิ่งตามท่าที่ย้าย
    (w1 `1x5@0.75` = w6 `1x2@0.88` ยังอยู่แถวเดียวกัน) · วันอื่นไม่กระทบ
  - Day Edit sheet → เพิ่ม Face Pull → ลากขึ้นบนสุด → Save → การ์ดแสดง Face Pull ก่อน main ·
    Start → logger เรียง `Face Pull / Squat 135kg / Squat 125kg / Deadlift 155kg` (น้ำหนักแยกถูกต้อง)
  - Logger reorder → ติ๊ก 2 เซ็ตของ Face Pull → ลาก Deadlift ขึ้นบนสุด → Save → `currentIdx` 0→1 หัวข้อยัง Face Pull ·
    เซ็ตที่ติ๊กครบ `2/11 SETS`
- ล้างข้อมูลทดสอบแล้ว (ลบ layout ของ `custom-1783938627466/week-1/day-1`, คืนลำดับโปรแกรมเดิม, cancel workout)

### ไม่ทำรอบนี้

- **touch-drag e2e** — Playwright ยิงได้แค่ mouse pointer; `touchAction:'none'` + pointer events เป็นโค้ดชุดเดียวกับที่ ship ไปแล้วรอบก่อน
- **ลบ main ออกจาก DayEditSheet** — คงสัญญาเดิมว่าแก้โครงสร้างโปรแกรมต้องไปหน้า Edit Program
- **จำลำดับ logger กลับเข้า layout ของโปรแกรม** — เจตนาให้เป็นของ session นั้น ๆ
- **แก้คอมเมนต์ `SUPABASE_SETUP.md:111`** ที่ยังเขียนว่า "custom accessories" (ความหมายกว้างขึ้นเป็น "ลำดับท่าในวัน")

---

## 2026-07-20 — รอบ 33 (✅ SHIPPED, deploy main): ย้าย Deadlift Focus day ของ 12-week เสาร์ → ศุกร์

commit `513c16d` (feat)

โปรแกรม built-in `12 Weeks SBD Peaking` (`sbd-12w`) ย้ายวันฝึกที่ 4 (Deadlift Focus ทุกสัปดาห์ +
Competition Day ใน Week 12) จากวันเสาร์เป็น**วันศุกร์**ทุกสัปดาห์ ตามที่ผู้ใช้ขอ (ยืนยันให้ย้าย Week 12 ด้วย)

### ทำอะไร
- `twelveWeekProgram.ts` — helper `sat()` → `fri()` + `dayOfWeek: 'Sat'` → `'Fri'` (จุดเดียวคุมทั้ง 12 สัปดาห์) · แทน call site `sat([` → `fri([` ทั้ง 12 จุด · อัปเดตคอมเมนต์โครงสร้าง `Sat=DL+SquatVol` → `Fri=`
- **คง `id: 'day-4'` ไว้เหมือนเดิม** — เป็น key ที่ progress/accessories ที่ persist ผูกอยู่

### ผลกระทบ (จัดการแล้ว)
- Progress / custom accessories / config เดิม **ไม่หลุด** — ทุกอย่าง key ด้วย `dayId = 'day-4'` ไม่ใช่ชื่อวัน (ไม่มี migration ผูกกับ dayOfWeek)
- น้ำหนักคำนวณสดจาก `exerciseId:rpe` ทุกครั้ง (ท่า built-in ไม่มี `ex.id`) → ไม่มี override ค้าง · id แบบ `w{week}-{Day}-e{idx}` ใช้เฉพาะโปรแกรม import Excel ไม่ใช่ built-in
- ลำดับวันในหน้า Week ยังเรียง Mon → Tue → Thu → Fri (ตาม array order พอดี ไม่ต้องจัดใหม่)
- Dashboard reminder banner เด้งวันศุกร์แทนเสาร์ (ผลที่ตั้งใจ) · `DAY_SHORT`/`DAY_FULL` มี Fri อยู่แล้ว ไม่ต้องแก้
- ประวัติ session เก่าที่จดไว้ยังโชว์ชื่อ freeze `"Sat — Deadlift Focus"` = cosmetic เท่านั้น ไม่กระทบการทำงาน

### verify
`pnpm build` ผ่าน (113 modules) · ESLint ผ่าน · ทดสอบ output จริงโดย transpile โมดูลแล้วเรียก `dayToProgram`
กับทั้ง 12 สัปดาห์ → day-4 ขึ้น `"Fri — Deadlift Focus"` (Week 12 = `"Fri — Competition Day"`), `id: 'day-4'`
คงเดิม, ไม่เหลือ `'Sat'` · **ยังไม่ได้ click-through e2e ใน browser** (ติด login gate ที่ต้องมี Supabase session จริง —
เลือกทดสอบระดับโมดูลแทนเพราะเป็นการแก้ค่า string ที่ไหลเข้า template literal ตรง ๆ)

### ไม่ทำรอบนี้
- ไม่แตะ Excel importer (`excelImport.ts`) — คนละ flow, id ที่ฝังชื่อวันใช้กับ import เท่านั้น · ไม่ commit `Hybrid_Powerlifting-Template.xlsx` (ไฟล์ local ไม่เกี่ยวรอบนี้)

---

## 2026-07-15 — รอบ 32 (✅ SHIPPED, deploy main): Swap Exercise แล้วชื่อท่าไม่เปลี่ยนตาม

ตอน Swap Exercise ในหน้า Logger ชื่อท่าค้างเป็นชื่อเดิม แต่ประเภท (group) เปลี่ยนถูก —
เช่น swap `Bulgarian Split Squat` (Legs) → `Cable Fly` (Chest) แล้วหัวข้อยังโชว์ "Bulgarian Split Squat"
ทั้งที่ pill เป็น Chest แล้ว. History แสดงถูกอยู่แล้ว (คนละ code path).

### สาเหตุ
- `WorkoutExercise` มี `name`/`label` เป็น override ที่ก็อปมาจากโปรแกรมตอน `startWorkout`
- swap handler (`LoggerPage.tsx`) อัปเดตแค่ `exerciseId` → `name`/`label` เดิมค้าง
- Logger header (`cur.name ?? exMeta.name`) + tab list + `FinishReview` ใช้ override ที่ค้าง → โชว์ชื่อเก่า
- แต่ group pill ดึงจาก `getExercise(cur.exerciseId).group` (id เปลี่ยนแล้ว) → เปลี่ยนถูก = ที่มาของอาการ "ชื่อไม่เปลี่ยน ประเภทเปลี่ยน"
- `HistoryPage` resolve ชื่อจาก `getExercise(exId).name` ตรง ๆ (ไม่สน override) → เลยถูกมาตลอด

### ทำอะไร
- `LoggerPage.tsx` swap `onPick`: เคลียร์ `name: undefined, label: undefined` ตอนสลับ id → display fallback ไปชื่อจริงของท่าใหม่ (ตรงกับที่ History ทำ)
- คง `targetRpe`/`isMain`/sets ไว้ (เป็นการกำหนดของ slot ไม่ใช่ตัวท่า)

### verify (e2e จริง Playwright 390px, 0 console errors)
inject workout `exerciseId: leg-press` + name ค้าง "Bulgarian Split Squat" + label → swap เป็น Cable Fly:
header/tab/FinishReview/History โชว์ "Cable Fly" ตรงกันหมด · group Legs→Chest · label หาย · sets 40×10 + RPE 8 คงอยู่ ·
`pnpm build` ผ่าน (113 modules)

### ไม่ทำรอบนี้
- ไม่แตะ `addExerciseToWorkout` (ไม่เคยตั้ง name/label อยู่แล้ว ไม่มีบั๊ก) · ไม่แตะ picker ใน `CreateProgramPage` (คนละ flow)

---

## 2026-07-13 — รอบ 31 (✅ SHIPPED, deploy main): รองรับ import template แบบ Hybrid Powerlifting

commit `7536231` (feat) + `757aa0e` (docs)

import รองรับ layout ของ `Hybrid_Powerlifting-Template.xlsx` (sheet เดียวชื่อ `Template`,
header Title Case, `Lift`/`Variant`/`Prescription`/`Type`=Work/Test, ไม่มี Meta) โดย **ยังรองรับ
format เดิม (Program+Meta) ได้ด้วย** — แผนเต็ม: **`docs/excel-hybrid-import-plan.md`**, คู่มือ: `docs/excel-import-guide.md`

### การตัดสินใจที่ยืนยันแล้ว
- **Format:** รับทั้ง 2 แบบ — normalization layer เดียว auto-detect (ไม่พังของเดิม)
- **ชื่อโปรแกรม:** default จากชื่อไฟล์ + แก้ได้ตอน setup (Hybrid ไม่มี Meta)
- **Variant/Prescription:** เพิ่มฟิลด์ `label?` ใน `StructuredExercise` แสดงเป็น sub-text ("Competition · Top set")

### ทำอะไร
- `excelImport.ts` (rewrite): อ่าน header จริง (row 1) + alias map (Title Case↔lowercase) · หา sheet ยืดหยุ่น
  (`Program`→`Template`→sheet แรกที่ header ครบ) · Meta optional · Lift dictionary (Squat→squat) ·
  Type Work/Test/ว่าง→main · phase `Taper/Test`→`Taper` · coercion เข้ม (sets int 1–50, reps int/AMRAP,
  pct 0–1.1 ยอม attempt, rpe non-numeric `<6.0`→note) · ใส่ `id` ต่อแถว `w{week}-{Day}-e{i}` · gen `label`+`focus`
- `types.ts`: เพิ่ม `label?` ใน `StructuredExercise`/`ProgramExercise`/`WorkoutExercise`
- thread `label`: `dayToProgram` + `useAppStore.startWorkout` · แสดงใน `WeekDays`/`LoggerPage`/`FinishReview`
- `ImportProgramSheet`: ช่องแก้ชื่อโปรแกรม + hint ใหม่ (2 format) + preview โชว์ตัวอย่างวันแรกพร้อม label
- template ที่แจก (`public/atlaslog-program-template.xlsx`): gen ใหม่เป็น Hybrid format แบบ compact (3 wk ตัวอย่าง + AMRAP + attempt 1.02)
- อัปเดต `docs/excel-import-guide.md` + `CLAUDE.md`

### verify (e2e จริง Playwright 390px, debug hook ใน main.tsx แล้ว revert, 0 console errors)
Node unit: parse `Hybrid_Powerlifting-Template.xlsx` → 12 wk (W11=3d, W12=2d), phase A/I/P/T ถูก, id ไม่ซ้ำ 0 วัน,
`<6.0`→note, `1.02` ผ่าน · regression: old format (Program+Meta) + ไฟล์ Thai days (`จันทร์`, `%1RM`) parse ผ่าน ·
E2E: import→preview (label Top set/Back-off แยก)→แก้ชื่อ→setup 1RM 180/120/220→overview (variable days)→
week 1: Squat Top set **135kg** vs Back-off **125kg** (คนละค่า = collision fixed), Deadlift 155kg →
logger: chip + title โชว์ label, set 1 prefill 135×5 · `pnpm build` + ESLint ผ่าน

### เกี่ยวข้องกับรอบ 30
เคลียร์บั๊กกลุ่ม Excel ของรอบ 30 ไปพร้อมกัน: A1/A2/A4/A6/B1 (validation) + A3/M2 (override key ชนกัน)

---

## 2026-07-13 — รอบ 30 (📋 PLANNED): แก้ตาม senior code review

รีวิวเต็ม 4 ด้าน (state/sync, domain logic + Excel import, security, UI flows) — รายงาน + backlog ติ๊กได้
อยู่ที่ **`docs/code-review-2026-07-13.md`** (ทุกข้อ verify กับโค้ดจริงแล้ว, อ้าง `file:line`)

### ต้องแก้ก่อนปล่อยจริง (🔴 สูง)
- **Sync data-loss 4 ตัว** (`syncQueue.ts`, `useProgramStore.ts`, `useAuthStore.ts`): op ต่อคิวระหว่าง flush
  ถูกเขียนทับ · op ตอน sign-out (userId null) sync เข้าบัญชีคนถัดไป · debounce timer + sign-out ล้าง
  program_state เป็นค่าว่างบน cloud · `loadUserData` แข่ง `flushQueue` → cloud เก่าทับ local ใหม่
- **Excel import** (`excelImport.ts`, `rpeTable.ts`, `WeekDays.tsx`): reps ทศนิยม → crash จอขาว (render path) ·
  pct ไม่ตรวจช่วง (75 แทน 0.75 = 13,500 kg) · คีย์ override ชนกัน (back-off prefill = top set) ·
  แก้โปรแกรม import → regenerate ทุกสัปดาห์จาก week 1 (periodization หาย)
- **UI** : ปุ่ม Continue/START ทับ workout ค้าง ไม่มี resume · ลบ custom program แตะเดียวไม่ confirm
- **Security**: coach function harvest อีเมลผู้ใช้ทุกคน (UUID-prefix + ไม่เช็ค role)

### แก้รอบถัดไป (🟡 กลาง — เด่น)
- calories หายตอน round-trip cloud · ไม่มี retry limit (op fail วนไม่จบ) · `flushing` guard ตั้งหลัง await ·
  SIGNED_OUT ไม่ล้าง store · persist ไม่มี version/migrate · sets ไม่จำกัดเพดาน · วันที่คำนวณ UTC (off-by-one ไทย) ·
  week นับ done หลังทำวันเดียว · `shared_programs` SELECT `using(true)` · coach ไม่เช็ค role ฝั่ง server

### สิ่งที่ยังไม่มีเลย
- **ไม่มี unit test / E2E สักไฟล์** — target คุ้มสุด: `flushQueue`, `parseExcelFile`, RPE math, date helper (ดูรายละเอียดในไฟล์รีวิว)

> รายละเอียดเต็ม + วิธีแก้ทีละข้อ + ✅ จุดที่ตรวจแล้วปลอดภัย → `docs/code-review-2026-07-13.md`

---

## 2026-07-13 — รอบ 29 (✅ SHIPPED, deploy main): RPE รายสัปดาห์ในตาราง WEEK TEMPLATE (Create Program)

เพิ่มคอลัมน์ **RPE ต่อสัปดาห์** ในตาราง Set/Rep/%1RM ของท่า main (powerlifting) — ต่อยอดจากรอบ 26 ที่ทำ
set/rep/% รายสัปดาห์ไว้แล้ว ตอนนี้กำหนด RPE ไล่ขึ้นแต่ละสัปดาห์ได้ (เช่น 7→8→9). commit `909d3c1`

### ทำอะไร
- `CreateProgramPage.tsx`:
  - `WeekCell` เพิ่มฟิลด์ `rpe?` · ตอน save expand ลงแต่ละ week: มีค่า → `row.rpe`, ไม่มี → `delete row.rpe`
  - `ExercisePicker`: เพิ่ม state `wRpe[]` + คอลัมน์ที่ 5 (RPE) ในตาราง (grid `26px 1fr×4`, minWidth 260) · label BASE เปลี่ยน `RPE (opt)` → `RPE (BASE)` เมื่อ `showWeekly`
  - เว้นเซลล์ RPE ราย week → fallback ใช้ค่า RPE (BASE) (placeholder โชว์ค่า base) · เว้นทั้งคู่ = undefined
  - `draft.rpe` ตั้งจาก week แรกที่มีค่า (ให้ตัวแทนท่าโชว์ RPE เดียวได้)
  - `rpeRangeLabel(ex)` ใหม่ — สรุปในรายการวันเป็น `@7→9` (ค่าเดียว = `@8`); เดิมโชว์ `ex.rpe` ตัวเดียว
  - โหลดตอน edit: อ่าน `x?.rpe` ของแต่ละ week กลับเข้า `weekly[]`

### ผลกระทบ (จัดการแล้ว)
- ตาราง per-week โผล่เฉพาะ `programType === 'powerlifting' && type === 'main'` เท่าเดิม — accessory/general ไม่กระทบ
- เว้น % ไว้แต่ใส่ RPE → คำนวณน้ำหนักจาก RPE table (hint เดิม "เว้น % = ใช้ RPE" ยังจริง) · เติม hint "เว้น RPE = ใช้ค่า BASE"
- `StructuredExercise.rpe` เป็น optional อยู่แล้วใน types → ไม่ต้องแก้ shared types · logger/save อ่าน rpe ราย week ได้เพราะ expand ลงทุก week ตอน save

### verify (e2e จริง Playwright, 0 console errors)
PL 3 สัปดาห์ → Back Squat main: ตาราง `Set/Rep/%1RM/RPE ต่อสัปดาห์` โชว์คอลัมน์ RPE ครบ 3 แถว, label `RPE (BASE)` · กรอก RPE 7/8/9 (เว้น %) → Add → สรุปในวัน `3×10 @7→9` · Create → `customPrograms` ล่าสุด week 1/2/3 = `{sets:3,reps:10,rpe:7|8|9}`, `pct` ถูกตัดออก · เปิดหน้า edit โปรแกรมนั้น → summary ยัง `3×10 @7→9` (round-trip ผ่าน) · `pnpm build` ผ่าน (113 modules) · ESLint สะอาด
> ทดสอบผ่าน login gate ด้วย debug hook ชั่วคราวใน `main.tsx` (override `init` เป็น no-op กัน getSession reset user) แล้ว revert (diff ว่าง)

### ไม่ทำรอบนี้
ยังไม่มี UI แก้ per-week ของแถวที่ add แล้ว (ต้องลบแล้ว add ใหม่ — เหมือนรอบ 27) · ไม่มีปุ่ม "Fill RPE" แบบ step อัตโนมัติเหมือน Fill % (กรอกมือทีละ week)

---

## 2026-07-12 — รอบ 28 (✅ SHIPPED, deploy main): ลาก reorder ท่าใน WEEK TEMPLATE (Create Program)

ปรับลำดับท่าในแต่ละวันของ WEEK TEMPLATE ได้ด้วยการ **กด grip ค้างแล้วลากขึ้น/ลง** (custom pointer-drag,
ใช้ได้ทั้ง touch + mouse, ไม่เพิ่ม dependency). commit `3a8fc63`

### ทำอะไร
- `icons/index.tsx`: เพิ่ม `IconGrip` (6 จุด = ที่จับลาก)
- `CreateProgramPage.tsx`:
  - grip handle ซ้ายสุดของแต่ละแถวท่า (`touchAction: 'none'` กันจอเลื่อนตอนลากจาก handle) · แถว `data-ex-row data-day data-idx`
  - `startExDrag(di, ei, e)` — pointerdown บน handle → เพิ่ม `pointermove`/`pointerup` บน `window` (ไม่ผูกกับ element ที่ reorder) · onMove ใช้ `document.elementFromPoint` หา row ที่นิ้วอยู่ → splice ย้ายใน `days[di].exercises` (live) · ไฮไลต์แถวที่ลากด้วย `dragKey`
  - จำกัด reorder **ภายในวันเดียวกัน** (`overDay !== d.di` → ไม่ย้าย)

### ผลกระทบ (จัดการแล้ว)
- ⚠️ บั๊กที่เจอ+แก้: `setDays` functional updater รัน **ทีหลัง** → เดิมอ่าน `d.index` ในตัว updater ซึ่งถูก mutate เป็นค่าปลายทางไปแล้ว → splice เป็น no-op (ลากแล้วไม่ขยับ). แก้โดย `const from = d.index` **ก่อน** เรียก setDays แล้วใช้ `from` ใน updater
- key แถวเป็น index — reorder ได้เพราะแถวไม่มี state ภายใน (แสดงผลอย่างเดียว + ปุ่มลบ) · id ท่าถูก gen ใหม่ตามลำดับใหม่ตอน save (`${dayId}-e${ei}`)
- ไม่แตะ save/logger, ExercisePicker, RunPicker

### verify (e2e จริง Playwright 390×740, 0 console errors)
เพิ่ม 3 ท่า [Bench, Squat, Deadlift] → ลาก Bench ลงล่างสุด → `[Squat, Deadlift, Bench]` · ลากกลับขึ้นบน → `[Bench, Squat, Deadlift]` · ไฮไลต์ตอนลากทำงาน · `pnpm build` ผ่าน (113 modules) · ESLint สะอาด
> ทดสอบด้วยการยิง PointerEvent ผ่าน gate (debug hook ชั่วคราวใน `main.tsx` แล้ว revert). หมายเหตุ: bottom nav (fixed) บังแถวล่างสุดตอน viewport เตี้ย — ผู้ใช้จริง scroll ก่อนลากได้ปกติ

### ไม่ทำรอบนี้
ยังไม่รองรับลากข้ามวัน (คนละ day) · ไม่มี auto-scroll ตอนลากใกล้ขอบจอ (ลิสต์ต่อวันสั้น) · ไม่ทำ animation ระหว่างสลับ (ไฮไลต์อย่างเดียว)

---

## 2026-07-12 — รอบ 27 (✅ SHIPPED, deploy main): Add Exercise เป็น 2 สเต็ป (เลือกท่า → หน้าตั้งค่า)

เปลี่ยน `ExercisePicker` หน้า Create Program จาก "config โผล่ inline ใต้ list (ต้องเลื่อนยาว)" → **2 สเต็ปในชีตเดียว**:
แตะท่า → สลับไปหน้าตั้งค่า (มี `‹ Back`). แก้ปัญหาที่ตาราง %1RM รายสัปดาห์สูง (หลาย week) แล้วเลื่อนไปกดปุ่ม Add ไม่ถึง.
ทำต่อจากรอบ 26 (ผู้ใช้เจอ bug ตอนสร้างโปรแกรมหลายสัปดาห์). commit `43ed740`

### ทำอะไร
- แยก return ของ `ExercisePicker` (`CreateProgramPage.tsx`) เป็น 2 สเต็ปด้วย `pickedId === ''`:
  - **STEP 1**: header "Add Exercise" (ปุ่ม X ปิดชีต) + search + chips + list — แตะท่า = `setPickedId(id)` → เข้าสเต็ป 2 (ไม่มีปุ่ม Add ในสเต็ปนี้)
  - **STEP 2**: header `‹ Back` (`IconChevronLeft`) + ชื่อท่า · scroll region (`flex:1 overflowY:auto`) ครอบ main/accessory + role + base set/rep + ตาราง Set/Rep/% · ปุ่ม **Add to Day ตรึงล่าง** (`flexShrink:0`)
- เพิ่ม `resetConfig()` เรียกตอนกด Back → คืน type/role/set/rep/%/ตาราง เป็น default (ท่าใหม่เริ่มสะอาด); คง search/filter ไว้
- ลบ workaround รอบก่อนที่ยังไม่ commit (scrollIntoView + `configRef` + รวม list/config ใน scroll เดียว) ออก — 2 สเต็ปแก้ปัญหาเลื่อนในตัว
- pattern reuse จาก `AccessoryEditSheet` (สลับ 2 view ในชีตเดียวด้วย boolean)

### ผลกระทบ (จัดการแล้ว)
- `onPick`/`onClose` signature เท่าเดิม → จุดเรียก `<ExercisePicker/>` ไม่ต้องแก้ · หลัง Add ชีตปิด เพิ่มท่าถัดไปเริ่มสเต็ป 1 สะอาด
- ไม่แตะ logic save/logger, `confirm`/`fillPct`/`editCell`, day list, `RunPicker`
- accessory/general → สเต็ป 2 ไม่โชว์ role + ตาราง (`showWeekly` เดิม) · default type ยังเป็น accessory

### verify (e2e จริง Playwright 390×740, 0 console errors)
PL 12 สัปดาห์: STEP 1 มีแค่ search+list (ไม่มี Add/toggle) · แตะ Back Squat → STEP 2 (title "Back Squat", Back, main/accessory, Add) · เลือก main → ตาราง 12 week, scroll region เลื่อนได้ (1044/430), **ปุ่ม Add เห็นเต็มจอ (bottom 704 ≤ 740)** · `‹ Back` → STEP 1 + config รีเซ็ต (main กลับ inactive) · Fill % + Add → ชีตปิด `Back Squat — Top set · 3×10 · 75→100%` เข้า day · `pnpm build` ผ่าน (113 modules) · ESLint สะอาด
> ทดสอบผ่าน login gate ด้วย debug hook ชั่วคราวใน `main.tsx` แล้ว revert (diff ว่าง)

### ไม่ทำรอบนี้
ไม่ทำแบบ dialog เด้งซ้อนกลางจอ (เลือก in-place step ตาม pattern แอป — ดูรอบสนทนา) · ยังไม่มี UI แก้ per-week ของแถวที่ add แล้ว (ต้องลบแล้ว add ใหม่)

---

## 2026-07-12 — รอบ 26 (✅ SHIPPED, deploy main): Create Program — Set/Rep/%1RM รายสัปดาห์ + Top set/Back-off

หน้า Create Program (โปรแกรม powerlifting) ตั้ง **%1RM, Sets, Reps ได้ราย "สัปดาห์"** ผ่านตารางในหน้า Add Exercise
(quick-fill base% + step แล้วแก้รายช่องได้) และระบุ **Top set / Back-off** ได้ (เพิ่มท่าเดิม 2 ครั้ง เลือก role → ได้ 2 แถว
`exerciseId` เดียวกัน). รวมงาน 2 ส่วนที่ทำต่อเนื่องในรอบเดียว (%1RM รายสัปดาห์ → ต่อยอด Set/Rep + Top/Back-off). commit `29065cf`

### ทำอะไร
- **Authoring** (`CreateProgramPage.tsx`): draft type `ExerciseDraft.weekly: WeekCell[]` (per-week sets/reps/pct, authoring-only ถูก expand ตอน save) · `ExercisePicker` เพิ่ม role selector (`Top set`/`Back-off`/`Working` → ต่อ suffix ที่ชื่อ) + ตาราง **Set/Rep/%** ต่อสัปดาห์ + quick-fill % (base+step) · `handleCreate` expand เป็นราย week + assign `id` ต่อแถว (`${dayId}-e${i}`) · edit round-trip reconstruct `weekly` จากทุก week · `pctRangeLabel` โชว์ช่วง `70→95%` ในลิสต์
- **แก้บั๊ก logger** (`WeekDays.handleStart` + `dayToProgram` ใน `twelveWeekProgram.ts`): คีย์ weight override ด้วย `ex.id ?? exerciseId:rpe` (เดิม `exerciseId:rpe`) → ท่าซ้ำ id (top+back-off) ไม่ทับกัน · reuse `structuredWeight()` เป็น single source → **ใส่ % แต่ไม่ใส่ RPE ก็คิดน้ำหนักได้ (เดิมได้ 0)** · ตัด import `calcWeight`/`SBD_IDS` ที่ไม่ใช้แล้ว
- **แยกชื่อในหน้า logger**: เพิ่ม `name?` ใน `ProgramExercise` + `WorkoutExercise` (`types.ts`) · `dayToProgram` ส่ง `name: ex.name` · `startWorkout` (`useAppStore.ts`) ส่งต่อ · `LoggerPage` (tab/header/Next) + `FinishReview` ใช้ `e.name ?? getExercise().name`
- **polish**: DayCard `mains.slice(0,2)→(0,4)` กันตัดแถว main ที่ 3+ (`WeekDays.tsx`)

### ผลกระทบ (จัดการแล้ว)
- ไม่แตะ schema หลัก — `StructuredExercise.pct/id`, `reps: number|string` มีอยู่แล้ว; เพิ่มแค่ optional `name?` (มี fallback ชื่อ canonical ทุกจุด ไม่กระทบ built-in/โปรแกรมเดิม)
- built-in 12 สัปดาห์ไม่มี `id` → ตกลง fallback `exerciseId:rpe` (rpe ต่างกันอยู่แล้ว) = พฤติกรรมเดิม
- role + ตาราง Set/Rep/% โชว์เฉพาะ powerlifting + main เท่านั้น (accessory/general/running = เดิม)

### verify (e2e 390px จริง ผ่าน Playwright, 0 console errors)
สร้าง PL 6 สัปดาห์: Top set (fill 75 step 2.5, แก้ reps wk3=4) + Back-off (70% flat 3×8) → state ที่ save: Top pct `.75→.875` reps `[5,5,4,5,5,5]`, Back flat `.70`, 2 แถว/สัปดาห์ id แยก `-e0`/`-e1` · WeekDays (1RM squat 200): Top **150kg** / Back **140kg** (คนละค่า ไม่ชน ไม่ 0) · Logger: 2 การ์ดชื่อแยก, 150×5(1 set) / 140×8(3 sets), "Next: Back-off" · Edit→Save: per-week ไม่ flatten · `pnpm build` ผ่าน (113 modules) · ESLint สะอาด
> ทดสอบผ่าน login gate ด้วยการเปิด store ชั่วคราวใน `main.tsx` แล้ว revert ทิ้ง (ไม่ขึ้น prod)

### ไม่ทำรอบนี้
Top set + back-off แยกเป็น **แถวละ role** (เพิ่มท่า 2 ครั้ง) ไม่ใช่บล็อกเดียวกรอกพร้อมกัน · ไม่มี UI แก้ per-week ของแถวที่ add แล้ว (ต้องลบแล้ว add ใหม่) · RPE ยังเป็นค่าเดียวต่อ row (ไม่ราย week)

---

## 2026-07-10 — รอบ 25 (✅ SHIPPED, deploy main): RPE เป้าหมายในหน้า RECORDING

หน้า RECORDING (Logger) แสดง **RPE เป้าหมาย** ของแต่ละท่าเป็น badge (สี accent) ข้าง group pill + EX indicator
เมื่อท่านั้นมีค่า RPE จากโปรแกรม — เดิม RPE ถูกทิ้งระหว่างแปลงโปรแกรม → workout จึงไม่เคยถึง Logger. commit `5531c3c`

### ทำอะไร (ต่อท่อ RPE ให้ไหลถึง Logger)
- **types** เพิ่ม `targetRpe?: number` ใน `ProgramExercise` + `WorkoutExercise` (`packages/shared/src/types.ts`)
- **`dayToProgram`** (`twelveWeekProgram.ts`) ส่ง `targetRpe: ex.rpe` ตอนแปลง StructuredDay → Program
- **`startWorkout`** (`useAppStore.ts`) ส่ง `targetRpe: e.targetRpe` ต่อเข้า Workout
- **LoggerPage** แสดง `<span className="pill">RPE {cur.targetRpe}</span>` (accent) ในหัวท่า เฉพาะเมื่อ `cur.targetRpe !== undefined`

### ผลกระทบ (จัดการแล้ว)
- badge แสดง **ทุกท่าที่มีค่า RPE** (รวม accessory เช่น Speed Bench @6) ต่างจากหน้า overview (WeekDays) ที่โชว์ `@rpe`
  เฉพาะ main lift — เจตนาให้ Logger เห็นเป้าครบตอนซ้อมจริง (ถ้าอยากจำกัดเฉพาะ main เพิ่มเงื่อนไข `cur.isMain` บรรทัดเดียว)
- ท่าที่ไม่มี RPE (ท่าที่ add เอง / โปรแกรม general) → ไม่มี `targetRpe` → ไม่โชว์ badge (optional ทุกชั้น ไม่กระทบ startWorkout เดิม)
- ไม่แตะ DB/sync — `targetRpe` เป็น field ใน workout state ชั่วคราว ไม่เก็บลง Session/history

### verify (390px, Playwright coach.test) — 0 console errors
เข้า 12 Weeks SBD → Week 1 → Mon: Back Squat โชว์ **RPE 7**, Back-off **RPE 6**, Speed Bench accessory **RPE 6** ตรง data ·
`pnpm build` ผ่าน (113 modules) · ESLint สะอาด · discard workout ทดสอบเรียบร้อย

### ไม่ทำรอบนี้
ไม่ให้กรอก/บันทึก actual RPE ที่ทำได้จริงลง set (แสดงเป้าหมายอย่างเดียว) · ไม่ปรับหน้า overview ให้โชว์ RPE ของ accessory

---

## 2026-07-08 — รอบ 24 (✅ SHIPPED): Calories ring + Notifications bell + Version indicator

สามงานย่อยในรอบเดียว (deploy ต่อเนื่อง 3 commit): `0a19c81` version · `2be34e3` noti bell · `0706c22` calories ring

### 1. Calories-burned ring หน้า Home (commit 0706c22)
แสดง **แคลอรีที่เผาผลาญ** จากการซ้อม บนวง Progress Ring วงแรกของแอป
- **สูตร**: `Calories = MET × Weight(kg) × Duration(hr)` — MET: วิ่ง 9.8 / ยกเวทหนัก 6.0 / ยกเวทเบา 3.5
- **Heavy vs Light**: ถ้า session มีท่าหลัก SBD (`WorkoutExercise.isMain`) → Heavy 6.0, ไม่งั้น → Light 3.5
- **น้ำหนักตัว**: ดึง `bodyMetrics` ล่าสุด (`latestWeightKg`); ยังไม่กรอก → วงโชว์ 0 + "ใส่น้ำหนักตัวใน Profile" กดไป `/profile`
- **Ring target**: ไม่มีเป้าตายตัว — วงเต็มเทียบกับ **วันที่เผาผลาญมากสุดในสัปดาห์** (แบบเดียวกับ WEEKLY VOLUME · PEAK)
- **รวมวิ่งด้วย**: RunEntry จากหน้า `/runs` (MET 9.8) คำนวณสดรวมเข้ายอดรายวันบน Dashboard
- ไฟล์ใหม่: `lib/calories.ts` (MET + `sessionCalories`/`runCalories`/`latestWeightKg`/`weeklyCalories`) ·
  `features/dashboard/CalorieRing.tsx` (SVG stroke-dasharray) · แก้ `types.ts` (`Session.calories?`) ·
  `useAppStore.finishWorkout` (คำนวณ+บันทึกตอน Finish) · `DashboardPage` (วงบนสุด stats card) ·
  `FinishReview` (เพิ่มช่อง KCAL, grid 3→4 คอลัมน์)
- **ไม่แตะ DB/sync**: calories เก็บ local บน session; Dashboard คำนวณ fallback ให้ session เก่า/sync มา → ไม่มี migration, ไม่กระทบ sync

### 2. Notifications bell หน้า Home (commit 2be34e3)
เปลี่ยนไอคอนขวาบนหน้า Home จาก **Profile (👤) → กระดิ่ง (🔔)** พร้อม badge เลข unread (1, 2 … 9+)
- แตะ → เปิด sheet "Notifications" รวม coach request (Accept/Decline) + แจ้งเตือนทั่วไป (Mark all read) + empty state
- เอา banner แจ้งเตือนกลางหน้า Home ออก (ย้ายเข้า sheet) · Profile ยังเข้าได้ทาง Bottom Nav (มี badge อยู่แล้ว)
- แก้เฉพาะ `DashboardPage.tsx`

### 3. Version indicator หน้า Profile (commit 0a19c81)
ไอคอน ⚡ เล็ก ๆ ล่างสุดหน้า Profile แตะเพื่อโชว์เวอร์ชัน — `Atlaslog v1.0.0 · <commit> · <build date>`
- ฝังตอน build ผ่าน `vite.config.ts` define: `__APP_VERSION__` (จาก package.json) · `__APP_COMMIT__` (git short hash, fallback `VERCEL_GIT_COMMIT_SHA`) · `__APP_BUILD_DATE__`
- ไฟล์: `vite.config.ts` · `src/vite-env.d.ts` (declare globals) · `apps/web/package.json` (0.0.0→1.0.0) · `ProfilePage.tsx`

### verify
`pnpm build` ผ่านทั้ง 3 (113 modules) · สูตรแคลอรีตรวจแล้ว (Heavy 80kg×60min=480 · Light×45min=210 · วิ่ง×30min=392)
· **ยังไม่ได้ click-through e2e** (แอป gate ด้วย Supabase auth รัน headless ไม่ได้)
→ ควรทดสอบ: กรอกน้ำหนักใน Profile → ซ้อมวันมี main lift → Home เห็นวงแคลอรี · วิ่ง /runs → ยอดเพิ่ม · กระดิ่งมี noti โชว์ badge

### ไม่ทำรอบนี้
running calories ไม่ได้เก็บลง RunEntry (คำนวณสดบน Dashboard) · version bump ยัง manual (แก้ package.json เอง)

---

## 2026-07-06 — รอบ 23 (✅ SHIPPED): Running ในโปรแกรม + Main lift ใน Today's session

สองฟีเจอร์: (1) ใส่ **Running** เป็น activity ในวันของโปรแกรมได้ (เช่น Wed = วิ่ง) → โผล่ใน Today's session
แล้วกดไปหน้า `/runs` เลย · (2) การ์ด **Today's session** บน Home ถ้าเป็น Powerlifting แสดง **RPE + น้ำหนัก Main lift**
เป็นตัวเล็กใต้ focus

### ทำอะไร
- **types** `StructuredExercise.type += 'running'`; `sets`/`reps` เป็น optional; เพิ่ม `distanceKm?`/`durationMin?`
  (เป้าหมายวิ่ง ไม่บังคับ) — lifting filter ทุกจุด (`e.type === 'main'|'accessory'`) ข้าม running อัตโนมัติ
- **`rpeTable.ts`** — extract `structuredWeight(ex, oneRMs)` + export `SBD_IDS` (เดิมซ้ำใน WeekDays) ให้ WeekDays + Dashboard ใช้ร่วม;
  **`utils.ts`** เพิ่ม `runTarget(ex)` → "5 km · 30 min"
- **`dayToProgram`** (twelveWeekProgram.ts) — `filter(ex => ex.type !== 'running')` ก่อนแปลง + `ex.sets ?? 0` → running
  ไม่เข้า Logger, ไม่มี divide-by-zero ใน progress bar
- **WeekDays** — DayCard: section "RUNNING" เป็นปุ่ม 🏃 (ชื่อ + เป้าหมาย, กด → `/runs` ผ่าน `onOpenRun`); footer count เพิ่ม "· N run";
  ถ้าวันวิ่งล้วน (`!hasLifts`) ปุ่มหลักเป็น "Go Run" แทน Start · getCalcWeight ใช้ `structuredWeight`
- **DashboardPage** — Today's session: วันวิ่งล้วน = การ์ดทั้งใบ → `/runs` (icon 🏃, "RUN →"); วันเวท = ลิสต์ Main lift
  ใต้ focus (`sets×reps @rpe` + น้ำหนัก accent) เฉพาะ powerlifting (calcRMs = config.oneRMs ?? personalOneRMs); ถ้ามี running ด้วยเพิ่มแถวปุ่มวิ่ง → `/runs`
- **CreateProgramPage** — ปุ่ม "Running" ข้าง Add Exercise → `RunPicker` sheet (label + ระยะ/เวลา ไม่บังคับ) emit
  `{exerciseId:'running', type:'running', distanceKm?, durationMin?}`; รายการท่าแสดง pill "RUN" + `runTarget`
- **excelImport** — `type` รับ `running`; running row ไม่บังคับ sets/reps; เพิ่มคอลัมน์ `distance`/`duration` → distanceKm/durationMin

### ผลกระทบ (จัดการแล้ว)
running ไม่มี sets/reps → optional + filter ออกก่อนถึง Logger/weightOverrides (exerciseId 'running' ไม่อยู่ใน SBD_IDS อยู่แล้ว) ·
customAccessories/AccessoryEdit จัดการเฉพาะ accessory (running แสดงจาก day.exercises เดิมเสมอ) · nested `<button>` เลี่ยงด้วยการเปลี่ยนการ์ด
Today's session (กรณีมีเวท) เป็น `<div>` ครอบปุ่มพี่น้อง · non-SBD main → structuredWeight คืน null โชว์แค่ sets×reps@rpe

### verify
`tsc -b && vite build` ผ่าน (111 modules) + ESLint ผ่าน · **ยังไม่ได้ click-through e2e** (แอป gate ด้วย Supabase auth รัน headless ไม่ได้)
→ ควรทดสอบ: สร้างโปรแกรม + วัน Wed + Running 5km/30min → หน้าโปรแกรมเห็น RUNNING กดไป /runs · Today's session (ถ้าตรงวัน) เห็น main lift + น้ำหนัก

### ไม่ทำรอบนี้
running-only day ไม่ได้ track "done" status ผ่าน Logger (วิ่งบันทึกที่ /runs แยก) · ไม่ auto-prefill ระยะ/เวลาเป้าหมายเข้าฟอร์ม /runs

---

## 2026-07-06 — รอบ 22 (PLANNED): ปรับปรุงการจัดเก็บข้อมูล (data storage hardening)

จากการ audit สถาปัตยกรรมข้อมูลทั้ง 3 ชั้น (Zustand → localStorage → Supabase) พบจุดอ่อนที่ทำข้อมูลผู้ใช้หายได้จริง + ช่องโหว่ RLS + จุดที่จะช้าเมื่อผู้ใช้โต. แบ่งเป็น 3 รอบย่อย A→B→C

### สถาปัตยกรรมปัจจุบัน (สรุป)
- localStorage 3 กล่อง: `atlas:v2` (useAppStore: history เต็ม set-level, workout, bio, bodyMetrics, runs, customExercises) ·
  `atlas:v1:program-progress` (useProgramStore: progress/configs/customAccessories/customPrograms nested เต็ม) ·
  `atlas:v1:sync-queue` (offline queue, payload เต็มซ้ำ)
- Supabase: sessions/custom_programs/program_state เก็บเป็น jsonb blob; body_metrics/runs/exercises columnar
- sync: write-through fire-and-forget, conflict = last-write-wins, login ดึงทุกตาราง overwrite local (guard เฉพาะ program_state)

### รอบ A — กันข้อมูลหาย (client อย่างเดียว, ไม่แตะ DB) — ทำก่อน
1. **version+migrate บน persisted stores** — `useAppStore.ts:189` เคย bump `atlas:v1`→`atlas:v2` โดยไม่มี migrate (user เก่าโดน reset เงียบ, blob v1 ค้าง);
   `useProgramStore.ts:229` ไม่มี version → เพิ่ม `version` + `migrate` ทั้ง 2 stores; ใน migrate อ่าน `atlas:v1` เก่ามา merge แล้วลบทิ้ง
2. **เพิ่ม `session-delete` op** ใน `syncQueue.ts` (ตอนนี้ SyncOp ไม่มี → ลบ session แล้ว login ใหม่ฟื้นคืนชีพ) + ผูก UI ลบ session
3. **flush ก่อน hydrate** — `useAuthStore.loadUserData` ตอนนี้ overwrite history จาก cloud โดยไม่รอ flushQueue → session ที่ซ้อมตอน offline หายจากตา;
   แก้เป็น `await flushQueue()` ก่อน fetch (หรือ merge union-by-id สำหรับ sessions/metrics/runs)
4. **เลิกกลืน error** — `writeQueue` catch{} เงียบตอน quota เต็ม → แจ้งเตือน (toast/flag ใน store) + ใส่ retry cap/backoff ใน flushQueue (ตอนนี้ op fail ถาวรวนไม่จบ)
5. **id ใช้ `crypto.randomUUID()`** แทน `'h'+Date.now()` (ชนกันได้ใน ms เดียว)

### รอบ B — ปิดช่อง RLS + index (SQL ใน Supabase + อัปเดต SUPABASE_SETUP.md)
6. **`shared_programs` SELECT policy** ตอนนี้ `to authenticated using (true)` (SUPABASE_SETUP.md:85-86) → user ที่ login อ่านได้ทั้งตารางรวม share ส่วนตัวของคนอื่น;
   แยกเป็น: public อ่านได้ทุกคน + private อ่านได้เฉพาะ owner + **RPC `security definer` รับ code** สำหรับ import-by-code
   ⚠️ policy นี้เคยเป็นต้นเหตุบั๊ก "import by code not found" (2026-06-22) — ต้อง e2e ทดสอบ import/discover ซ้ำ
7. **เพิ่ม indexes** (ตอนนี้มีแค่ push_subscriptions): `sessions(user_id, date desc)` · `body_metrics(user_id, date)` · `runs(user_id, date)` ·
   `coach_athlete(coach_id, status)` · `coach_athlete(athlete_id)` · `shared_programs(is_public)` partial
8. **เพิ่ม `updated_at` + trigger** ตารางหลัก (เตรียมทางเทียบ conflict; ตอนนี้ program_state ตั้ง client-side แต่ไม่เคยใช้)

### รอบ C — hygiene + ลดโหลด (ทำเมื่อว่าง)
9. **schema เข้า git** — `supabase/migrations/` ที่ CLAUDE.md อ้างไม่มีจริง; `supabase db pull` จาก linked project ให้ rebuild ได้ด้วยคำสั่งเดียว
   (profiles schema ตอนนี้ฝังใน log.md เท่านั้น)
10. **cache exercises 1,324 แถว** (TanStack Query staleTime ยาว / IndexedDB) — ตอนนี้ re-fetch ทุก login เพราะ dbExercises ไม่ persist
11. **โหลด sessions แบบ date-window** (เช่น 6 เดือนล่าสุด + โหลดเพิ่มใน History) — ตอนนี้ดึงหมดทุก login
12. (ถ้าต้อง merge ข้ามอุปกรณ์จริง) แตก `program_state` blob เป็น field-level หรือเทียบ updated_at ก่อน upsert — ตอนนี้ 2 เครื่องทับกันทั้ง blob

### ผลกระทบถ้าไม่ทำ
A: ข้อมูลหาย 4 ทาง (บางทางเกิดแล้ว — v1→v2 ไม่มี migrate) · B: ช่องโหว่ privacy + ช้าเมื่อ data โต · C: rebuild DB ยาก + เปิดแอปช้าลงเรื่อย ๆ

### Verify (ต่อรอบ)
A: seed `atlas:v1` เก่า → เปิดแอป migrate ครบ · จบ workout offline → login → ไม่หาย · ลบ session → relogin → ไม่ฟื้น · build+lint ผ่าน
B: query `shared_programs` ตรงด้วย user อื่น → เห็นเฉพาะ public · import by code + Discover ยังทำงาน (e2e 390px)
C: cold load รอบ 2 ไม่ fetch exercises ซ้ำ (network tab)

### ไฟล์หลัก
`useAppStore.ts` · `useProgramStore.ts` · `useAuthStore.ts` · `syncQueue.ts` · `SUPABASE_SETUP.md` + SQL Editor · ภายหลัง `supabase/migrations/`

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
