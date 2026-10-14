import { create } from 'zustand'
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js'
import type { AppNotification } from '@atlaslog/shared'
import { supabase } from '../lib/supabase.js'
import { flushQueue } from '../lib/syncQueue.js'
import { fetchNotifications } from '../lib/notificationsApi.js'
import { latestOneRMs } from '../lib/oneRM.js'
import { loginWithUsername, saveUsername, completeForcedPasswordChange } from '../lib/authApi.js'
import { isEmailIdentifier, normalizeUsername } from '../lib/username.js'
import { useAppStore } from './useAppStore.js'
import { useProgramStore } from './useProgramStore.js'

interface AuthStore {
  user: User | null
  isAdmin: boolean
  isCoach: boolean
  roleLoaded: boolean
  username: string | null
  mustChangePassword: boolean
  // Set once per signed-in user (NOT reset on a refired SIGNED_IN) so the app
  // can wait for the forced-change flag without unmounting on a tab refocus.
  profileLoaded: boolean
  notifications: AppNotification[]
  initialized: boolean
  init: () => void
  signIn: (identifier: string, password: string) => Promise<string | null>
  signUp: (email: string, username: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  resendConfirmation: (email: string) => Promise<string | null>
  refreshNotifications: () => Promise<void>
  setUsername: (username: string) => Promise<string | null>
  completeForcedPasswordChange: (newPassword: string) => Promise<string | null>
}

interface ProfileRow { role: string; username: string | null; mustChangePassword: boolean }

// Never throws and never loses the role: if the new columns aren't deployed yet
// (client shipped before SQL §2l) fall back to reading role alone.
async function loadProfile(userId: string): Promise<ProfileRow> {
  try {
    const full = await supabase
      .from('profiles').select('role, username, must_change_password').eq('id', userId).single()
    if (!full.error && full.data) {
      return {
        role: full.data.role ?? 'user',
        username: full.data.username ?? null,
        mustChangePassword: full.data.must_change_password === true,
      }
    }
    const basic = await supabase.from('profiles').select('role').eq('id', userId).single()
    return { role: basic.data?.role ?? 'user', username: null, mustChangePassword: false }
  } catch {
    return { role: 'user', username: null, mustChangePassword: false }
  }
}

// A user counts as a coach if an admin assigned the 'coach' role OR they already
// have active athlete links (preserves coaches linked before roles existed).
async function loadIsCoach(userId: string, role: string): Promise<boolean> {
  if (role === 'coach') return true
  const { count } = await supabase
    .from('coach_athlete')
    .select('id', { count: 'exact', head: true })
    .eq('coach_id', userId)
    .eq('status', 'active')
  return (count ?? 0) > 0
}

// PostgREST returns at most 1000 rows/request — page through the whole table.
async function fetchAllExercises() {
  const PAGE = 1000
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all: any[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('exercises')
      .select('id,name,muscle_group,equipment,target,gif_path')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error || !data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE) break
  }
  return all
}

