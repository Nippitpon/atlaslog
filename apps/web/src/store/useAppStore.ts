import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Session, Workout, Program, BodyMetricEntry, RunEntry, Exercise, UserBio, OneRMEntry } from '@atlaslog/shared'
import { makeSeedHistory, setCustomExercisesRegistry, setDbExercisesRegistry } from '../lib/data.js'
import { useProgramStore } from './useProgramStore.js'
import { syncSession, syncBodyMetric, syncBodyMetricDelete, syncRun, syncRunDelete, syncExercise, syncExerciseDelete, syncOneRM, syncOneRMDelete } from '../lib/syncQueue.js'
import { latestOneRMs, LIFT_ORDER } from '../lib/oneRM.js'
import { sessionCalories, latestWeightKg } from '../lib/calories.js'

interface OneRMs { squat: number; bench: number; deadlift: number }

interface AppStore {
  theme: 'dark' | 'light'
  history: Session[]
  workout: Workout | null
  showPicker: boolean
  personalOneRMs: OneRMs
  bio: UserBio
  bodyMetrics: BodyMetricEntry[]
  runs: RunEntry[]
  oneRMHistory: OneRMEntry[]
  customExercises: Exercise[]
  dbExercises: Exercise[]

  setTheme: (t: 'dark' | 'light') => void
  setWorkout: (w: Workout | null) => void
  setShowPicker: (v: boolean) => void
  setPersonalOneRMs: (v: OneRMs) => void
  setBio: (v: UserBio) => void
  setHistory: (sessions: Session[]) => void
  clearHistory: () => void
  startWorkout: (program: Program) => void
  updateWorkout: (w: Workout) => void
  addExerciseToWorkout: (exerciseId: string) => void
  finishWorkout: () => Session | null
  cancelWorkout: () => void

