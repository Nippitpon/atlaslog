import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore.js'
import { useProgramStore } from '../../store/useProgramStore.js'
import { getExercise, muscleColor } from '../../lib/utils.js'
import { SwapSheet } from './SwapSheet.js'
import { FinishReview } from './FinishReview.js'
import {
  IconX, IconCheck, IconPlus, IconChevronLeft, IconChevronRight, IconSwap,
} from '../../components/icons/index.js'
import type { Workout } from '@atlaslog/shared'

export function LoggerPage() {
  const navigate = useNavigate()
  const { workout, updateWorkout, addExerciseToWorkout, finishWorkout, cancelWorkout, history } = useAppStore()
  const [showSwap, setShowSwap] = useState(false)
  const [showAddExercise, setShowAddExercise] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [reviewNow, setReviewNow] = useState<number | null>(null)

  // all hooks must be called before any early return
  const cur = workout?.exercises[workout.currentIdx]
  const prevSets = useMemo(() => {
    if (!workout || !cur) return null
    const last = history.find(h => h.programId === workout.programId && h.exercises)
    if (!last?.exercises) return null
    const e = last.exercises.find(x => x.exerciseId === cur.exerciseId)
    return e ? e.sets : null
  }, [history, workout, cur])

  if (!workout || !cur) return null

  const exMeta = getExercise(cur.exerciseId)

  const totalSets = workout.exercises.reduce((s, e) => s + e.sets.length, 0)
  const doneSets = workout.exercises.reduce((s, e) => s + e.sets.filter(x => x.done).length, 0)
  const volume = workout.exercises.reduce((s, e) =>
    s + e.sets.filter(x => x.done).reduce((ss, st) => ss + (st.w * st.r), 0), 0)

  const updateSet = (setIdx: number, patch: Partial<{ w: number; r: number; done: boolean }>) => {
    // Set day to in_progress on first checked set
    if (patch.done === true) {
      const noSetsDoneYet = workout.exercises.every(e => e.sets.every(s => !s.done))
      if (noSetsDoneYet) {
        const parts = workout.programId.split('/')
        if (parts.length === 3) {
          useProgramStore.getState().setDayStatus(parts[0], parts[1], parts[2], 'in_progress')
        }
      }
    }
    const next: Workout = { ...workout }
    next.exercises = next.exercises.map((e, i) => i !== workout.currentIdx ? e : {
      ...e, sets: e.sets.map((s, si) => si !== setIdx ? s : { ...s, ...patch }),
    })
    updateWorkout(next)
  }

  const addSet = () => {
    const lastSet = cur.sets[cur.sets.length - 1] ?? { w: 0, r: 8 }
    const next: Workout = { ...workout }
    next.exercises = next.exercises.map((e, i) => i !== workout.currentIdx ? e : {
      ...e, sets: [...e.sets, { id: `ws${Date.now()}`, w: lastSet.w, r: lastSet.r, done: false }],
    })
    updateWorkout(next)
  }

  const goToExercise = (idx: number) => updateWorkout({ ...workout, currentIdx: idx })

  const handleFinish = () => { setReviewNow(Date.now()) }

  const handleCancel = () => {
    cancelWorkout()
    navigate('/')
  }

  return (
    <div className="atlas-screen screen-enter" style={{ paddingTop: 48 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px 12px', position: 'sticky', top: 0, zIndex: 5,
        background: 'var(--bg)',
      }}>
        <button className="btn-icon" onClick={() => setShowCancel(true)}>
          <IconX size={18} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <div className="t-eyebrow" style={{ fontSize: 9, color: 'var(--accent)' }}>● RECORDING</div>
        </div>
        <button onClick={handleFinish}
          style={{ background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none',
            padding: '0 16px', height: 36, borderRadius: 10, fontFamily: 'var(--font-display)',
            fontWeight: 700, fontSize: 12, letterSpacing: '0.05em', cursor: 'pointer' }}>
          FINISH
        </button>
      </div>

      <div style={{ padding: '0 20px', marginBottom: 16 }}>
        <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(doneSets / totalSets) * 100}%`,
            background: 'var(--accent)', transition: 'width .3s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span className="t-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
            {doneSets}/{totalSets} SETS
          </span>
          <span className="t-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
            VOL {volume.toLocaleString()} kg
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, padding: '0 20px 16px', overflowX: 'auto', scrollSnapType: 'x mandatory' }}>
        {workout.exercises.map((e, i) => {
          const meta = getExercise(e.exerciseId)
          const done = e.sets.filter(s => s.done).length
          const total = e.sets.length
          const active = i === workout.currentIdx
          const complete = done === total && total > 0
          return (
            <button key={e.id ?? i} onClick={() => goToExercise(i)}
              style={{
                flexShrink: 0, scrollSnapAlign: 'start',
                background: active ? 'var(--surface-3)' : 'var(--surface-1)',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 12, padding: '8px 12px', cursor: 'pointer',
                color: 'var(--text)', textAlign: 'left', minWidth: 110,
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                {complete && <IconCheck size={11} style={{ color: 'var(--accent)' }} />}
                <span className="t-mono" style={{ fontSize: 9, color: complete ? 'var(--accent)' : 'var(--muted)' }}>
                  {done}/{total}
                </span>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {meta.name}
              </div>
            </button>
          )
        })}
        <button onClick={() => setShowAddExercise(true)} aria-label="Add exercise"
          style={{
            flexShrink: 0, background: 'var(--surface-1)',
            border: '1px dashed var(--border-strong)', borderRadius: 12,
            padding: '8px 14px', cursor: 'pointer', color: 'var(--text-2)',
            display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'stretch',
          }}>
          <IconPlus size={16} stroke={2.5} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13 }}>Add</span>
        </button>
      </div>

      <div style={{ padding: '0 20px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span className="pill" style={{
                background: 'transparent',
                borderColor: muscleColor(exMeta.group),
                color: muscleColor(exMeta.group),
              }}>{exMeta.group}</span>
              <span className="t-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
                EX {workout.currentIdx + 1}/{workout.exercises.length}
              </span>
            </div>
            <h2 className="t-display" style={{ margin: 0, fontSize: 30, letterSpacing: '-0.03em' }}>
              {exMeta.name}
            </h2>
          </div>
          <button className="btn-icon" onClick={() => setShowSwap(true)} aria-label="Swap exercise">
            <IconSwap size={18} />
          </button>
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 1fr 60px', gap: 8, padding: '4px 0 8px' }}>
          <div className="t-eyebrow" style={{ textAlign: 'center', fontSize: 9 }}>SET</div>
          <div className="t-eyebrow" style={{ textAlign: 'center', fontSize: 9 }}>KG</div>
          <div className="t-eyebrow" style={{ textAlign: 'center', fontSize: 9 }}>REPS</div>
          <div className="t-eyebrow" style={{ textAlign: 'center', fontSize: 9 }}>✓</div>
        </div>

        {cur.sets.map((s, i) => {
          const prev = prevSets?.[i]
          return (
            <div key={s.id ?? i} className={`set-row ${s.done ? 'complete' : ''}`}>
              <div className="set-num tnum">{i + 1}</div>
              <div>
                {prev && (
                  <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted-2)', textAlign: 'center', marginBottom: 2 }}>
                    {prev.w}×{prev.r}
                  </div>
                )}
                <input
                  className="input-num tnum"
                  type="number" inputMode="decimal"
                  value={s.w || ''}
                  placeholder={prev ? String(prev.w) : '0'}
                  onChange={e => updateSet(i, { w: Number(e.target.value) || 0 })}
                  onFocus={e => e.target.select()}
                />
              </div>
              <div>
                {prev && (
                  <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted-2)', textAlign: 'center', marginBottom: 2 }}>
                    {prev.w}×{prev.r}
                  </div>
                )}
                <input
                  className="input-num tnum"
                  type="number" inputMode="numeric"
                  value={s.r || ''}
                  placeholder={prev ? String(prev.r) : '0'}
                  onChange={e => updateSet(i, { r: Number(e.target.value) || 0 })}
                  onFocus={e => e.target.select()}
                />
              </div>
              <div>
                <button
                  className={`check-btn ${s.done ? 'checked' : ''}`}
                  onClick={() => updateSet(i, { done: !s.done })}>
                  <IconCheck size={s.done ? 26 : 22} stroke={s.done ? 3 : 2.5} />
                </button>
              </div>
            </div>
          )
        })}

        <button onClick={addSet} style={{
          width: '100%', height: 52, marginTop: 8,
          background: 'transparent',
          border: '1.5px dashed var(--border-strong)',
          borderRadius: 14,
          color: 'var(--text-2)',
          fontFamily: 'var(--font-display)',
          fontWeight: 600, fontSize: 14, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          letterSpacing: '0.05em', textTransform: 'uppercase',
          WebkitTapHighlightColor: 'transparent',
        }}>
          <IconPlus size={16} stroke={2.5} /> Add Set
        </button>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          {workout.currentIdx > 0 && (
            <button className="btn btn-secondary" onClick={() => goToExercise(workout.currentIdx - 1)}>
              <IconChevronLeft size={18} />
            </button>
          )}
          {workout.currentIdx < workout.exercises.length - 1 ? (
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => goToExercise(workout.currentIdx + 1)}>
              Next: {getExercise(workout.exercises[workout.currentIdx + 1].exerciseId).name}
              <IconChevronRight size={18} />
            </button>
          ) : (
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleFinish}>
              <IconCheck size={18} stroke={3} /> Finish Workout
            </button>
          )}
        </div>
      </div>

      {showSwap && (
        <SwapSheet
          current={cur.exerciseId}
          onPick={id => {
            const next: Workout = { ...workout }
            next.exercises = next.exercises.map((e, i) => i !== workout.currentIdx ? e : { ...e, exerciseId: id })
            updateWorkout(next)
            setShowSwap(false)
          }}
          onClose={() => setShowSwap(false)}
        />
      )}

      {showAddExercise && (
        <SwapSheet
          title="Add Exercise"
          onPick={id => {
            addExerciseToWorkout(id)
            setShowAddExercise(false)
          }}
          onClose={() => setShowAddExercise(false)}
        />
      )}

      {reviewNow !== null && (
        <FinishReview
          workout={workout}
          now={reviewNow}
          onCancel={() => setReviewNow(null)}
          onConfirm={() => { finishWorkout(); navigate('/') }}
        />
      )}

      {showCancel && (
        <div className="sheet-backdrop" onClick={() => setShowCancel(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h3 className="t-display" style={{ margin: '0 0 8px', fontSize: 22 }}>Cancel workout?</h3>
            <p style={{ margin: '0 0 16px', color: 'var(--text-2)', fontSize: 14 }}>
              You've completed {doneSets} set{doneSets !== 1 ? 's' : ''}. Cancelling discards this session.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCancel(false)}>
                Keep going
              </button>
              <button onClick={handleCancel} style={{
                flex: 1, height: 52, borderRadius: 14, border: 'none',
                background: 'var(--danger)', color: '#fff',
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
                letterSpacing: '0.05em', textTransform: 'uppercase', cursor: 'pointer'
              }}>
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
