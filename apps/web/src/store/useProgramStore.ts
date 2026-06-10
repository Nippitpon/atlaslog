import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DayStatus, ProgramProgressState, ProgramConfig, StructuredExercise, StructuredProgram } from '@atlaslog/shared'
import { supabase } from '../lib/supabase.js'

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
  removeCustomProgram: (programId: string) => void
  setCustomPrograms: (programs: StructuredProgram[]) => void
  clearCustomPrograms: () => void
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
      },

      setConfig: (programId, config) => {
        set(state => ({
          configs: { ...state.configs, [programId]: config },
        }))
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
      },

      getCustomAccessories: (programId, weekId, dayId) => {
        return get().customAccessories[programId]?.[weekId]?.[dayId] ?? null
      },

      addCustomProgram: (program) => {
        set(state => ({
          customPrograms: [...state.customPrograms.filter(p => p.id !== program.id), program],
        }))
        supabase.auth.getUser().then(({ data }) => {
          if (!data.user) return
          supabase.from('custom_programs').upsert({ id: program.id, user_id: data.user.id, program }).then(() => {})
        })
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
        supabase.auth.getUser().then(({ data }) => {
          if (!data.user) return
          supabase.from('custom_programs').delete().eq('id', programId).then(() => {})
        })
      },

      setCustomPrograms: (programs) => set({ customPrograms: programs }),
      clearCustomPrograms: () => set({ customPrograms: [] }),
    }),
    {
      name: 'atlas:v1:program-progress',
    }
  )
)
