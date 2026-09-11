import type { CSSProperties } from 'react'
import {
  CALENDAR_DOT, dataBounds, dayCell, heatBackground, monthGrid, monthLabel, monthMaxVolume,
  type CalendarDot, type ScheduleMap, type TrainedMap,
} from '../../lib/historyCalendar.js'
import type { LiftPR } from '../../lib/sessionStats.js'
import { IconChevronLeft, IconChevronRight } from '../../components/icons/index.js'

// Monday-first, matching monthGrid and the programs' own Mon–Sat week. The two
// repeated letters are why this can't reuse the ['S','M','T',…] array in utils —
// that one is Sunday-first for the weekly volume bars.
const WEEKDAY_HEADS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const LEGEND: CalendarDot[] = ['trained', 'run', 'today', 'planned', 'missed', 'settled']

function Dot({ dot, size = 7 }: { dot: CalendarDot; size?: number }) {
  const { color, hollow } = CALENDAR_DOT[dot]
  return (
    <span style={{
      display: 'block', width: size, height: size, borderRadius: '50%',
      background: hollow ? 'transparent' : color,
      boxShadow: hollow ? `inset 0 0 0 1.5px ${color}` : 'none',
    }} />
  )
}

// Corner wedge marking a day that beat every earlier estimated 1RM for a lift.
function PRMark() {
  return (
    <span style={{
      position: 'absolute', top: 3, right: 3, width: 0, height: 0,
      borderTop: '6px solid var(--accent)', borderLeft: '6px solid transparent',
    }} />
  )
}

export function HistoryCalendar({
  year, month, schedule, trained, prs, todayYmd, onShift, onSelectDay,
}: {
  year: number
  // 0-based, like Date.getMonth()
  month: number
  schedule: ScheduleMap
  trained: TrainedMap
  prs: Map<string, LiftPR[]>
  todayYmd: string
  onShift: (delta: number) => void
  onSelectDay: (ymd: string) => void
}) {
  const cells = monthGrid(year, month)
  const maxVolume = monthMaxVolume(year, month, trained)

  // Paging stops at the edges of real data — a 12-week program reaches three
  // months ahead, so this must not clamp to the current month.
  const { first, last } = dataBounds(schedule, trained, todayYmd)
  const ordinal = year * 12 + month
  const monthOf = (ymd: string) => Number(ymd.slice(0, 4)) * 12 + Number(ymd.slice(5, 7)) - 1
  const atLatest = ordinal >= monthOf(last)
  const atEarliest = ordinal <= monthOf(first)

  return (
    <div style={{ padding: '0 20px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 14,
      }}>
        <button
          className="btn-icon"
          onClick={() => onShift(-1)}
          disabled={atEarliest}
          aria-label="Previous month"
          style={{ opacity: atEarliest ? 0.25 : 1 }}
        >
          <IconChevronLeft size={18} />
        </button>
        <div className="t-eyebrow" style={{ color: 'var(--text)' }}>{monthLabel(year, month)}</div>
        <button
          className="btn-icon"
          onClick={() => onShift(1)}
          disabled={atLatest}
          aria-label="Next month"
          style={{ opacity: atLatest ? 0.25 : 1 }}
        >
          <IconChevronRight size={18} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {WEEKDAY_HEADS.map((d, i) => (
          <div key={i} className="t-mono" style={{
            fontSize: 10, color: 'var(--muted)', textAlign: 'center', paddingBottom: 6,
          }}>
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((ymd, i) => {
          if (!ymd) return <div key={`pad-${i}`} />
          const cell = dayCell(ymd, schedule, trained, todayYmd, prs, maxVolume)
          const isToday = ymd === todayYmd

          // Lifted and ran on the same day → both dots. Otherwise the single
          // status dot already says which kind of day it was.
          const dots: CalendarDot[] = cell.hasLift && cell.hasRun
            ? ['trained', 'run']
            : cell.dot ? [cell.dot] : []

          const inner = (
            <>
              {cell.prs.length > 0 && <PRMark />}
              <div className="tnum" style={{
                fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, lineHeight: 1,
                color: cell.hasLift || cell.hasRun ? 'var(--text)'
                  : cell.dot ? 'var(--text-2)' : 'var(--muted-2)',
              }}>
                {Number(ymd.slice(8))}
              </div>
              {/* Fixed-height slot so the numbers stay on one baseline */}
              <div style={{ height: 7, display: 'flex', alignItems: 'center', gap: 3 }}>
                {dots.map(d => <Dot key={d} dot={d} />)}
              </div>
            </>
          )

          const box: CSSProperties = {
            position: 'relative', height: 46, borderRadius: 10, overflow: 'hidden',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 5,
            // Heat wins over the plain today tint: a trained today should still
            // show how much work it held.
            background: cell.heat > 0 ? heatBackground(cell.heat)
              : isToday ? 'var(--surface-2)' : 'transparent',
            // Same today marker the weekly volume bars use (.bar-fill.today)
            boxShadow: isToday ? 'inset 0 0 0 1.5px var(--accent)' : 'none',
          }

          // Only a day with something to show opens the sheet.
          if (!cell.dot) return <div key={ymd} style={box}>{inner}</div>
          return (
            <button
              key={ymd}
              onClick={() => onSelectDay(ymd)}
              aria-label={ymd}
              style={{ all: 'unset', ...box, cursor: 'pointer', boxSizing: 'border-box' }}
            >
              {inner}
            </button>
          )
        })}
      </div>

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '6px 14px',
        marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)',
      }}>
        {LEGEND.map(dot => (
          <div key={dot} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Dot dot={dot} size={6} />
            <span className="t-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
              {CALENDAR_DOT[dot].label}
            </span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 0, height: 0,
            borderTop: '6px solid var(--accent)', borderLeft: '6px solid transparent',
          }} />
          <span className="t-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>PR</span>
        </div>
      </div>

      {maxVolume > 0 && (
        <div className="t-mono" style={{ fontSize: 9, color: 'var(--muted)', marginTop: 8 }}>
          พื้นสีเขียวเข้ม = volume วันนั้นสูง (เทียบกับวันที่หนักสุดของเดือน)
        </div>
      )}
    </div>
  )
}
