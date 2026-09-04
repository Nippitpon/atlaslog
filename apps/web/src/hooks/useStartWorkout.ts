import { useNavigate } from 'react-router-dom'
import type { Program } from '@atlaslog/shared'
import { useAppStore } from '../store/useAppStore.js'
import { resolveStartAction, type StartAction } from '../lib/workoutFlow.js'

// The single way into the logger. Every Start / Continue / Redo / Quick Session
// button goes through here so an unfinished workout is resumed rather than
// silently overwritten — the rule used to be copy-pasted onto two of the five
// entry points and missing from the other three.
export function useStartWorkout() {
  const navigate = useNavigate()
  const { workout, startWorkout } = useAppStore()

  // Returns what it did, so a caller with UI of its own (the program picker sheet)
  // can leave itself open when the user backs out of the confirm.
  return (program: Program): StartAction | 'cancelled' => {
    const action = resolveStartAction(workout, program.id)
    // Same workout → walk back into it untouched; replacing it would drop the sets.
    if (action === 'resume') {
      navigate('/workout')
      return 'resume'
    }
    if (action === 'confirm') {
      const ok = window.confirm(
        `"${workout!.name}" ยังเทรนค้างอยู่ — เริ่ม "${program.name}" ใหม่จะทิ้งเซ็ตที่บันทึกไว้`,
      )
      if (!ok) return 'cancelled'
    }
    startWorkout(program)
    navigate('/workout')
    return action
  }
}
