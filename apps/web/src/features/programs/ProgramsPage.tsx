import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Program } from '@atlaslog/shared'
import { useAppStore } from '../../store/useAppStore.js'
import { useProgramStore } from '../../store/useProgramStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { programVolume } from '../../lib/utils.js'
import { PROGRAMS } from '../../lib/data.js'
import { STRUCTURED_PROGRAMS } from '../../lib/twelveWeekProgram.js'
import { ImportProgramSheet } from './ImportProgramSheet.js'
import { createShare, importShare, listPublicPrograms, type PublicProgram } from '../../lib/shareApi.js'
import {
  IconSearch, IconClock, IconTrendingUp, IconChevronRight, IconUpload, IconTrash,
  IconShare, IconCopy, IconLink, IconX, IconPlus,
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
  const { progress, customPrograms, removeCustomProgram, addCustomProgram } = useProgramStore()
  const { isCoach, isAdmin } = useAuthStore()
  const canCreate = isCoach || isAdmin
  const [showImport, setShowImport] = useState(false)

  const [publicPrograms, setPublicPrograms] = useState<PublicProgram[]>([])
  const [importingCode, setImportingCode] = useState<string | null>(null)

  const loadPublic = useCallback(async () => {
    try { setPublicPrograms(await listPublicPrograms()) } catch { /* ignore */ }
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount
  useEffect(() => { void loadPublic() }, [loadPublic])

  const handleImportPublic = async (p: PublicProgram) => {
    setImportingCode(p.code)
    try {
      const program = await importShare(p.code)
      addCustomProgram(program)
      navigate(`/programs/${program.id}`)
    } catch { /* ignore */ } finally {
      setImportingCode(null)
    }
  }

  const [shareCode, setShareCode] = useState<string | null>(null)
  const [shareErr, setShareErr] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [showImportCode, setShowImportCode] = useState(false)
  const [importCode, setImportCode] = useState('')
  const [importBusy, setImportBusy] = useState(false)
  const [importErr, setImportErr] = useState<string | null>(null)

  const handleQuickPick = (p: Program) => {
    startWorkout(p)
    navigate('/workout')
  }

  const handleShare = async (sp: typeof customPrograms[number]) => {
    setSharing(true)
    setShareErr(null)
    try {
      setShareCode(await createShare(sp))
    } catch (e) {
      setShareErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSharing(false)
    }
  }

  const handleImportCode = async () => {
    const code = importCode.trim()
    if (!code) return
    setImportBusy(true)
    setImportErr(null)
    try {
      const program = await importShare(code)
      addCustomProgram(program)
      setShowImportCode(false)
      setImportCode('')
      navigate(`/programs/${program.id}`)
    } catch (e) {
      setImportErr(e instanceof Error ? e.message : String(e))
    } finally {
      setImportBusy(false)
    }
  }

  const copyShareCode = () => {
    if (shareCode) void navigator.clipboard.writeText(shareCode).catch(() => {})
  }

  return (
    <div className="atlas-screen screen-enter">
      <div className="scr-header">
        <div>
          <div className="sub">TRAINING</div>
          <h1>Programs</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canCreate && (
            <button className="btn-icon" onClick={() => navigate('/programs/new')} aria-label="Create program">
              <IconPlus size={18} />
            </button>
          )}
          <button className="btn-icon" onClick={() => setShowImportCode(true)} aria-label="Import program by share code">
            <IconLink size={18} />
          </button>
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
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/programs/${sp.id}`)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        navigate(`/programs/${sp.id}`)
                      }
                    }}
                    style={{ cursor: 'pointer', display: 'block', width: '100%' }}>
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
                                {sp.source === 'coach' ? 'FROM COACH' : sp.source === 'manual' ? 'CUSTOM' : 'EXCEL'}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{sp.focus}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                            <button
                              onClick={e => { e.stopPropagation(); void handleShare(sp) }}
                              disabled={sharing}
                              style={{
                                background: 'transparent', border: 'none', cursor: 'pointer',
                                color: 'var(--muted)', padding: 4, borderRadius: 6,
                                display: 'flex', alignItems: 'center',
                              }}
                              aria-label="Share program"
                            >
                              <IconShare size={14} />
                            </button>
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
                        </div>

                        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                          {(sp.weekly
                            ? ['WEEKLY', `${sp.daysPerWeek} DAYS/WK`]
                            : [`${sp.totalWeeks}W`, `${sp.daysPerWeek} DAYS/WK`]
                          ).map(tag => (
                            <span key={tag} className="pill" style={{ fontSize: 9 }}>{tag}</span>
                          ))}
                        </div>

                        {!sp.weekly && (
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
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Public Programs (Discover) ───────────────────────── */}
      {publicPrograms.length > 0 && (
        <div style={{ padding: '0 20px', marginBottom: 28 }}>
          <div className="t-eyebrow" style={{ marginBottom: 12 }}>PUBLIC PROGRAMS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {publicPrograms.map(p => (
              <button key={p.code} onClick={() => void handleImportPublic(p)} disabled={importingCode === p.code}
                style={{ all: 'unset', cursor: 'pointer', display: 'block' }}>
                <div className="card card-tight" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 44, alignSelf: 'stretch', minHeight: 52, flexShrink: 0,
                    background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80',
                  }}>
                    <IconTrendingUp size={20} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t-display" style={{ fontSize: 16, marginBottom: 3 }}>{p.name}</div>
                    <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
                      {p.program.totalWeeks}W · {p.program.daysPerWeek} DAYS/WK · {p.program.focus}
                    </div>
                  </div>
                  <span className="t-mono" style={{ fontSize: 10, color: 'var(--accent)', flexShrink: 0 }}>
                    {importingCode === p.code ? '...' : 'GET →'}
                  </span>
                </div>
              </button>
            ))}
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

      {/* Share-code result sheet */}
      {shareCode && (
        <div className="sheet-backdrop" onClick={() => setShareCode(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h3 className="t-display" style={{ marginBottom: 6 }}>Share program</h3>
            <p className="t-mono" style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
              Send this code — anyone can import it under Programs → link icon.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div className="t-mono" style={{
                flex: 1, fontSize: 24, fontWeight: 700, letterSpacing: '0.16em', textAlign: 'center',
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '14px', color: 'var(--accent)',
              }}>
                {shareCode}
              </div>
              <button
                className="btn btn-secondary"
                style={{ height: 52, fontSize: 12, padding: '0 14px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={copyShareCode}
              >
                <IconCopy size={16} /> Copy
              </button>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', height: 44 }} onClick={() => setShareCode(null)}>
              Done
            </button>
          </div>
        </div>
      )}

      {/* Share-code error sheet */}
      {shareErr && (
        <div className="sheet-backdrop" onClick={() => setShareErr(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h3 className="t-display" style={{ marginBottom: 6 }}>Share failed</h3>
            <div className="t-mono" style={{ fontSize: 12, color: '#ef4444', marginBottom: 16 }}>{shareErr}</div>
            <button className="btn btn-primary" style={{ width: '100%', height: 44 }} onClick={() => setShareErr(null)}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Import-by-code sheet */}
      {showImportCode && (
        <div className="sheet-backdrop" onClick={() => setShowImportCode(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <h3 className="t-display">Import by code</h3>
              <button className="btn-icon" onClick={() => setShowImportCode(false)} aria-label="Close">
                <IconX size={18} />
              </button>
            </div>
            <p className="t-mono" style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
              Enter the 6-character code from another lifter's <b>Share</b> button.
              This is <b>not</b> a coach code — to connect a coach, use Profile → Coaching.
            </p>
            <input
              className="input-num"
              type="text"
              value={importCode}
              placeholder="ABC123"
              maxLength={6}
              onChange={e => setImportCode(e.target.value.toUpperCase())}
              style={{ width: '100%', textAlign: 'center', fontSize: 22, letterSpacing: '0.12em', marginBottom: 12 }}
            />
            {importErr && (
              <div className="t-mono" style={{ fontSize: 11, color: '#ef4444', marginBottom: 12 }}>{importErr}</div>
            )}
            <button
              className="btn btn-primary"
              style={{ width: '100%', height: 44, opacity: importCode.trim() ? 1 : 0.4 }}
              disabled={importBusy || !importCode.trim()}
              onClick={handleImportCode}
            >
              {importBusy ? 'Importing…' : 'Import'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
