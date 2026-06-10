import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Session, Workout, Program } from '@atlaslog/shared'
import { makeSeedHistory } from '../lib/data.js'
import { useProgramStore } from './useProgramStore.js'

interface OneRMs { squat: number; bench: number; deadlift: number }

interface AppStore {
  theme: 'dark' | 'light'
  history: Session[]
  workout: Workout | null
  showPicker: boolean
  finishedSession: Session | null
  personalOneRMs: OneRMs

  setTheme: (t: 'dark' | 'light') => void
  setWorkout: (w: Workout | null) => void
  setShowPicker: (v: boolean) => void
  setFinishedSession: (s: Session | null) => void
  setPersonalOneRMs: (v: OneRMs) => void
  startWorkout: (program: Program) => void
  updateWorkout: (w: Workout) => void
  finishWorkout: () => Session | null
  cancelWorkout: () => void
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      history: makeSeedHistory(),
      workout: null,
      showPicker: false,
      finishedSession: null,
      personalOneRMs: { squat: 0, bench: 0, deadlift: 0 },

      setTheme: (theme) => set({ theme }),
      setWorkout: (workout) => set({ workout }),
      setShowPicker: (showPicker) => set({ showPicker }),
      setFinishedSession: (finishedSession) => set({ finishedSession }),
      setPersonalOneRMs: (personalOneRMs) => set({ personalOneRMs }),

      startWorkout: (program) => {
        const w: Workout = {
          programId: program.id,
          name: program.name,
          startTime: Date.now(),
          currentIdx: 0,
          exercises: program.exercises.map(e => ({
            exerciseId: e.exerciseId,
            isMain: e.isMain,
            sets: e.sets.map(s => ({ w: s.w, r: s.r, done: false })),
          })),
        }
        set({ workout: w, showPicker: false })
      },

      updateWorkout: (workout) => set({ workout }),

      finishWorkout: () => {
        const { workout, history } = get()
        if (!workout) return null
        const duration = Math.max(1, Math.round((Date.now() - workout.startTime) / 60000))
        const volume = workout.exercises.reduce((s, e) =>
          s + e.sets.filter(x => x.done).reduce((ss, st) => ss + (st.w * st.r), 0), 0)
        const setCount = workout.exercises.reduce((s, e) => s + e.sets.filter(x => x.done).length, 0)
        const session: Session = {
          id: 'h' + Date.now(),
          programId: workout.programId,
          name: workout.name,
          date: new Date().toISOString(),
          duration,
          volume,
          setCount,
          exercises: workout.exercises,
        }
        set({ history: [session, ...history], workout: null, finishedSession: session })

        // Mark current day as done on finish
        const parts = workout.programId.split('/')
        if (parts.length === 3) {
          const [programId, weekId, dayId] = parts
          const { setDayStatus } = useProgramStore.getState()
          setDayStatus(programId, weekId, dayId, 'done')
        }

        return session
      },

      cancelWorkout: () => set({ workout: null }),
    }),
    {
      name: 'atlas:v1',
      partialize: (state) => ({
        theme: state.theme,
        history: state.history,
        workout: state.workout,
        personalOneRMs: state.personalOneRMs,
      }),
    }
  )
)
