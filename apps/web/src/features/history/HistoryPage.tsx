import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore.js'
import { useProgramStore } from '../../store/useProgramStore.js'
import { STRUCTURED_PROGRAMS } from '../../lib/twelveWeekProgram.js'
import { resolveDayRef } from '../../lib/programStatus.js'
import {
  buildScheduleMap, buildTrainedMap, dotFor, monthLabel, monthSummary, shiftMonth, weekStreak,
  type MonthSummary,
} from '../../lib/historyCalendar.js'
import { prDaysByLift } from '../../lib/sessionStats.js'
import { dateFromYMD, todayYMD } from '../../lib/utils.js'
import { IconCalendar, IconHistory } from '../../components/icons/index.js'
import type { Session, RunEntry } from '@atlaslog/shared'
import { SessionCard } from './SessionCard.js'
import { RunCard } from './RunCard.js'
import { HistoryCalendar } from './HistoryCalendar.js'
import { DayDetailSheet } from './DayDetailSheet.js'

type TimelineItem =
  | { kind: 'session'; date: string; data: Session }
  | { kind: 'run'; date: string; data: RunEntry }

const kkg = (v: number) => `${(v / 1000).toFixed(1)}k kg`

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="t-display tnum" style={{ fontSize: 18, lineHeight: 1, color: tone ?? 'var(--text)' }}>
        {value}
      </div>
      <div className="t-mono" style={{ fontSize: 9, color: 'var(--muted)', marginTop: 4 }}>
        {label}
      </div>
    </div>
  )
}

