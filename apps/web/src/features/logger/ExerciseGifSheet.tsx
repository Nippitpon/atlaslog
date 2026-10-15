import { useState } from 'react'
import { getExercise, muscleColor, exerciseGifUrl } from '../../lib/utils.js'
import { IconX, IconDumbbell } from '../../components/icons/index.js'

interface ExerciseGifSheetProps {
  exerciseId: string
  name?: string
  onClose: () => void
}

export function ExerciseGifSheet({ exerciseId, name, onClose }: ExerciseGifSheetProps) {
  const meta = getExercise(exerciseId)
  const gif = exerciseGifUrl(meta.gifPath)
  const color = muscleColor(meta.group)
  const [gifErr, setGifErr] = useState(false)

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <h3 className="t-display" style={{ margin: 0, fontSize: 22 }}>{name ?? meta.name}</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            <IconX size={18} />
          </button>
        </div>

        <div style={{
          width: '100%', aspectRatio: '1 / 1', borderRadius: 20, overflow: 'hidden',
          background: `${color}14`, border: `1px solid ${color}33`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color,
          marginBottom: 12,
        }}>
          {gif && !gifErr
            ? <img src={gif} alt={name ?? meta.name} onError={() => setGifErr(true)}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            : <IconDumbbell size={72} />}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {meta.group && <span className="pill pill-active" style={{ background: color, borderColor: color, color: '#0a0a0a' }}>{meta.group}</span>}
          {meta.equipment && <span className="pill">{meta.equipment}</span>}
        </div>

        <div style={{ textAlign: 'center', paddingTop: 16, color: 'var(--muted)', fontSize: 10 }}>
          Exercise data &amp; media: ExerciseDB / AscendAPI
        </div>
      </div>
    </div>
  )
}
