import { create } from 'zustand'
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase.js'
import { flushQueue } from '../lib/syncQueue.js'
import { useAppStore } from './useAppStore.js'
import { useProgramStore } from './useProgramStore.js'

interface AuthStore {
  user: User | null
  isAdmin: boolean
  initialized: boolean
  init: () => void
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  resendConfirmation: (email: string) => Promise<string | null>
}

async function loadRole(userId: string): Promise<boolean> {
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).single()
  return data?.role === 'admin'
}

async function loadUserData(userId: string) {
  const [sessionsRes, programsRes] = await Promise.all([
    supabase.from('sessions').select('*').eq('user_id', userId).order('date', { ascending: false }),
    supabase.from('custom_programs').select('*').eq('user_id', userId),
  ])
  if (sessionsRes.data) {
    useAppStore.getState().setHistory(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sessionsRes.data as any[]).map(r => ({
        id: r.id,
        programId: r.program_id,
        name: r.name,
        date: r.date,
        duration: r.duration,
        volume: r.volume,
        setCount: r.set_count,
        exercises: r.exercises,
      }))
    )
  }
  if (programsRes.data) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useProgramStore.getState().setCustomPrograms((programsRes.data as any[]).map(r => r.program))
  }
}

export const useAuthStore = create<AuthStore>()((set) => ({
  user: null,
  isAdmin: false,
  initialized: false,

  init: () => {
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      set({ user: data.session?.user ?? null, initialized: true })
      if (data.session?.user) {
        void flushQueue()
        loadRole(data.session.user.id).then(isAdmin => set({ isAdmin }))
      }
    })
    supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      set({ user: session?.user ?? null })
      if (event === 'SIGNED_IN' && session?.user) {
        loadUserData(session.user.id)
        void flushQueue()
        loadRole(session.user.id).then(isAdmin => set({ isAdmin }))
      }
      if (event === 'SIGNED_OUT') set({ isAdmin: false })
    })
    window.addEventListener('online', () => { void flushQueue() })
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error?.message ?? null
  },

  signUp: async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password })
    return error?.message ?? null
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, isAdmin: false })
  },

  resendConfirmation: async (email) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    return error?.message ?? null
  },
}))
