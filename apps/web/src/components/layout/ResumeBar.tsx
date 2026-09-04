import type { Workout } from '@atlaslog/shared'
import { workoutSetProgress } from '../../lib/workoutFlow.js'
import { IconChevronRight } from '../icons/index.js'

// Leaving /workout keeps the workout alive in the store, but until now nothing on
// screen said so — the only way back was guessing which day to press Start on.
// Deliberately has no discard button: throwing the session away is a decision that
// belongs in the logger, not one tap away from every screen.
export function ResumeBar({ workout, onOpen }: { workout: Workout; onOpen: () => void }) {
  const { done, total } = workoutSetProgress(workout)

  return (
    <button className="resume-bar" onClick={onOpen}>
      <span className="resume-bar-dot" />
      <span className="resume-bar-name">{workout.name}</span>
      <span className="t-mono tnum resume-bar-count">{done}/{total} เซ็ต</span>
      <IconChevronRight size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
    </button>
  )
}