// How the displayed month went. Adherence counts only days that have come due,
// so the running month is never punished for days the athlete hasn't reached.
function StatStrip({
  summary, prevSummary, prevLabel, streak,
}: {
  summary: MonthSummary
  prevSummary: MonthSummary
  prevLabel: string
  streak: number
}) {
  const delta = prevSummary.volumeKg > 0
    ? Math.round(((summary.volumeKg - prevSummary.volumeKg) / prevSummary.volumeKg) * 100)
    : null

  return (
    <div style={{ padding: '0 20px', marginBottom: 18 }}>
      <div className="card card-tight">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <Stat
            label="ตามแผน"
            value={summary.dueDays ? `${summary.doneDays}/${summary.dueDays}` : '—'}
          />
          <Stat
            label="ADHERENCE"
            value={summary.dueDays ? `${summary.adherencePct}%` : '—'}
            tone={summary.dueDays && summary.adherencePct >= 80 ? 'var(--accent)' : undefined}
          />
          <Stat label="สัปดาห์ต่อเนื่อง" value={streak ? `🔥 ${streak}` : '0'} />
        </div>

        <div style={{
          borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 10,
          display: 'flex', flexWrap: 'wrap', gap: '2px 8px', alignItems: 'baseline',
        }}>
          <span className="t-mono tnum" style={{ fontSize: 11, color: 'var(--text-2)' }}>
            {kkg(summary.volumeKg)}
          </span>
          {delta !== null && (
            <span className="t-mono tnum" style={{
              fontSize: 11,
              color: delta >= 0 ? 'var(--accent)' : 'var(--danger)',
            }}>
              {delta >= 0 ? '+' : ''}{delta}% จาก {prevLabel}
            </span>
          )}
          <span className="t-mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
            · {summary.sessionCount} sessions
            {summary.runCount > 0 && ` · ${summary.runCount} runs`}
            {summary.missedDays > 0 && (
              <span style={{ color: 'var(--danger)' }}> · พลาด {summary.missedDays} วัน</span>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}

export function HistoryPage() {
  const navigate = useNavigate()
  const { history, runs } = useAppStore()
  const customPrograms = useProgramStore(s => s.customPrograms)
  const configs = useProgramStore(s => s.configs)
  const progress = useProgramStore(s => s.progress)
  const programs = useMemo(() => [...STRUCTURED_PROGRAMS, ...customPrograms], [customPrograms])

  const [view, setView] = useState<'list' | 'calendar'>('list')
  const todayYmd = todayYMD()
  const [cursor, setCursor] = useState(() => {
    const d = dateFromYMD(todayYmd)
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [selected, setSelected] = useState<string | null>(null)

  const schedule = useMemo(
    () => buildScheduleMap(programs, configs, progress),
    [programs, configs, progress],
  )
  const trained = useMemo(() => buildTrainedMap(history, runs), [history, runs])

  const summary = useMemo(
    () => monthSummary(cursor.year, cursor.month, schedule, trained, todayYmd),
    [cursor, schedule, trained, todayYmd],
  )
  const prev = shiftMonth(cursor.year, cursor.month, -1)
  const prevSummary = useMemo(
    () => monthSummary(prev.year, prev.month, schedule, trained, todayYmd),
    [prev.year, prev.month, schedule, trained, todayYmd],
  )
  const streak = useMemo(() => weekStreak(trained), [trained])
  const prs = useMemo(() => prDaysByLift(history), [history])

  const groups = useMemo(() => {
    const items: TimelineItem[] = [
      ...history.map((h): TimelineItem => ({ kind: 'session', date: h.date, data: h })),
      ...runs.map((r): TimelineItem => ({ kind: 'run', date: r.date, data: r })),
    ].sort((a, b) => b.date.localeCompare(a.date))

    const g: Record<string, TimelineItem[]> = {}
    items.forEach(it => {
      const key = new Date(it.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()
      if (!g[key]) g[key] = []
      g[key].push(it)
    })
    return Object.entries(g)
  }, [history, runs])

  // A user who has only just set up a program has no sessions but does have a
  // plan worth looking at, so the "nothing here yet" screen waits for both.
  const isEmpty = history.length === 0 && runs.length === 0 && schedule.size === 0

  const selectedDot = selected ? dotFor(selected, schedule, trained, todayYmd) : null

  return (
    <div className="atlas-screen screen-enter">
      <div className="scr-header">
        <div>
          <div className="sub">ALL SESSIONS</div>
          <h1>History</h1>
        </div>
        {!isEmpty && (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              className={`pill ${view === 'calendar' ? 'pill-active' : ''}`}
              onClick={() => setView('calendar')}
              aria-label="Calendar view"
            >
              <IconCalendar size={13} />
            </button>
            <button
              className={`pill ${view === 'list' ? 'pill-active' : ''}`}
              onClick={() => setView('list')}
              aria-label="List view"
            >
              <IconHistory size={13} />
            </button>
          </div>
        )}
      </div>

      {isEmpty ? (
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, marginBottom: 8 }}>
            No workouts yet
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 28, lineHeight: 1.5 }}>
            เริ่มบันทึกการซ้อมได้เลย<br />ทุก session จะถูกเก็บไว้ที่นี่
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/')} style={{ minWidth: 160 }}>
            Start a Workout
          </button>
        </div>
      ) : view === 'calendar' ? (
        <>
          <StatStrip
            summary={summary}
            prevSummary={prevSummary}
            prevLabel={monthLabel(prev.year, prev.month).split(' ')[0]!}
            streak={streak}
          />
          <HistoryCalendar
            year={cursor.year}
            month={cursor.month}
            schedule={schedule}
            trained={trained}
            prs={prs}
            todayYmd={todayYmd}
            onShift={delta => setCursor(c => shiftMonth(c.year, c.month, delta))}
            onSelectDay={setSelected}
          />
        </>
      ) : groups.length === 0 ? (
        // Reachable now that a configured program keeps the page out of the
        // full empty state: there is a plan to show, just nothing logged yet.
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20, lineHeight: 1.6 }}>
            ยังไม่มี session ที่บันทึกไว้<br />
            ดูวันที่ต้องเล่นได้ในมุมมองปฏิทิน
          </div>
          <button className="btn" onClick={() => setView('calendar')} style={{
            background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)',
          }}>
            เปิดปฏิทิน
          </button>
        </div>
      ) : groups.map(([month, items]) => (
        <div key={month} style={{ marginBottom: 28 }}>
          <div style={{ padding: '0 20px 12px' }}>
            <div className="t-eyebrow">{month}</div>
          </div>
          <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map(it => {
              if (it.kind === 'session') {
                return <SessionCard key={it.data.id} h={it.data} onOpen={() => navigate(`/history/${it.data.id}`)} />
              }
              const target = resolveDayRef(it.data.dayRef, programs)
              return (
                <RunCard
                  key={it.data.id}
                  r={it.data}
                  target={target}
                  onOpen={target ? () => navigate(`/programs/${target.program.id}/week/${target.week.id}`) : undefined}
                />
              )
            })}
          </div>
        </div>
      ))}

      {selected && selectedDot && (
        <DayDetailSheet
          ymd={selected}
          dot={selectedDot}
          scheduled={schedule.get(selected) ?? []}
          trained={trained.get(selected) ?? []}
          prs={prs.get(selected) ?? []}
          todayYmd={todayYmd}
          programs={programs}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