async function loadUserData(userId: string) {
  const [sessionsRes, programsRes, stateRes, bodyRes, runsRes, oneRmRes, exRes, dbExRes] = await Promise.all([
    supabase.from('sessions').select('*').eq('user_id', userId).order('date', { ascending: false }),
    supabase.from('custom_programs').select('*').eq('user_id', userId).order('id', { ascending: true }),
    supabase.from('program_state').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('body_metrics').select('*').eq('user_id', userId).order('date', { ascending: false }),
    supabase.from('runs').select('*').eq('user_id', userId).order('date', { ascending: false }),
    supabase.from('one_rm_records').select('*').eq('user_id', userId).order('date', { ascending: false }),
    supabase.from('custom_exercises').select('*').order('created_at', { ascending: true }),
    // Library dataset (Phase 6): paginated (PostgREST caps at 1000 rows/request).
    fetchAllExercises(),
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
  // Only overwrite local program state when the cloud actually has a row —
  // otherwise preserve local edits still pending in the sync queue.
  if (stateRes.data) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = stateRes.data as any
    useProgramStore.getState().setProgramState({
      progress: s.progress ?? {},
      configs: s.configs ?? {},
      customAccessories: s.custom_accessories ?? {},
      programMeta: s.program_meta ?? {},
    })
    if (s.bio) useAppStore.setState({ bio: s.bio })
    if (s.personal_one_rms) useAppStore.setState({ personalOneRMs: s.personal_one_rms })
  }
  if (bodyRes.data) {
    useAppStore.getState().setBodyMetrics(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (bodyRes.data as any[]).map(r => ({
        id: r.id,
        date: r.date,
        weightKg: r.weight_kg,
        skeletalMuscleKg: r.skeletal_muscle_kg ?? undefined,
        bodyFatPct: r.body_fat_pct ?? undefined,
      }))
    )
  }
  if (runsRes.data) {
    useAppStore.getState().setRuns(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (runsRes.data as any[]).map(r => ({
        id: r.id,
        date: r.date,
        distanceKm: r.distance_km,
        durationMin: r.duration_min,
        note: r.note ?? undefined,
        dayRef: r.day_ref ?? undefined,
      }))
    )
  }
  if (oneRmRes.data) {
    useAppStore.getState().setOneRMHistory(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (oneRmRes.data as any[]).map(r => ({
        id: r.id,
        date: r.date,
        lift: r.lift,
        weightKg: r.weight_kg,
        source: r.source ?? undefined,
        note: r.note ?? undefined,
      }))
    )
    // The dated log outranks the undated program_state blob. setState (not the
    // action) so this can't bounce back out through syncSettings().
    const hist = useAppStore.getState().oneRMHistory
    if (hist.length) {
      useAppStore.setState({
        personalOneRMs: latestOneRMs(hist, useAppStore.getState().personalOneRMs),
      })
    }
  }
  if (exRes.data) {
    useAppStore.getState().setCustomExercises(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (exRes.data as any[]).map(r => ({
        id: r.id,
        name: r.name,
        group: r.muscle_group,
        equipment: r.equipment ?? '',
      }))
    )
  }
  if (dbExRes.length) {
    useAppStore.getState().setDbExercises(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (dbExRes as any[]).map(r => ({
        id: r.id,
        name: r.name,
        group: r.muscle_group,
        equipment: r.equipment ?? '',
        target: r.target ?? undefined,
        gifPath: r.gif_path ?? undefined,
      }))
    )
  }
}

const SIGNED_OUT_STATE = {
  user: null, isAdmin: false, isCoach: false, username: null,
  mustChangePassword: false, profileLoaded: false, notifications: [],
} as const

export const useAuthStore = create<AuthStore>()((set) => {
  const applyProfile = (userId: string) => {
    loadProfile(userId).then(p => {
      set({
        isAdmin: p.role === 'admin',
        username: p.username,
        mustChangePassword: p.mustChangePassword,
        profileLoaded: true,
      })
      loadIsCoach(userId, p.role).then(isCoach => set({ isCoach, roleLoaded: true }))
    })
  }

  return {
  user: null,
  isAdmin: false,
  isCoach: false,
  roleLoaded: false,
  username: null,
  mustChangePassword: false,
  profileLoaded: false,
  notifications: [],
  initialized: false,

  init: () => {
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      set({ user: data.session?.user ?? null, initialized: true })
      const u = data.session?.user
      if (u) {
        loadUserData(u.id)
        void flushQueue()
        applyProfile(u.id)
        fetchNotifications(u.id).then(notifications => set({ notifications })).catch(() => {})
      } else {
        set({ roleLoaded: true })
      }
    })
    supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      set({ user: session?.user ?? null })
      if (event === 'SIGNED_IN' && session?.user) {
        const u = session.user
        set({ roleLoaded: false })
        loadUserData(u.id)
        void flushQueue()
        applyProfile(u.id)
        fetchNotifications(u.id).then(notifications => set({ notifications })).catch(() => {})
      }
      if (event === 'SIGNED_OUT') set({ ...SIGNED_OUT_STATE, notifications: [], roleLoaded: true })
    })
    window.addEventListener('online', () => { void flushQueue() })
  },

  // An identifier with '@' is an email and signs in directly; anything else is a
  // username, resolved server-side by the auth-login edge function.
  signIn: async (identifier, password) => {
    const id = identifier.trim()
    if (!isEmailIdentifier(id)) return loginWithUsername(normalizeUsername(id), password)
    const { error } = await supabase.auth.signInWithPassword({ email: id, password })
    return error?.message ?? null
  },

  signUp: async (email, username, password) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: normalizeUsername(username) } },
    })
    return error?.message ?? null
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ ...SIGNED_OUT_STATE, notifications: [] })
  },

  setUsername: async (username) => {
    const res = await saveUsername(username)
    if ('error' in res) return res.error
    set({ username: res.username })
    return null
  },

  completeForcedPasswordChange: async (newPassword) => {
    const err = await completeForcedPasswordChange(newPassword)
    if (err) return err
    set({ mustChangePassword: false })
    return null
  },

  resendConfirmation: async (email) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    return error?.message ?? null
  },

  refreshNotifications: async () => {
    const { data } = await supabase.auth.getUser()
    if (!data.user) return
    try {
      const notifications = await fetchNotifications(data.user.id)
      set({ notifications })
    } catch { /* ignore */ }
  },
  }
})
