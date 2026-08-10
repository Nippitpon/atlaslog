import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore.js'
import { SwapSheet } from './SwapSheet.js'
import { IconX, IconPlus, IconDumbbell } from '../../components/icons/index.js'

// Entry state of a Quick Session: the workout is running (timer started) but has no
// exercises yet. LoggerPage's render path dereferences the current exercise all the
// way down, so this state gets its own screen rather than a branch inside it.
export function EmptyWorkout({ name }: { name: string }) {
  const navigate = useNavigate()
  const { addExerciseToWorkout, cancelWorkout } = useAppStore()
  const [showAdd, setShowAdd] = useState(false)

  // Nothing has been logged yet, so discarding needs no confirmation.
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
        <button className="btn-icon" onClick={handleCancel} aria-label="Cancel workout">
          <IconX size={18} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <div className="t-eyebrow" style={{ fontSize: 9, color: 'var(--accent)' }}>● RECORDING</div>
        </div>
        <div style={{ width: 36 }} />
      </div>

      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', textAlign: 'center', padding: '48px 32px',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20, marginBottom: 20,
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)',
        }}>
          <IconDumbbell size={32} />
        </div>

        <h1 className="t-display" style={{ fontSize: 22, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          {name}
        </h1>
        <div style={{ color: 'var(--text-2)', fontSize: 13, lineHeight: 1.6, marginBottom: 28 }}>
          ยังไม่มีท่าในเซสชันนี้ — เพิ่มท่าแรกเพื่อเริ่มบันทึก
          <br />
          หรือเลือกจาก Library แล้วกด &ldquo;Add to current workout&rdquo;
        </div>

        <button className="btn btn-primary" style={{ width: '100%', height: 52 }}
          onClick={() => setShowAdd(true)}>
          <IconPlus size={18} stroke={2.5} /> Add Exercise
        </button>

        <button onClick={() => navigate('/library')}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 11,
            letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 16, padding: 8,
          }}>
          Browse Library
        </button>
      </div>

      {showAdd && (
        <SwapSheet
          title="Add Exercise"
          onPick={id => {
            addExerciseToWorkout(id)
            setShowAdd(false)
          }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  )
}
