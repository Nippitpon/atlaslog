import type { Session } from '@atlaslog/shared'
import { EXERCISES } from './data.js'

export function weeklyVolume(history: Session[]) {
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    d.setHours(0, 0, 0, 0)
    const next = new Date(d)
    next.setDate(next.getDate() + 1)
    const vol = history
      .filter(h => { const hd = new Date(h.date); return hd >= d && hd < next })
      .reduce((sum, h) => sum + h.volume, 0)
    days.push({
      date: d,
      label: ['S','M','T','W','T','F','S'][d.getDay()],
      volume: vol,
      isToday: i === 0,
    })
  }
  return days
}

export function getExercise(id: string) {
  return EXERCISES.find(e => e.id === id) ?? { id, name: 'Exercise', group: '', equipment: '' }
}

export function formatDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'TODAY'
  if (diff === 1) return 'YESTERDAY'
  if (diff < 7) return `${diff} DAYS AGO`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
}

export function programVolume(prog: { exercises: { sets: { w: number; r: number }[] }[] }) {
  return prog.exercises.reduce((s, ex) =>
    s + ex.sets.reduce((ss, st) => ss + (st.w * st.r), 0), 0)
}

export function muscleColor(group: string) {
  const map: Record<string, string> = {
    Chest: '#ff6b6b', Back: '#4ecdc4', Legs: '#ffd93d',
    Shoulders: '#a78bfa', Arms: '#3aaaff', Core: '#ff9b3a',
  }
  return map[group] ?? '#888'
}

export function getDayOfWeek() {
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const now = new Date()
  return `${days[now.getDay()].toUpperCase()} · ${months[now.getMonth()].slice(0,3).toUpperCase()} ${now.getDate()}`
}
