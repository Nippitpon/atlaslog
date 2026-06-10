import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Program } from '@atlaslog/shared'
import { useAppStore } from '../../store/useAppStore.js'
import { useProgramStore } from '../../store/useProgramStore.js'
import { programVolume } from '../../lib/utils.js'
import { PROGRAMS } from '../../lib/data.js'
import { STRUCTURED_PROGRAMS } from '../../lib/twelveWeekProgram.js'
import { ImportProgramSheet } from './ImportProgramSheet.js'
import {
  IconSearch, IconClock, IconTrendingUp, IconChevronRight, IconUpload, IconTrash,
} from '../../components/icons/index.js'

const PHASE_COLOR: Record<string, string> = {
  Accumulation:    '#60a5fa',
  Intensification: '#f97316',
  Peaking:         '#a78bfa',
  Taper:           '#4ade80',
}

export function ProgramsPage() {
  const navigate = useNavigate()
  const { startWorkout } = useAppStore()
  const { progress, customPrograms, removeCustomProgram } = useProgramStore()
  const [showImport, setShowImport] = useState(false)

  const handleQuickPick = (p: Program) => {
    startWorkout(p)
    navigate('/workout')
  }

  return (
    <div className="atlas-screen screen-enter">
      <div className="scr-header">
        <div>
          <div className="sub">TRAINING</div>
          <h1>Programs</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-icon" onClick={() => setShowImport(true)} aria-label="Import program from Excel">
            <IconUpload size={18} />
          </button>
          <button className="btn-icon" onClick={() => navigate('/library')} aria-label="Exercise library">
            <IconSearch size={18} />
          </button>
        </div>
      </div>

      {/* ── Structured Programs ─────────────────────────────── */}
      <div style={{ padding: '0 20px', marginBottom: 28 }}>
        <div className="t-eyebrow" style={{ marginBottom: 12 }}>STRUCTURED PROGRAMS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {STRUCTURED_PROGRAMS.map(sp => {
            const programProgress = progress[sp.id] ?? {}
            const doneWeeks = Object.values(programProgress).filter(week =>
              Object.values(week).length > 0 && Object.values(week).every(s => s === 'done')
            ).length
            const hasStarted = Object.values(programProgress).some(week =>
              Object.values(week).some(s => s !== 'not_started')
            )
            const pct = Math.round((doneWeeks / sp.totalWeeks) * 100)

            // Find current phase
            const doneCount = doneWeeks
            const currentWeek = sp.weeks[doneCount] ?? sp.weeks[sp.totalWeeks - 1]
            const phaseColor = PHASE_COLOR[currentWeek.phase]

            return (
              <button key={sp.id}
                onClick={() => navigate(`/programs/${sp.id}`)}
                style={{ all: 'unset', cursor: 'pointer', display: 'block' }}>
                <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
                  {/* Accent stripe */}
                  <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0,
                    width: 3, background: 'var(--accent)' }} />
                  <div style={{ paddingLeft: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start',
                      justifyContent: 'space-between', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700,
                          fontSize: 20, letterSpacing: '-0.02em', marginBottom: 3 }}>
                          {sp.name}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{sp.focus}</div>
                      </div>
                      <IconChevronRight size={18} style={{ color: 'var(--muted)', marginTop: 2 }} />
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                      {[`${sp.totalWeeks}W`, `${sp.daysPerWeek} DAYS/WK`].map(tag => (
                        <span key={tag} className="pill" style={{ fontSize: 9 }}>{tag}</span>
                      ))}
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
                        color: phaseColor, textTransform: 'uppercase', letterSpacing: '0.06em',
                        display: 'flex', alignItems: 'center' }}>
                        {currentWeek.phase}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span className="t-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
                          {hasStarted ? `Week ${doneWeeks + 1}/${sp.totalWeeks}` : 'Not started'}
                        </span>
                        {hasStarted && (
                          <span className="t-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
                            {pct}%
                          </span>
                        )}
                      </div>
                      <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)',
                          borderRadius: 2, transition: 'width .4s ease' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Custom Imported Programs ─────────────────────── */}
      {customPrograms.length > 0 && (
        <div style={{ padding: '0 20px', marginBottom: 28 }}>
          <div className="t-eyebrow" style={{ marginBottom: 12 }}>MY PROGRAMS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {customPrograms.map(sp => {
              const programProgress = progress[sp.id] ?? {}
              const doneWeeks = Object.values(programProgress).filter(week =>
                Object.values(week).length > 0 && Object.values(week).every(s => s === 'done')
              ).length
              const hasStarted = Object.values(programProgress).some(week =>
                Object.values(week).some(s => s !== 'not_started')
              )
              const pct = Math.round((doneWeeks / sp.totalWeeks) * 100)

              return (
                <div key={sp.id} style={{ position: 'relative' }}>
                  <button
                    onClick={() => navigate(`/programs/${sp.id}`)}
                    style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }}>
                    <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0,
                        width: 3, background: '#a78bfa' }} />
                      <div style={{ paddingLeft: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start',
                          justifyContent: 'space-between', marginBottom: 8 }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700,
                                fontSize: 18, letterSpacing: '-0.02em' }}>
                                {sp.name}
                              </div>
                              <span className="pill" style={{ fontSize: 8, background: 'rgba(167,139,250,0.15)',
                                borderColor: 'rgba(167,139,250,0.4)', color: '#a78bfa' }}>
                                EXCEL
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{sp.focus}</div>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); removeCustomProgram(sp.id) }}
                            style={{
                              background: 'transparent', border: 'none', cursor: 'pointer',
                              color: 'var(--muted)', padding: 4, borderRadius: 6,
                              display: 'flex', alignItems: 'center',
                            }}
                            aria-label="Remove program"
                          >
                            <IconTrash size={14} />
                          </button>
                        </div>

                        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                          {[`${sp.totalWeeks}W`, `${sp.daysPerWeek} DAYS/WK`].map(tag => (
                            <span key={tag} className="pill" style={{ fontSize: 9 }}>{tag}</span>
                          ))}
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                            <span className="t-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
                              {hasStarted ? `Week ${doneWeeks + 1}/${sp.totalWeeks}` : 'Not started'}
                            </span>
                            {hasStarted && (
                              <span className="t-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
                                {pct}%
                              </span>
                            )}
                          </div>
                          <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: '#a78bfa',
                              borderRadius: 2, transition: 'width .4s ease' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Quick Templates ─────────────────────────────────── */}
      <div style={{ padding: '0 20px', paddingBottom: 24 }}>
        <div className="t-eyebrow" style={{ marginBottom: 12 }}>QUICK TEMPLATES</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {PROGRAMS.map(p => {
            const vol = programVolume(p)
            return (
              <button key={p.id} onClick={() => handleQuickPick(p)}
                style={{ all: 'unset', cursor: 'pointer', display: 'block' }}>
                <div className="card card-tight" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 44, alignSelf: 'stretch',
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    borderRadius: 10, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', minHeight: 56, flexShrink: 0,
                  }}>
                    <div className="t-display tnum" style={{ fontSize: 18 }}>{p.exercises.length}</div>
                    <div className="t-eyebrow" style={{ fontSize: 8, marginTop: 1 }}>EX</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t-display" style={{ fontSize: 16, marginBottom: 3 }}>{p.name}</div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--muted)' }}>
                        <IconClock size={11} />
                        <span className="t-mono" style={{ fontSize: 10 }}>{p.duration}m</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--muted)' }}>
                        <IconTrendingUp size={11} />
                        <span className="t-mono" style={{ fontSize: 10 }}>~{(vol / 1000).toFixed(1)}k</span>
                      </div>
                    </div>
                  </div>
                  <IconChevronRight size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {showImport && <ImportProgramSheet onClose={() => setShowImport(false)} />}
    </div>
  )
}
