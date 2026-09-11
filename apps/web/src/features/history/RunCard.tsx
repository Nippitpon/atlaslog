import type { RunEntry } from '@atlaslog/shared'
import { formatPace } from '../../lib/utils.js'
import { IconRun } from '../../components/icons/index.js'
import type { DayRefTarget } from '../../lib/programStatus.js'

// `target` is the program day this run closed out (null for a free run, and for
// a dayRef whose program/day no longer exists). With one, the card names the day
// and taps through to its week — a run is otherwise the only timeline entry that
// can't say what it belonged to, since SessionCard has the day in its name.
export function RunCard({ r, target, onOpen }: { r: RunEntry; target: DayRefTarget | null; onOpen?: () => void }) {
  const card = (
    <div className="card card-tight" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{
        width: 48, flexShrink: 0,
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        borderRadius: 10, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '8px 0',
      }}>
        <div className="t-display tnum" style={{ fontSize: 18, lineHeight: 1 }}>
          {new Date(r.date).getDate()}
        </div>
        <div className="t-mono" style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>
          {new Date(r.date).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
          <IconRun size={15} style={{ color: 'var(--accent)' }} />
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16 }}>
            Run{r.note ? ` · ${r.note}` : ''}
          </div>
        </div>
        {target && (
          <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>
            W{target.weekNum} · {target.day.dayOfWeek.toUpperCase()} — {target.day.focus}
          </div>
        )}
        <div className="t-mono tnum" style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 10 }}>
          <span><span style={{ color: 'var(--text)', fontWeight: 600 }}>{r.distanceKm}</span>km</span>
          <span>·</span>
          <span>{Math.round(r.durationMin)}min</span>
          <span>·</span>
          <span>{formatPace(r.distanceKm, r.durationMin)}/km</span>
        </div>
      </div>
    </div>
  )

  // Safe to wrap the whole card: it holds no buttons of its own.
  if (!onOpen) return card
  return (
    <button onClick={onOpen} style={{ all: 'unset', cursor: 'pointer', boxSizing: 'border-box', display: 'block', width: '100%' }}>
      {card}
    </button>
  )
}
