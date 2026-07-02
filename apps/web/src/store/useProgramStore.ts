import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DayStatus, ProgramProgressState, ProgramConfig, StructuredExercise, StructuredProgram, ProgramStateSnapshot } from '@atlaslog/shared'
import { syncProgramUpsert, syncProgramDelete, syncProgramState } from '../lib/syncQueue.js'
import { useAppStore } from './useAppStore.js'

type CustomAccessories = {
  [programId: string]: {
    [weekId: string]: {
      [dayId: string]: StructuredExercise[]
    }
  }
}

interface ProgramStore {
  progress: ProgramProgressState
  configs: { [programId: string]: ProgramConfig }
  customAccessories: CustomAccessories
  customPrograms: StructuredProgram[]

  getDayStatus: (programId: string, weekId: string, dayId: string) => DayStatus
  getWeekStatus: (programId: string, weekId: string, dayCount: number) => DayStatus
  setDayStatus: (programId: string, weekId: string, dayId: string, status: DayStatus) => void
  resetProgram: (programId: string) => void

  setConfig: (programId: string, config: ProgramConfig) => void
  getConfig: (programId: string) => ProgramConfig | null

  setCustomAccessories: (programId: string, weekId: string, dayId: string, exercises: StructuredExercise[]) => void
  getCustomAccessories: (programId: string, weekId: string, dayId: string) => StructuredExercise[] | null

  addCustomProgram: (program: StructuredProgram) => void
  updateCustomProgram: (program: StructuredProgram) => void
  removeCustomProgram: (programId: string) => void
  setCustomPrograms: (programs: StructuredProgram[]) => void
  clearCustomPrograms: () => void
  setProgramState: (snapshot: ProgramStateSnapshot) => void
  syncSettings: () => void
}

// Debounce cloud sync of the full program-state blob; coalesces rapid edits
let stateSyncTimer: ReturnType<typeof setTimeout> | null = null
function queueStateSync(get: () => ProgramStore) {
  if (stateSyncTimer) clearTimeout(stateSyncTimer)
  stateSyncTimer = setTimeout(() => {
    const { progress, configs, customAccessories } = get()
    // User settings (bio + 1RM) live in useAppStore but share this 1-row blob.
    const { bio, personalOneRMs } = useAppStore.getState()
    void syncProgramState({ progress, configs, customAccessories, bio, personalOneRMs })
  }, 800)
}

