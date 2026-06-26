import { useRef } from 'react'
import { formatDMY } from '../lib/utils.js'
import { IconCalendar } from './icons/index.js'

type Props = {
  value: string                       // ISO 'YYYY-MM-DD' or ''
  onChange: (iso: string) => void
  max?: string                        // ISO upper bound (e.g. today)
  min?: string                        // ISO lower bound
}

// Native date picker (OS calendar) with a DD/MM/YYYY display overlay.
// The native <input type="date"> sits on top at opacity 0 so a tap lands on it
// directly and opens the OS calendar; we render the value as DD/MM/YYYY (ค.ศ.)
// behind it since the native control's own text follows the browser locale.
export function DateField({ value, onChange, max, min }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div style={{
      position: 'relative', height: 56, borderRadius: 14,
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', padding: '0 14px', boxSizing: 'border-box',
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 16, pointerEvents: 'none',
        color: value ? 'var(--text)' : 'var(--muted)',
      }}>
        {value ? formatDMY(value) : 'DD/MM/YYYY'}
      </span>
      <IconCalendar size={18} style={{ marginLeft: 'auto', color: 'var(--muted)', pointerEvents: 'none' }} />
      <input
        ref={inputRef}
        type="date"
        value={value}
        max={max}
        min={min}
        onChange={e => onChange(e.target.value)}
        onClick={() => { try { inputRef.current?.showPicker() } catch { /* unsupported / no gesture */ } }}
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          opacity: 0, cursor: 'pointer', colorScheme: 'dark', border: 'none',
        }}
      />
    </div>
  )
}
