import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore.js'
import { useProgramStore } from '../../store/useProgramStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { markAllRead, markRead } from '../../lib/notificationsApi.js'
import { respondCoachRequest } from '../../lib/coachApi.js'
import { STRUCTURED_PROGRAMS, buildDayProgram } from '../../lib/twelveWeekProgram.js'
import { structuredWeight, resolveCalcRMs } from '../../lib/rpeTable.js'
import { resolveDayExercises } from '../../lib/dayLayout.js'
import { weeklyVolume, getDayOfWeek, runTarget } from '../../lib/utils.js'
import { latestWeightKg, weeklyCalories } from '../../lib/calories.js'
import { CalorieRing } from './CalorieRing.js'
import { useStartWorkout } from '../../hooks/useStartWorkout.js'
import { pickCurrentProgramId, pickActiveWeek, dayRef as buildDayRef } from '../../lib/programStatus.js'
import { IconDumbbell, IconSearch, IconCheck, IconBell, IconRun, IconUsers, IconX, IconPlay, IconTrendingUp } from '../../components/icons/index.js'
import { OneRMSparkline } from '../../components/charts/OneRMSparkline.js'
import { buildLiftSeries } from '../../lib/oneRM.js'

const DAY_SHORT = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

// Matches the Week page's DayCard preview cap
const PREVIEW_ROWS = 5

