import { useState } from 'react'
import { EXERCISES, MUSCLE_GROUPS } from '../../lib/data.js'
import { muscleColor } from '../../lib/utils.js'
import { IconSearch, IconX, IconDumbbell, IconChevronRight } from '../../components/icons/index.js'

export function LibraryPage() {
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('All')
  const filtered = EXERCISES.filter(e => {
    const okG = group === 'All' || e.group === group
    const okQ = e.name.toLowerCase().includes(q.toLowerCase())
    return okG && okQ
  })

  return (
    <div className="atlas-screen screen-enter">
      <div className="scr-header">
        <div>
          <div className="sub">{EXERCISES.length} EXERCISES</div>
          <h1>Library</h1>
        </div>
      </div>

      <div style={{ padding: '0 20px 14px' }}>
        <div className="search-bar">
          <IconSearch size={18} style={{ color: 'var(--muted)' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search exercises…" />
          {q && (
            <button onClick={() => setQ('')} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4 }}>
              <IconX size={16} />
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, padding: '0 20px 16px', overflowX: 'auto' }}>
        {MUSCLE_GROUPS.map(g => (
          <button key={g} onClick={() => setGroup(g)} className={`pill ${group === g ? 'pill-active' : ''}`} style={{ flexShrink: 0 }}>
            {g}
          </button>
        ))}
      </div>

      <div style={{ padding: '0 20px' }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>No matches.</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(ex => (
            <div key={ex.id} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: 12, background: 'var(--surface-1)',
              border: '1px solid var(--border)', borderRadius: 14,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: `${muscleColor(ex.group)}18`,
                border: `1px solid ${muscleColor(ex.group)}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: muscleColor(ex.group),
              }}>
                <IconDumbbell size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>
                  {ex.name}
                </div>
                <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {ex.group} · {ex.equipment}
                </div>
              </div>
              <IconChevronRight size={16} style={{ color: 'var(--muted)' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