export const useProgramStore = create<ProgramStore>()(
  persist(
    (set, get) => ({
      progress: {},
      configs: {},
      customAccessories: {},
      customPrograms: [],

      getDayStatus: (programId, weekId, dayId) => {
        return get().progress[programId]?.[weekId]?.[dayId] ?? 'not_started'
      },

      getWeekStatus: (programId, weekId, dayCount) => {
        const weekProgress = get().progress[programId]?.[weekId] ?? {}
        const statuses = Object.values(weekProgress)
        const doneCount = statuses.filter(s => s === 'done').length
        const inProgressCount = statuses.filter(s => s === 'in_progress').length
        if (doneCount === dayCount) return 'done'
        if (doneCount > 0 || inProgressCount > 0) return 'in_progress'
        return 'not_started'
      },

      setDayStatus: (programId, weekId, dayId, status) => {
        set(state => ({
          progress: {
            ...state.progress,
            [programId]: {
              ...state.progress[programId],
              [weekId]: {
                ...state.progress[programId]?.[weekId],
                [dayId]: status,
              },
            },
          },
        }))
        queueStateSync(get)
      },

      resetProgram: (programId) => {
        set(state => {
          const nextProgress = { ...state.progress }
          delete nextProgress[programId]
          const nextConfigs = { ...state.configs }
          delete nextConfigs[programId]
          const nextCustom = { ...state.customAccessories }
          delete nextCustom[programId]
          return { progress: nextProgress, configs: nextConfigs, customAccessories: nextCustom }
        })
        queueStateSync(get)
      },

      setConfig: (programId, config) => {
        set(state => ({
          configs: { ...state.configs, [programId]: config },
        }))
        queueStateSync(get)
      },

      getConfig: (programId) => {
        return get().configs[programId] ?? null
      },

      setCustomAccessories: (programId, weekId, dayId, exercises) => {
        set(state => ({
          customAccessories: {
            ...state.customAccessories,
            [programId]: {
              ...state.customAccessories[programId],
              [weekId]: {
                ...state.customAccessories[programId]?.[weekId],
                [dayId]: exercises,
              },
            },
          },
        }))
        queueStateSync(get)
      },

      getCustomAccessories: (programId, weekId, dayId) => {
        return get().customAccessories[programId]?.[weekId]?.[dayId] ?? null
      },

      addCustomProgram: (program) => {
        set(state => ({
          customPrograms: [...state.customPrograms.filter(p => p.id !== program.id), program],
        }))
        void syncProgramUpsert(program)
      },

      // Edit an existing program in place (same id): upsert + prune progress/
      // accessories for weeks/days that no longer exist + recompute config.endDate.
      updateCustomProgram: (program) => {
        set(state => {
          // Valid week ids → set of valid day ids in the new structure
          const validDays: Record<string, Set<string>> = {}
          program.weeks.forEach(w => { validDays[w.id] = new Set(w.days.map(d => d.id)) })

          const pruneNested = <T,>(byWeek: Record<string, Record<string, T>> | undefined) => {
            if (!byWeek) return byWeek
            const next: Record<string, Record<string, T>> = {}
            for (const [weekId, byDay] of Object.entries(byWeek)) {
              const days = validDays[weekId]
              if (!days) continue // week removed → drop
              const keptDays: Record<string, T> = {}
              for (const [dayId, val] of Object.entries(byDay)) {
                if (days.has(dayId)) keptDays[dayId] = val
              }
              if (Object.keys(keptDays).length) next[weekId] = keptDays
            }
            return next
          }

          const progress = { ...state.progress }
          if (progress[program.id]) progress[program.id] = pruneNested(progress[program.id])!
          const customAccessories = { ...state.customAccessories }
          if (customAccessories[program.id]) customAccessories[program.id] = pruneNested(customAccessories[program.id])!

          // Recompute endDate from the new week count (keep startDate + 1RM);
          // drop config entirely if the program became a weekly routine.
          const configs = { ...state.configs }
          const cfg = configs[program.id]
          if (cfg) {
            if (program.weekly) {
              delete configs[program.id]
            } else {
              const [y, m, d] = cfg.startDate.split('-').map(Number)
              const end = new Date(y, m - 1, d + program.totalWeeks * 7)
              const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
              configs[program.id] = { ...cfg, endDate }
            }
          }

          return {
            customPrograms: [...state.customPrograms.filter(p => p.id !== program.id), program],
            progress,
            customAccessories,
            configs,
          }
        })
        void syncProgramUpsert(program)
        queueStateSync(get)
      },

      removeCustomProgram: (programId) => {
        set(state => {
          const nextProgress = { ...state.progress }
          delete nextProgress[programId]
          const nextConfigs = { ...state.configs }
          delete nextConfigs[programId]
          const nextCustom = { ...state.customAccessories }
          delete nextCustom[programId]
          return {
            customPrograms: state.customPrograms.filter(p => p.id !== programId),
            progress: nextProgress,
            configs: nextConfigs,
            customAccessories: nextCustom,
          }
        })
        void syncProgramDelete(programId)
        queueStateSync(get)
      },

      setCustomPrograms: (programs) => set({ customPrograms: programs }),
      clearCustomPrograms: () => set({ customPrograms: [] }),

      // Load cloud snapshot on login — does NOT re-trigger sync
      setProgramState: (snapshot) => set({
        progress: snapshot.progress ?? {},
        configs: snapshot.configs ?? {},
        customAccessories: snapshot.customAccessories ?? {},
      }),

      // Trigger a debounced cloud sync when user settings (bio/1RM) change
      syncSettings: () => queueStateSync(get),
    }),
    {
      name: 'atlas:v1:program-progress',
    }
  )
)
