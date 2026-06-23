import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore.js'
import { useProgramStore } from '../../store/useProgramStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { markAllRead } from '../../lib/notificationsApi.js'
import { STRUCTURED_PROGRAMS, dayToProgram } from '../../lib/twelveWeekProgram.js'
import { calcWeight } from '../../lib/rpeTable.js'
import { weeklyVolume, getDayOfWeek } from '../../lib/utils.js'
import { IconUser, IconDumbbell, IconSearch, IconPlus, IconCheck, IconBell, IconRun } from '../../components/icons/index.js'

const DAY_SHORT = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function notificationText(n: { type: string; data: Record<string, unknown> | null }): string {
  if (n.type === 'coach_linked') {
    const email = (n.data?.athlete_email as string) || 'An athlete'
    return `${email} connected to you as an athlete`
  }
  if (n.type === 'program_shared') {
    const name = (n.data?.program_name as string) || 'A program'
    return `${name} was shared with you`
  }
  return n.type
}


const PHASE_COLOR: Record<string, string> = {
  Accumulation:    '#60a5fa',
  Intensification: '#f97316',
  Peaking:         '#a78bfa',
  Taper:           '#4ade80',
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { history, setShowPicker, startWorkout } = useAppStore()
  const { configs, getDayStatus, getConfig, getCustomAccessories, customPrograms, progress } = useProgramStore()
  const { notifications, refreshNotifications } = useAuthStore()

  const unread = useMemo(() => notifications.filter(n => !n.readAt), [notifications])

  const dismissNotifications = async () => {
    const { user } = useAuthStore.getState()
    if (!user) return
    try {
      await markAllRead(user.id)
      await refreshNotifications()
    } catch { /* ignore */ }
  }

  const week = weeklyVolume(history)
  const maxVol = Math.max(1, ...week.map(d => d.volume))

  // SBD Total: best Squat + Bench + Deadlift from main sets this calendar week (Sun–Sat)
  const sbdTotal = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const weekStart = new Date(today)
    weekStart.setDate(weekStart.getDate() - today.getDay())
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const sessionsThisWeek = history.filter(h => { const d = new Date(h.date); return d >= weekStart && d < weekEnd })
    let bestSquat = 0, bestBench = 0, bestDeadlift = 0

    sessionsThisWeek.forEach(s => {
      s.exercises?.forEach(ex => {
        if (!ex.isMain) return
        const maxW = Math.max(0, ...ex.sets.filter(st => st.done).map(st => st.w))
        if (ex.exerciseId === 'squat') bestSquat = Math.max(bestSquat, maxW)
        if (ex.exerciseId === 'bench') bestBench = Math.max(bestBench, maxW)
        if (ex.exerciseId === 'deadlift') bestDeadlift = Math.max(bestDeadlift, maxW)
      })
    })

    return { bestSquat, bestBench, bestDeadlift, total: bestSquat + bestBench + bestDeadlift }
  }, [history])

  // Active program: first program with a config that isn't fully done
  // If calendar-based week is already done, advance to first not-done week
  const activeProgramInfo = useMemo(() => {
    const { getWeekStatus } = useProgramStore.getState()
    const allPrograms = [...STRUCTURED_PROGRAMS, ...customPrograms]
    for (const programId of Object.keys(configs)) {
      const program = allPrograms.find(p => p.id === programId)
      const config = configs[programId]
      if (!program || !config) continue

      const doneWeeks = program.weeks.filter(w =>
        getWeekStatus(programId, w.id, w.days.length) === 'done'
      ).length

      if (doneWeeks === program.totalWeeks) continue // all weeks done

      const today = new Date()
      const start = new Date(config.startDate)
      const diffDays = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      const calendarWeekNum = Math.min(Math.max(Math.floor(diffDays / 7) + 1, 1), program.totalWeeks)

      // Advance past done weeks starting from calendar week
      let displayWeekNum = calendarWeekNum
      for (let w = calendarWeekNum; w <= program.totalWeeks; w++) {
        const wk = program.weeks[w - 1]
        if (!wk) break
        if (getWeekStatus(programId, wk.id, wk.days.length) !== 'done') {
          displayWeekNum = w
          break
        }
      }

      const currentWeek = program.weeks[displayWeekNum - 1]
      if (!currentWeek) continue

      const weekStatus = getWeekStatus(programId, currentWeek.id, currentWeek.days.length)
      return { program, config, currentWeek, currentWeekNum: displayWeekNum, doneWeeks, weekStatus }
    }
    return null
  // eslint-disable-next-line react-hooks/exhaustive-deps -- progress triggers recompute; getWeekStatus reads it internally via store.get()
  }, [configs, customPrograms, progress])

  // Today's scheduled training day (pure client, no push) — reminder banner
  const todayReminder = useMemo(() => {
    if (!activeProgramInfo) return null
    const todayShort = DAY_SHORT[new Date().getDay()]
    if (!todayShort) return null
    const { program, currentWeek } = activeProgramInfo
    const day = currentWeek.days.find(d => d.dayOfWeek === todayShort)
    if (!day) return null
    if (getDayStatus(program.id, currentWeek.id, day.id) === 'done') return null
    return { day, program, currentWeek }
  }, [activeProgramInfo, getDayStatus])

  const quickStart = () => {
    if (!activeProgramInfo) { setShowPicker(true); return }
    const { program, currentWeek } = activeProgramInfo
    const config = getConfig(program.id)

    const targetDay =
      currentWeek.days.find(d => getDayStatus(program.id, currentWeek.id, d.id) === 'in_progress') ||
      currentWeek.days.find(d => getDayStatus(program.id, currentWeek.id, d.id) === 'not_started')

    if (!targetDay) { navigate(`/programs/${program.id}/week/${currentWeek.id}`); return }

    const SBD: Record<string, 'squat' | 'bench' | 'deadlift'> = { squat: 'squat', bench: 'bench', deadlift: 'deadlift' }
    const weightOverrides: Record<string, number> = {}
    if (config) {
      const oneRMs = config.oneRMs
      targetDay.exercises.forEach(ex => {
        const liftKey = SBD[ex.exerciseId]
        if (!liftKey || !oneRMs[liftKey] || ex.rpe === undefined) return
        const rm = oneRMs[liftKey]
        const weight = ex.pct !== undefined
          ? Math.round(rm * ex.pct / 2.5) * 2.5
          : typeof ex.reps === 'number' ? calcWeight(rm, ex.reps, ex.rpe) : 0
        if (weight > 0) weightOverrides[`${ex.exerciseId}:${ex.rpe}`] = weight
      })
    }

    const customAcc = getCustomAccessories(program.id, currentWeek.id, targetDay.id)
    const effectiveDay = customAcc
      ? { ...targetDay, exercises: [...targetDay.exercises.filter(e => e.type === 'main'), ...customAcc] }
      : targetDay

    startWorkout(dayToProgram(program.id, currentWeek.id, effectiveDay, weightOverrides))
    navigate('/workout')
  }

  return (
    <div className="atlas-screen screen-enter">
      <div className="scr-header">
        <div>
          <div className="sub">{getDayOfWeek()}</div>
          <h1>Let's lift.</h1>
        </div>
        <button className="btn-icon" onClick={() => navigate('/profile')} aria-label="Profile">
          <IconUser size={20} />
        </button>
      </div>

      {/* Notifications banner */}
      {unread.length > 0 && (
        <div style={{ padding: '0 20px', marginBottom: 16 }}>
          <div className="card card-tight" style={{ borderLeft: '3px solid var(--accent)', paddingLeft: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <IconBell size={15} style={{ color: 'var(--accent)' }} />
              <div className="t-eyebrow" style={{ fontSize: 9, flex: 1 }}>NOTIFICATIONS</div>
              <button
                onClick={() => void dismissNotifications()}
                style={{ all: 'unset', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}
              >
                MARK ALL READ
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {unread.slice(0, 5).map(n => (
                <div key={n.id} style={{ fontSize: 13, color: 'var(--text)' }}>
                  {notificationText(n)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Today's training reminder */}
      {todayReminder && (
        <div style={{ padding: '0 20px', marginBottom: 16 }}>
          <button
            style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%', boxSizing: 'border-box' }}
            onClick={() => navigate(`/programs/${todayReminder.program.id}/week/${todayReminder.currentWeek.id}`)}
          >
            <div className="card card-tight" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 22 }}>🗓️</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 2 }}>TODAY'S SESSION</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>
                  {todayReminder.day.focus}
                </div>
              </div>
              <span className="t-mono" style={{ fontSize: 11, color: 'var(--accent)' }}>START →</span>
            </div>
          </button>
        </div>
      )}

      {/* Stats card */}
      <div style={{ padding: '0 20px', marginBottom: 16 }}>
        <div className="card">
          {/* SBD Total row */}
          {sbdTotal.total > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--surface-2)', borderRadius: 10, padding: '8px 12px', marginBottom: 16,
            }}>
              <div>
                <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 2 }}>SBD TOTAL (WEEK)</div>
                <div className="t-mono tnum" style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>
                  {sbdTotal.total}<span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 2 }}>kg</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                {[
                  { label: 'S', val: sbdTotal.bestSquat },
                  { label: 'B', val: sbdTotal.bestBench },
                  { label: 'D', val: sbdTotal.bestDeadlift },
                ].map(({ label, val }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 2 }}>{label}</div>
                    <div className="t-mono tnum" style={{ fontSize: 13, fontWeight: 600 }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
              <div className="t-eyebrow">WEEKLY VOLUME</div>
              <div className="t-mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                PEAK {Math.round(maxVol).toLocaleString()} kg
              </div>
            </div>
            <div className="bar-chart">
              {week.map((d, i) => {
                const h = d.volume > 0 ? Math.max(4, (d.volume / maxVol) * 100) : 4
                return (
                  <div key={i} className="bar-col">
                    <div style={{ height: 100, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                      <div
                        className={`bar-fill ${d.isToday ? 'today' : d.volume > 0 ? 'active' : ''}`}
                        style={{ height: `${h}%` }}
                      />
                    </div>
                    <div className="bar-label" style={{
                      color: d.isToday ? 'var(--accent)' : 'var(--muted)',
                      fontWeight: d.isToday ? 700 : 400,
                    }}>
                      {d.label}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* No active program CTA */}
      {!activeProgramInfo && (
        <div style={{ padding: '0 20px', marginBottom: 16 }}>
          <div className="card" style={{ textAlign: 'center', padding: '28px 20px' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🏋️</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, marginBottom: 6 }}>
              No active program
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20, lineHeight: 1.5 }}>
              เลือกโปรแกรมเพื่อเริ่มติดตามการซ้อม
            </div>
            <button className="btn btn-primary" onClick={() => navigate('/programs')} style={{ width: '100%' }}>
              <IconDumbbell size={18} />
              Browse Programs
            </button>
          </div>
        </div>
      )}

      {/* Active program current-week card */}
      {activeProgramInfo && (() => {
        const { program, currentWeek, currentWeekNum, doneWeeks } = activeProgramInfo
        const phaseColor = PHASE_COLOR[currentWeek.phase] ?? 'var(--accent)'
        const pct = Math.round((doneWeeks / program.totalWeeks) * 100)
        return (
          <div style={{ padding: '0 20px', marginBottom: 16 }}>
            <button
              style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%', boxSizing: 'border-box' }}
              onClick={() => navigate(`/programs/${program.id}/week/${currentWeek.id}`)}
            >
              <div className="card card-tight" style={{ borderLeft: `3px solid ${phaseColor}`, paddingLeft: 14 }}>
                {/* Program header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 3 }}>ACTIVE PROGRAM</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, lineHeight: 1.1 }}>
                      {program.name}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em' }}>
                      W{currentWeekNum}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: phaseColor, textTransform: 'uppercase' }}>
                      {currentWeek.phase}
                    </div>
                  </div>
                </div>

                {/* Day status row */}
                <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
                  {currentWeek.days.map(day => {
                    const status = getDayStatus(program.id, currentWeek.id, day.id)
                    const isActive = status === 'in_progress'
                    const isDone = status === 'done'
                    const focusShort = day.focus.split(' ')[0]
                    return (
                      <div key={day.id} style={{
                        flex: 1, textAlign: 'center', padding: '6px 4px',
                        background: isActive
                          ? 'rgba(212,255,58,0.12)'
                          : isDone ? 'rgba(74,222,128,0.08)' : 'var(--surface-2)',
                        border: `1px solid ${isActive
                          ? 'rgba(212,255,58,0.4)'
                          : isDone ? 'rgba(74,222,128,0.25)' : 'var(--border)'}`,
                        borderRadius: 8,
                        transition: 'background .2s',
                      }}>
                        <div style={{
                          fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: isActive ? 700 : 400,
                          color: isActive ? 'var(--accent)' : isDone ? '#4ade80' : 'var(--muted)',
                          marginBottom: 3,
                        }}>
                          {day.dayOfWeek}
                        </div>
                        <div style={{ height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {isDone
                            ? <IconCheck size={11} stroke={3} style={{ color: '#4ade80' }} />
                            : isActive
                            ? <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
                            : <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--border-strong)' }} />
                          }
                        </div>
                        <div style={{
                          fontFamily: 'var(--font-mono)', fontSize: 8, marginTop: 3,
                          color: isActive ? 'var(--accent)' : isDone ? '#4ade80' : 'var(--muted)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {focusShort}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Progress bar */}
                <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: phaseColor, borderRadius: 2, transition: 'width .4s ease' }} />
                </div>
                <div className="t-mono" style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase' }}>
                  {doneWeeks}/{program.totalWeeks} weeks · {pct}%
                </div>
              </div>
            </button>
          </div>
        )
      })()}

      {/* Shortcuts */}
      <div style={{ padding: '0 20px', marginBottom: 28, display: 'flex', gap: 10 }}>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => navigate('/programs')}>
          <IconDumbbell size={18} />
          Programs
        </button>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => navigate('/library')}>
          <IconSearch size={18} />
          Exercises
        </button>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => navigate('/runs')}>
          <IconRun size={18} />
          Running
        </button>
      </div>

      {/* Quick Start FAB */}
      <button
        onClick={quickStart}
        aria-label="Quick start workout"
        style={{
          position: 'fixed', bottom: 80, right: 20, zIndex: 20,
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--accent)', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(212,255,58,0.35)',
          color: 'var(--accent-ink)',
        }}
      >
        <IconPlus size={26} stroke={2.5} />
      </button>
    </div>
  )
}
