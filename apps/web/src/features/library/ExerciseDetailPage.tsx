import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getExercise, muscleColor, exerciseGifUrl } from '../../lib/utils.js'
import { supabase } from '../../lib/supabase.js'
import { useAppStore } from '../../store/useAppStore.js'
import { IconChevronLeft, IconDumbbell, IconPlus } from '../../components/icons/index.js'

interface FullRow {
  instructions?: string[]
  secondaryMuscles?: string[]
  target?: string
}

export function ExerciseDetailPage() {
  const { exerciseId = '' } = useParams()
  const navigate = useNavigate()
  const { workout, addExerciseToWorkout } = useAppStore()

  const meta = getExercise(exerciseId)
  const color = muscleColor(meta.group)
  const gif = exerciseGifUrl(meta.gifPath)

  const [full, setFull] = useState<FullRow | null>(null)
  const [gifErr, setGifErr] = useState(false)

  useEffect(() => {
    let active = true
    void (async () => {
      const { data } = await supabase
        .from('exercises')
        .select('instructions,secondary_muscles,target')
        .eq('id', exerciseId)
        .maybeSingle()
      if (!active || !data) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = data as any
      setFull({
        instructions: r.instructions ?? undefined,
        secondaryMuscles: r.secondary_muscles ?? undefined,
        target: r.target ?? undefined,
      })
    })()
    return () => { active = false }
  }, [exerciseId])

  const target = full?.target ?? meta.target
  const secondary = full?.secondaryMuscles ?? meta.secondaryMuscles ?? []
  const steps = full?.instructions ?? meta.instructions ?? []

  const handleAdd = () => {
    addExerciseToWorkout(exerciseId)
    navigate('/workout')
  }

  return (
    <div className="atlas-screen screen-enter" style={{ paddingTop: 12 }}>
      <div style={{ padding: '8px 20px 12px' }}>
        <button className="btn-icon" onClick={() => navigate('/library')} aria-label="Back">
          <IconChevronLeft size={20} />
        </button>
      </div>

      <div style={{ padding: '0 20px' }}>
        {/* GIF */}
        <div style={{
          width: '100%', aspectRatio: '1 / 1', borderRadius: 20, overflow: 'hidden',
          background: `${color}14`, border: `1px solid ${color}33`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color,
          marginBottom: 18,
        }}>
          {gif && !gifErr
            ? <img src={gif} alt={meta.name} loading="lazy" onError={() => setGifErr(true)}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            : <IconDumbbell size={72} />}
        </div>

        <h1 className="t-display" style={{ fontSize: 24, margin: '0 0 8px', letterSpacing: '-0.02em' }}>{meta.name}</h1>

        {/* Tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
          <span className="pill pill-active" style={{ background: color, borderColor: color, color: '#0a0a0a' }}>{meta.group}</span>
          {meta.equipment && <span className="pill">{meta.equipment}</span>}
          {target && <span className="pill">🎯 {target}</span>}
        </div>

        {secondary.length > 0 && (
          <div className="card card-tight" style={{ marginBottom: 14 }}>
            <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 6 }}>SECONDARY MUSCLES</div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', textTransform: 'capitalize' }}>{secondary.join(', ')}</div>
          </div>
        )}

        {steps.length > 0 && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 12 }}>INSTRUCTIONS</div>
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {steps.map((s, i) => (
                <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span className="t-mono tnum" style={{
                    flexShrink: 0, width: 22, height: 22, borderRadius: 6, background: `${color}22`, color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
                  }}>{i + 1}</span>
                  <span style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text-2)' }}>{s}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {workout ? (
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleAdd}>
            <IconPlus size={18} stroke={2.5} /> Add to current workout
          </button>
        ) : (
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => navigate('/programs')}>
            Go to Programs
          </button>
        )}

        <div style={{ textAlign: 'center', padding: '24px 0 8px', color: 'var(--muted)', fontSize: 10 }}>
          Exercise data &amp; media: ExerciseDB / AscendAPI
        </div>
      </div>
    </div>
  )
}