  addBodyMetric: (entry: BodyMetricEntry) => void
  removeBodyMetric: (id: string) => void
  setBodyMetrics: (entries: BodyMetricEntry[]) => void
  addRun: (entry: RunEntry) => void
  removeRun: (id: string) => void
  setRuns: (entries: RunEntry[]) => void
  addOneRMEntry: (entry: OneRMEntry) => void
  addOneRMEntries: (entries: OneRMEntry[]) => void
  removeOneRMEntry: (id: string) => void
  setOneRMHistory: (entries: OneRMEntry[]) => void
  addCustomExercise: (ex: Exercise) => void
  removeCustomExercise: (id: string) => void
  setCustomExercises: (list: Exercise[]) => void
  setDbExercises: (list: Exercise[]) => void
  clearMetrics: () => void
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => {
    // Append 1RM rows + queue their cloud writes. Deliberately does NOT touch
    // personalOneRMs — each caller decides whether the new rows are "current".
    const appendOneRMs = (entries: OneRMEntry[]) => {
      if (!entries.length) return
      set(state => {
        const ids = new Set(entries.map(e => e.id))
        return { oneRMHistory: [...entries, ...state.oneRMHistory.filter(e => !ids.has(e.id))] }
      })
      entries.forEach(e => { void syncOneRM(e) })
    }

    return {
      theme: 'dark',
      history: makeSeedHistory(),
      workout: null,
      showPicker: false,
      personalOneRMs: { squat: 0, bench: 0, deadlift: 0 },
      bio: {},
      bodyMetrics: [],
      runs: [],
      oneRMHistory: [],
      customExercises: [],
      dbExercises: [],

      setTheme: (theme) => set({ theme }),
      setWorkout: (workout) => set({ workout }),
      setShowPicker: (showPicker) => set({ showPicker }),
      setPersonalOneRMs: (personalOneRMs) => {
        const prev = get().personalOneRMs
        set({ personalOneRMs })
        useProgramStore.getState().syncSettings()
        // Keep the dated log in step with the live value. Only lifts that actually
        // changed get a row, so re-opening the sheet and saving again can't stack
        // duplicate points on the chart. Lifts cleared to 0 append nothing — and
        // we must NOT promote here, or clearing one would be undone by its old row.
        const now = new Date().toISOString()
        const stamp = Date.now()
        appendOneRMs(
          LIFT_ORDER
            .filter(k => personalOneRMs[k] > 0 && personalOneRMs[k] !== prev[k])
            .map(k => ({
              id: `rm${stamp}-${k}`,
              date: now,
              lift: k,
              weightKg: personalOneRMs[k],
              source: 'manual' as const,
            }))
        )
      },
      setBio: (bio) => {
        set({ bio })
        useProgramStore.getState().syncSettings()
      },
      setHistory: (history) => set({ history }),
      clearHistory: () => set({ history: [] }),

      startWorkout: (program) => {
        const w: Workout = {
          programId: program.id,
          name: program.name,
          startTime: Date.now(),
          currentIdx: 0,
          exercises: program.exercises.map((e, i) => ({
            id: `we${Date.now()}-${i}`,
            exerciseId: e.exerciseId,
            name: e.name,
            label: e.label,
            isMain: e.isMain,
            targetRpe: e.targetRpe,
            sets: e.sets.map((s, si) => ({ id: `ws${Date.now()}-${i}-${si}`, w: s.w, r: s.r, done: false })),
          })),
        }
        set({ workout: w, showPicker: false })
      },

      updateWorkout: (workout) => set({ workout }),

      addExerciseToWorkout: (exerciseId) => set(state => {
        if (!state.workout) return {}
        const exercises = [
          ...state.workout.exercises,
          { id: `we${Date.now()}`, exerciseId, isMain: false, sets: [{ id: `ws${Date.now()}`, w: 0, r: 8, done: false }] },
        ]
        return { workout: { ...state.workout, exercises, currentIdx: exercises.length - 1 } }
      }),

      finishWorkout: () => {
        const { workout, history, bodyMetrics } = get()
        if (!workout) return null
        const duration = Math.max(1, Math.round((Date.now() - workout.startTime) / 60000))
        const volume = workout.exercises.reduce((s, e) =>
          s + e.sets.filter(x => x.done).reduce((ss, st) => ss + (st.w * st.r), 0), 0)
        const setCount = workout.exercises.reduce((s, e) => s + e.sets.filter(x => x.done).length, 0)
        const calories = sessionCalories(
          { exercises: workout.exercises, duration },
          latestWeightKg(bodyMetrics),
        )
        const session: Session = {
          id: 'h' + Date.now(),
          programId: workout.programId,
          name: workout.name,
          date: new Date().toISOString(),
          duration,
          volume,
          setCount,
          calories,
          exercises: workout.exercises,
        }
        set({ history: [session, ...history], workout: null })

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
        // Logged from a program day → that day counts as trained. Mirrors the
        // setDayStatus write finishWorkout does for a lifting day.
        if (entry.dayRef) useProgramStore.getState().setRunDayStatus(entry.dayRef, true)
      },
      removeRun: (id) => {
        const ref = get().runs.find(e => e.id === id)?.dayRef
        set(state => ({ runs: state.runs.filter(e => e.id !== id) }))
        void syncRunDelete(id)
        // Only the last run for that day rewinds it — two runs on one day is valid.
        if (ref && !get().runs.some(e => e.dayRef === ref)) {
          useProgramStore.getState().setRunDayStatus(ref, false)
        }
      },
      setRuns: (runs) => set({ runs }),

      addOneRMEntry: (entry) => { get().addOneRMEntries([entry]) },
      addOneRMEntries: (entries) => {
        appendOneRMs(entries)
        // Promote to the live value only when the new row is the newest for its
        // lift — backdating an old test must never clobber the weight an active
        // program is prescribing from.
        const { oneRMHistory, personalOneRMs } = get()
        const derived = latestOneRMs(oneRMHistory, personalOneRMs)
        if (LIFT_ORDER.some(k => derived[k] !== personalOneRMs[k])) {
          set({ personalOneRMs: derived })
          useProgramStore.getState().syncSettings()
        }
      },
      removeOneRMEntry: (id) => {
        // personalOneRMs is deliberately NOT rewound when the newest row goes:
        // tidying the chart should not silently change every prescribed weight.
        set(state => ({ oneRMHistory: state.oneRMHistory.filter(e => e.id !== id) }))
        void syncOneRMDelete(id)
      },
      setOneRMHistory: (oneRMHistory) => set({ oneRMHistory }),

      addCustomExercise: (ex) => {
        set(state => {
          const list = [...state.customExercises.filter(e => e.id !== ex.id), ex]
          setCustomExercisesRegistry(list)
          return { customExercises: list }
        })
        void syncExercise(ex)
      },
      removeCustomExercise: (id) => {
        set(state => {
          const list = state.customExercises.filter(e => e.id !== id)
          setCustomExercisesRegistry(list)
          return { customExercises: list }
        })
        void syncExerciseDelete(id)
      },
      setCustomExercises: (list) => {
        setCustomExercisesRegistry(list)
        set({ customExercises: list })
      },
      setDbExercises: (list) => {
        setDbExercisesRegistry(list)
        set({ dbExercises: list })
      },

      clearMetrics: () => {
        setCustomExercisesRegistry([])
        set({ bodyMetrics: [], runs: [], oneRMHistory: [], customExercises: [], bio: {}, personalOneRMs: { squat: 0, bench: 0, deadlift: 0 } })
      },
    }
    },
    {
      name: 'atlas:v2',
      partialize: (state) => ({
        theme: state.theme,
        history: state.history,
        workout: state.workout,
        personalOneRMs: state.personalOneRMs,
        bio: state.bio,
        bodyMetrics: state.bodyMetrics,
        runs: state.runs,
        // New top-level key: zustand shallow-merges the persisted blob over the
        // initializer, so existing atlas:v2 blobs (which lack it) keep the [].
        oneRMHistory: state.oneRMHistory,
        customExercises: state.customExercises,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.customExercises) setCustomExercisesRegistry(state.customExercises)
      },
    }
  )
)
