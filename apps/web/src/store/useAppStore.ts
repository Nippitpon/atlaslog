import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Session, Workout, Program, BodyMetricEntry, RunEntry } from '@atlaslog/shared'
import { makeSeedHistory } from '../lib/data.js'
import { useProgramStore } from './useProgramStore.js'
import { syncSession, syncBodyMetric, syncBodyMetricDelete, syncRun, syncRunDelete } from '../lib/syncQueue.js'

interface OneRMs { squat: number; bench: number; deadlift: number }

interface AppStore {
  theme: 'dark' | 'light'
  history: Session[]
  workout: Workout | null
  showPicker: boolean
  finishedSession: Session | null
  personalOneRMs: OneRMs
  bodyMetrics: BodyMetricEntry[]
  runs: RunEntry[]

  setTheme: (t: 'dark' | 'light') => void
  setWorkout: (w: Workout | null) => void
  setShowPicker: (v: boolean) => void
  setFinishedSession: (s: Session | null) => void
  setPersonalOneRMs: (v: OneRMs) => void
  setHistory: (sessions: Session[]) => void
  clearHistory: () => void
  startWorkout: (program: Program) => void
  updateWorkout: (w: Workout) => void
  finishWorkout: () => Session | null
  cancelWorkout: () => void

  addBodyMetric: (entry: BodyMetricEntry) => void
  removeBodyMetric: (id: string) => void
  setBodyMetrics: (entries: BodyMetricEntry[]) => void
  addRun: (entry: RunEntry) => void
  removeRun: (id: string) => void
  setRuns: (entries: RunEntry[]) => void
  clearMetrics: () => void
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
      bodyMetrics: [],
      runs: [],

      setTheme: (theme) => set({ theme }),
      setWorkout: (workout) => set({ workout }),
      setShowPicker: (showPicker) => set({ showPicker }),
      setFinishedSession: (finishedSession) => set({ finishedSession }),
      setPersonalOneRMs: (personalOneRMs) => set({ personalOneRMs }),
      setHistory: (history) => set({ history }),
      clearHistory: () => set({ history: [] }),

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

        // Sync to cloud; queues for retry if offline / not signed in
        void syncSession(session)

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

      addBodyMetric: (entry) => {
        set(state => ({ bodyMetrics: [entry, ...state.bodyMetrics.filter(e => e.id !== entry.id)] }))
        void syncBodyMetric(entry)
      },
      removeBodyMetric: (id) => {
        set(state => ({ bodyMetrics: state.bodyMetrics.filter(e => e.id !== id) }))
        void syncBodyMetricDelete(id)
      },
      setBodyMetrics: (bodyMetrics) => set({ bodyMetrics }),

      addRun: (entry) => {
        set(state => ({ runs: [entry, ...state.runs.filter(e => e.id !== entry.id)] }))
        void syncRun(entry)
      },
      removeRun: (id) => {
        set(state => ({ runs: state.runs.filter(e => e.id !== id) }))
        void syncRunDelete(id)
      },
      setRuns: (runs) => set({ runs }),

      clearMetrics: () => set({ bodyMetrics: [], runs: [] }),
    }),
    {
      name: 'atlas:v2',
      partialize: (state) => ({
        theme: state.theme,
        history: state.history,
        workout: state.workout,
        personalOneRMs: state.personalOneRMs,
        bodyMetrics: state.bodyMetrics,
        runs: state.runs,
      }),
    }
  )
)
