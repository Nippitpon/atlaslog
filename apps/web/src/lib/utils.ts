import type { Session } from '@atlaslog/shared'
import { EXERCISES, CUSTOM_EXERCISES, DB_EXERCISES } from './data.js'

export function weeklyVolume(history: Session[]) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Start of the current calendar week = Sunday (getDay(): 0=Sun..6=Sat)
  const weekStart = new Date(today)
  weekStart.setDate(weekStart.getDate() - today.getDay())

  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    const next = new Date(d)
    next.setDate(next.getDate() + 1)
    const vol = history
      .filter(h => { const hd = new Date(h.date); return hd >= d && hd < next })
      .reduce((sum, h) => sum + h.volume, 0)
    days.push({
      date: d,
      label: ['S','M','T','W','T','F','S'][d.getDay()],
      volume: vol,
      isToday: d.getTime() === today.getTime(),
    })
  }
  return days
}

export function getExercise(id: string) {
  return EXERCISES.find(e => e.id === id)
    ?? DB_EXERCISES.find(e => e.id === id)
    ?? CUSTOM_EXERCISES.find(e => e.id === id)
    ?? { id, name: 'Exercise', group: '', equipment: '' }
}

// ExerciseDB media CDN. gifPath is the record's media_id (e.g. "2gPfomN").
// NOTE: the documented host static.exercisedb.dev is currently NXDOMAIN (dead) —
// the free ExerciseDB GIF CDN is no longer publicly resolvable. Media is disabled
// until a working host is available; gif_path is still stored so we can flip this
// on later by returning the URL. Single place that builds the URL.
const MEDIA_HOST = '' // e.g. 'https://static.exercisedb.dev/media' once a host works
export function exerciseGifUrl(gifPath?: string): string | null {
  return MEDIA_HOST && gifPath ? `${MEDIA_HOST}/${gifPath}.gif` : null
}

// Absolute calendar date as DD/MM/YYYY — app-wide format. Year is C.E. (ค.ศ.).
export function formatDMY(input: string | Date) {
  const d = input instanceof Date ? input : new Date(input)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

// Short DD/MM (no year) — for compact ranges
export function formatDM(input: string | Date) {
  const d = input instanceof Date ? input : new Date(input)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}`
}

export function formatDate(iso: string) {
  const d = new Date(iso); d.setHours(0, 0, 0, 0)
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const diff = Math.round((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'TODAY'
  if (diff === 1) return 'YESTERDAY'
  if (diff > 0 && diff < 7) return `${diff} DAYS AGO`
  return formatDMY(d)
}

export function programVolume(prog: { exercises: { sets: { w: number; r: number }[] }[] }) {
  return prog.exercises.reduce((s, ex) =>
    s + ex.sets.reduce((ss, st) => ss + (st.w * st.r), 0), 0)
}

export function muscleColor(group: string) {
  const map: Record<string, string> = {
    Chest: '#ff6b6b', Back: '#4ecdc4', Legs: '#ffd93d',
    Shoulders: '#a78bfa', Arms: '#3aaaff', Core: '#ff9b3a', Other: '#7a8a99',
  }
  return map[group] ?? '#888'
}

// Human label for a program running target, e.g. "5 km · 30 min" (empty if neither set)
export function runTarget(ex: { distanceKm?: number; durationMin?: number }): string {
  const parts: string[] = []
  if (ex.distanceKm) parts.push(`${ex.distanceKm} km`)
  if (ex.durationMin) parts.push(`${ex.durationMin} min`)
  return parts.join(' · ')
}

// Running pace: min/km → "M:SS" (per km)
export function formatPace(distanceKm: number, durationMin: number): string {
  if (!distanceKm || !durationMin) return '—'
  const paceMin = durationMin / distanceKm
  const m = Math.floor(paceMin)
  const s = Math.round((paceMin - m) * 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function getDayOfWeek() {
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const now = new Date()
  return `${days[now.getDay()].toUpperCase()} · ${formatDMY(now)}`
}