function notificationText(n: { type: string; data: Record<string, unknown> | null }): string {
  if (n.type === 'coach_linked') {
    const email = (n.data?.athlete_email as string) || 'An athlete'
    return `${email} connected to you as an athlete`
  }
  if (n.type === 'coach_added') {
    const email = (n.data?.coach_email as string) || 'A coach'
    return `${email} added you as an athlete`
  }
  if (n.type === 'coach_declined') {
    const email = (n.data?.athlete_email as string) || 'An athlete'
    return `${email} declined your coach request`
  }
  if (n.type === 'program_shared') {
    const name = (n.data?.program_name as string) || 'A program'
    return `${name} was shared with you`
  }
  if (n.type === 'program_assigned') {
    const coach = (n.data?.coach_email as string) || 'โค้ช'
    const name = (n.data?.program_name as string) || 'a program'
    return `${coach} ส่งโปรแกรม "${name}" ให้คุณ`
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
  const { history, personalOneRMs, bodyMetrics, runs, oneRMHistory } = useAppStore()
  const startWorkout = useStartWorkout()
  const { configs, getDayStatus, getDayLayout, customPrograms, progress, programMeta, setProgramPaused } = useProgramStore()
  const { notifications, refreshNotifications } = useAuthStore()

  const [showNotifs, setShowNotifs] = useState(false)
  const unread = useMemo(() => notifications.filter(n => !n.readAt), [notifications])
  const coachRequests = useMemo(() => unread.filter(n => n.type === 'coach_request'), [unread])
  const bannerNotifs = useMemo(() => unread.filter(n => n.type !== 'coach_request'), [unread])
  const unreadCount = unread.length

  const dismissNotifications = async () => {
    const { user } = useAuthStore.getState()
    if (!user) return
    try {
      await markAllRead(user.id)
      await refreshNotifications()
    } catch { /* ignore */ }
  }

  const respondRequest = async (notifId: string, coachId: string, accept: boolean) => {
    try {
      await respondCoachRequest(coachId, accept)
      await markRead(notifId)
      await refreshNotifications()
    } catch { /* ignore */ }
  }

  const weightKg = useMemo(() => latestWeightKg(bodyMetrics), [bodyMetrics])
  const calWeek = useMemo(() => weeklyCalories(history, runs, weightKg), [history, runs, weightKg])
  const caloriesToday = calWeek.find(d => d.isToday)?.calories ?? 0
  const caloriesPeak = Math.max(0, ...calWeek.map(d => d.calories))

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

  const liftSeries = useMemo(() => buildLiftSeries(history, oneRMHistory), [history, oneRMHistory])
  // A line needs 2+ points on the SAME lift — counting across lifts would show an
  // empty card for someone who logged one squat and one bench on the same day.
  const hasOneRMTrend = liftSeries.some(s => s.manual.length >= 2)

  // The program the user is currently on: most recently set up / resumed, and
  // NOT skipped when paused — pausing must never silently promote another
  // program (the paused card below is shown instead).
  const currentProgram = useMemo(() => {
    const allPrograms = [...STRUCTURED_PROGRAMS, ...customPrograms]
    const id = pickCurrentProgramId(allPrograms, configs, programMeta, progress, history)
    if (!id) return null
    const program = allPrograms.find(p => p.id === id)
    if (!program) return null
    return { program, paused: !!programMeta[id]?.paused }
  }, [configs, customPrograms, programMeta, progress, history])

  // The week Home shows (null while paused): the calendar week, clamped so it can
  // never run past a week the user has actually reached — a program set up 5 weeks
  // ago and never trained still shows W1 (log.md round 38) — and never back to a
  // week already finished. Weeks left unfinished behind it come back as leftovers.
  const activeProgramInfo = useMemo(() => {
    if (!currentProgram || currentProgram.paused) return null
    const program = currentProgram.program
    const config = configs[program.id]
    if (!config) return null
    const active = pickActiveWeek(program, progress, config, history)
    return active && { program, config, ...active }
  }, [currentProgram, configs, progress, history])

  // Today's scheduled training day (pure client, no push) — reminder banner.
  // `exercises` is the user's resolved list (saved order + edits), the same one
  // the Week page shows and starts, so the two views can't disagree.
  const todayReminder = useMemo(() => {
    if (!activeProgramInfo) return null
    const todayShort = DAY_SHORT[new Date().getDay()]
    if (!todayShort) return null
    const { program, week: currentWeek } = activeProgramInfo
    const day = currentWeek.days.find(d => d.dayOfWeek === todayShort)
    if (!day) return null
    if (getDayStatus(program.id, currentWeek.id, day.id) === 'done') return null
    const exercises = resolveDayExercises(day, getDayLayout(program.id, currentWeek.id, day.id))
    return { day, exercises, program, currentWeek }
  }, [activeProgramInfo, getDayStatus, getDayLayout])

  // Where every "go for a run" tap on Home leads. When today's program day
  // prescribes a run, the link carries that day so logging closes it out
  // (useProgramStore.setRunDayStatus); otherwise it's a plain free run. Once the
  // day is done todayReminder is null, so the link relaxes back on its own.
  const todayRunHref = useMemo(() => {
    if (!todayReminder?.day.exercises.some(e => e.type === 'running')) return '/runs'
    const { program, currentWeek, day } = todayReminder
    return `/runs?day=${encodeURIComponent(buildDayRef(program.id, currentWeek.id, day.id))}`
  }, [todayReminder])

  // Start today's session straight from Home.
  const handleStartToday = () => {
    if (!todayReminder) return
    const { day, exercises, program, currentWeek } = todayReminder
    startWorkout(buildDayProgram(
      program.id, currentWeek.id, day, exercises,
      resolveCalcRMs(program, configs[program.id], personalOneRMs),
    ))
  }


  return (
    <div className="atlas-screen screen-enter">
      <div className="scr-header">
        <div>
          <div className="sub">{getDayOfWeek()}</div>
          <h1>Let's lift.</h1>
        </div>
        <button
          className="btn-icon"
          onClick={() => setShowNotifs(true)}
          aria-label="Notifications"
          style={{ position: 'relative' }}
        >
          <IconBell size={20} />
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, padding: '0 3px',
              borderRadius: 8, background: 'var(--danger)', color: '#fff',
              fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
            }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>


      {/* Today's training reminder */}
      {todayReminder && (() => {
        const { day, exercises, program, currentWeek } = todayReminder
        // resolveDayExercises drops running rows, so those still come off the raw
        // program day — same split DayCard uses on the Week page.
        const runs = day.exercises.filter(e => e.type === 'running')
        const hasLifts = exercises.length > 0
        const calcRMs = resolveCalcRMs(program, configs[program.id], personalOneRMs)
        const weekHref = `/programs/${program.id}/week/${currentWeek.id}`

        // Running-only day → the whole card opens the /runs logger
        if (!hasLifts && runs.length > 0) {
          const target = runTarget(runs[0])
          return (
            <div style={{ padding: '0 20px', marginBottom: 16 }}>
              <button
                style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%', boxSizing: 'border-box' }}
                onClick={() => navigate(todayRunHref)}
              >
                <div className="card card-tight" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 22 }}>🏃</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 2 }}>TODAY'S SESSION</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>
                      {day.focus}
                    </div>
                    {target && (
                      <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{target}</div>
                    )}
                  </div>
                  <span className="t-mono" style={{ fontSize: 11, color: 'var(--accent)' }}>RUN →</span>
                </div>
              </button>
            </div>
          )
        }

        return (
          <div style={{ padding: '0 20px', marginBottom: 16 }}>
            <div className="card card-tight">
              {/* Two tap targets: the body opens the week, START begins the workout */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', boxSizing: 'border-box' }}>
                <button
                  style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}
                  onClick={() => navigate(weekHref)}
                >
                  <div style={{ fontSize: 22 }}>🗓️</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 2 }}>TODAY'S SESSION</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>
                      {day.focus}
                    </div>
                  </div>
                </button>
                <button
                  className="t-mono"
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0,
                    fontSize: 11, color: 'var(--accent)', padding: '6px 2px 6px 10px',
                  }}
                  onClick={handleStartToday}
                >
                  START →
                </button>
              </div>

              {/* The day's lifts in the user's own order — capped like the Week
                  page's DayCard so a long day can't take over the dashboard. */}
              {exercises.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 10, paddingLeft: 34 }}>
                  {exercises.slice(0, PREVIEW_ROWS).map((ex, i) => {
                    const wt = structuredWeight(ex, calcRMs)
                    return (
                      <div key={ex.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ex.name}
                          {/* Without the label a top set and its back-off read as the same row */}
                          {ex.label && (
                            <span style={{ color: 'var(--muted)', fontSize: 10 }}> · {ex.label}</span>
                          )}
                        </span>
                        <span className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 'auto', flexShrink: 0 }}>
                          {ex.sets != null && `${ex.sets}×${ex.reps}`}
                          {ex.rpe !== undefined && ` @${ex.rpe}`}
                          {wt ? <span style={{ color: 'var(--accent)', marginLeft: 6 }}>{wt}kg</span> : null}
                        </span>
                      </div>
                    )
                  })}
                  {exercises.length > PREVIEW_ROWS && (
                    <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
                      +{exercises.length - PREVIEW_ROWS} more
                    </div>
                  )}
                </div>
              )}

              {/* Running on a lifting day → separate tap target to /runs */}
              {runs.length > 0 && (
                <button
                  onClick={() => navigate(todayRunHref)}
                  style={{
                    all: 'unset', cursor: 'pointer', boxSizing: 'border-box', width: '100%',
                    display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '8px 10px',
                    borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)',
                  }}
                >
                  <IconRun size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{runs[0].name}</span>
                  {runTarget(runs[0]) && (
                    <span className="t-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>{runTarget(runs[0])}</span>
                  )}
                  <span className="t-mono" style={{ fontSize: 10, color: 'var(--accent)', marginLeft: 'auto' }}>LOG →</span>
                </button>
              )}
            </div>
          </div>
        )
      })()}

      {/* Stats card */}
      <div style={{ padding: '0 20px', marginBottom: 16 }}>
        <div className="card">
          {/* Calories burned ring */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <CalorieRing
              calories={caloriesToday}
              peak={caloriesPeak}
              subtitle={weightKg
                ? (caloriesPeak > 0 ? `PEAK ${caloriesPeak.toLocaleString()} kcal · สัปดาห์นี้` : 'ยังไม่มีการซ้อมสัปดาห์นี้')
                : 'ใส่น้ำหนักตัวใน Profile เพื่อคำนวณ'}
              onClick={weightKg ? undefined : () => navigate('/profile')}
            />
          </div>

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

      {/* 1RM progression — all-time, sits with the retrospective stats card above.
          Renders nothing until there are 2+ logged tests. */}
      {hasOneRMTrend && (
        <div style={{ padding: '0 20px', marginBottom: 16 }}>
          <button
            onClick={() => navigate('/one-rm')}
            style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%', boxSizing: 'border-box' }}
          >
            <div className="card card-tight" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--accent)',
              }}><IconTrendingUp size={16} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>1RM PROGRESSION</div>
                <OneRMSparkline series={liftSeries} />
              </div>
              <span className="t-mono" style={{ fontSize: 11, color: 'var(--accent)', flexShrink: 0 }}>VIEW →</span>
            </div>
          </button>
        </div>
      )}

      {/* Paused program — deliberately does NOT fall through to another program */}
      {currentProgram?.paused && (
        <div style={{ padding: '0 20px', marginBottom: 16 }}>
          <div className="card" style={{ borderLeft: '3px solid #f59e0b', paddingLeft: 14 }}>
            <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 3, color: '#f59e0b' }}>PROGRAM PAUSED</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, lineHeight: 1.1, marginBottom: 6 }}>
              {currentProgram.program.name}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.5 }}>
              พักโปรแกรมนี้ไว้ — กดทำต่อเมื่อพร้อมกลับไปซ้อม หรือเลือกโปรแกรมใหม่
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => setProgramPaused(currentProgram.program.id, false)}
              >
                <IconPlay size={14} />
                ทำต่อ
              </button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => navigate('/programs')}>
                <IconDumbbell size={16} />
                Programs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No active program CTA */}
      {!activeProgramInfo && !currentProgram?.paused && (
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
        const { program, week: currentWeek, weekNum: currentWeekNum, doneWeeks, weeksBehind, leftovers } = activeProgramInfo
        const phaseColor = PHASE_COLOR[currentWeek.phase] ?? 'var(--accent)'
        const pct = Math.round((doneWeeks / program.totalWeeks) * 100)
        const oldest = leftovers[0]
        return (
          <div style={{ padding: '0 20px', marginBottom: 16 }}>
            <div className="card card-tight" style={{ borderLeft: `3px solid ${phaseColor}`, paddingLeft: 14 }}>
              <button
                style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%', boxSizing: 'border-box' }}
                onClick={() => navigate(`/programs/${program.id}/week/${currentWeek.id}`)}
              >
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

                {/* Schedule drift — the plan's dates vs the week you're actually on */}
                {weeksBehind !== 0 && (
                  <div className="t-mono" style={{
                    fontSize: 10, marginBottom: 10,
                    color: weeksBehind > 0 ? '#f59e0b' : 'var(--muted)',
                  }}>
                    {weeksBehind > 0
                      ? `⚠ ช้ากว่าแผน ${weeksBehind} สัปดาห์`
                      : `เร็วกว่าแผน ${-weeksBehind} สัปดาห์`}
                  </div>
                )}

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
              </button>

              {/* Unfinished days left behind — the card moved on, these didn't */}
              {oldest && (
                <button
                  onClick={() => navigate(`/programs/${program.id}/week/${oldest.week.id}`)}
                  style={{
                    all: 'unset', cursor: 'pointer', boxSizing: 'border-box', width: '100%',
                    display: 'flex', alignItems: 'center', gap: 6, minHeight: 28,
                    marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)',
                  }}
                >
                  <span className="t-mono" style={{ fontSize: 10, color: '#f59e0b' }}>
                    ↩ W{oldest.weekNum} ยังค้าง {oldest.remaining} วัน
                  </span>
                  {leftovers.length > 1 && (
                    <span className="t-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
                      · อีก {leftovers.length - 1} สัปดาห์
                    </span>
                  )}
                  <span className="t-mono" style={{ fontSize: 10, color: 'var(--accent)', marginLeft: 'auto' }}>→</span>
                </button>
              )}
            </div>
          </div>
        )
      })()}

      {/* Shortcuts */}
      <div style={{ padding: '0 20px', marginBottom: 28, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {[
          { label: 'Programs', Ic: IconDumbbell, to: '/programs' },
          { label: 'Exercises', Ic: IconSearch, to: '/library' },
          { label: 'Running', Ic: IconRun, to: todayRunHref },
          // key is the label, not `to` — the Running href changes with the day
        ].map(({ label, Ic, to }) => (
          <button
            key={label}
            className="btn btn-secondary"
            style={{ minWidth: 0, padding: '0 6px', gap: 6, fontSize: 13 }}
            onClick={() => navigate(to)}
          >
            <Ic size={17} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
          </button>
        ))}
      </div>

      {/* Notifications sheet */}
      {showNotifs && (
        <div className="sheet-backdrop" onClick={() => setShowNotifs(false)} style={{ zIndex: 100 }}>
          <div className="sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '80%', overflowY: 'auto' }}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <h3 className="t-display" style={{ margin: 0, fontSize: 20 }}>Notifications</h3>
              <button className="btn-icon" onClick={() => setShowNotifs(false)} aria-label="Close"><IconX size={18} /></button>
            </div>

            {unread.length === 0 ? (
              <div className="t-mono" style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '32px 0' }}>
                ไม่มีการแจ้งเตือนใหม่
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                {/* Coach requests — need the athlete's consent */}
                {coachRequests.map(n => {
                  const coachId = (n.data?.coach_id as string) || ''
                  const coachEmail = (n.data?.coach_email as string) || 'A coach'
                  return (
                    <div key={n.id} className="card card-tight" style={{ borderLeft: '3px solid #f97316', paddingLeft: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <IconUsers size={15} style={{ color: '#f97316' }} />
                        <div className="t-eyebrow" style={{ fontSize: 9 }}>COACH REQUEST</div>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 10 }}>
                        <b>{coachEmail}</b> wants to coach you. ยอมรับเพื่อให้โค้ชเห็นข้อมูลการซ้อมของคุณ
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-primary"
                          style={{ flex: 1, height: 40, fontSize: 12 }}
                          disabled={!coachId}
                          onClick={() => void respondRequest(n.id, coachId, true)}
                        >
                          Accept
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ flex: 1, height: 40, fontSize: 12 }}
                          onClick={() => void respondRequest(n.id, coachId, false)}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  )
                })}

                {/* Informational notifications */}
                {bannerNotifs.map(n => (
                  <div key={n.id} className="card card-tight" style={{ borderLeft: '3px solid var(--accent)', paddingLeft: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <IconBell size={15} style={{ color: 'var(--accent)' }} />
                      <div className="t-eyebrow" style={{ fontSize: 9 }}>NOTIFICATION</div>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text)' }}>
                      {notificationText(n)}
                    </div>
                  </div>
                ))}

                {bannerNotifs.length > 0 && (
                  <button
                    className="btn btn-secondary"
                    style={{ width: '100%', height: 40, fontSize: 12, marginTop: 4 }}
                    onClick={() => void dismissNotifications()}
                  >
                    Mark all read
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
