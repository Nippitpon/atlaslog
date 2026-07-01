import { useState } from 'react'
import { allExercises } from '../../lib/data.js'
import { muscleColor } from '../../lib/utils.js'
import { IconSearch, IconDumbbell } from '../../components/icons/index.js'

interface SwapSheetProps {
  current?: string
  title?: string
  onPick: (id: string) => void
  onClose: () => void
}

export function SwapSheet({ current, title = 'Swap Exercise', onPick, onClose }: SwapSheetProps) {
  const [q, setQ] = useState('')
  const CAP = 80
  const matches = allExercises().filter(e => e.name.toLowerCase().includes(q.toLowerCase()))
  const filtered = matches.slice(0, CAP)

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" style={{ maxHeight: '80%', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h3 className="t-display" style={{ margin: '0 0 12px', fontSize: 22 }}>{title}</h3>
        <div className="search-bar" style={{ marginBottom: 12 }}>
          <IconSearch size={18} style={{ color: 'var(--muted)' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search exercises…" />
        </div>
        <div style={{ overflowY: 'auto', flex: 1, margin: '0 -20px' }}>
          {filtered.map(ex => (
            <button key={ex.id}
              onClick={() => onPick(ex.id)}
              disabled={ex.id === current}
              style={{ all: 'unset', cursor: ex.id === current ? 'default' : 'pointer',
                display: 'block', width: '100%', opacity: ex.id === current ? 0.4 : 1 }}>
              <div className="list-row">
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'var(--surface-2)',
                  border: `1px solid ${muscleColor(ex.group)}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: muscleColor(ex.group),
                }}>
                  <IconDumbbell size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>
                    {ex.name}
                  </div>
                  <div className="t-mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    {ex.group.toUpperCase()} · {ex.equipment.toUpperCase()}
                  </div>
                </div>
                {ex.id === current && (
                  <span className="t-mono" style={{ fontSize: 10, color: 'var(--accent)' }}>CURRENT</span>
                )}
              </div>
            </button>
          ))}
          {matches.length > CAP && (
            <div style={{ textAlign: 'center', padding: '12px 20px', color: 'var(--muted)', fontSize: 11 }}>
              +{matches.length - CAP} more — refine your search
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
