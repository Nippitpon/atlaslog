import { useMemo } from 'react'

type Props = {
  value: string                       // ISO 'YYYY-MM-DD' or ''
  onChange: (iso: string) => void
  max?: string                        // ISO upper bound (e.g. today)
  min?: string                        // ISO lower bound
}

const pad = (n: number) => String(n).padStart(2, '0')
const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate()

const selectStyle: React.CSSProperties = {
  height: 48, background: 'var(--surface-2)', border: '1px solid var(--border)',
  borderRadius: 12, color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 14,
  padding: '0 8px', outline: 'none', boxSizing: 'border-box', textAlign: 'center',
}

// Day / Month / Year picker — always renders in DD/MM/YYYY order. Year is C.E. (ค.ศ.).
export function DateField({ value, onChange, max, min }: Props) {
  const [y, m, d] = value ? value.split('-').map(Number) : [NaN, NaN, NaN]

  const years = useMemo(() => {
    const maxY = max ? Number(max.slice(0, 4)) : new Date().getFullYear() + 5
    const minY = min ? Number(min.slice(0, 4)) : maxY - 100
    const out: number[] = []
    for (let yr = maxY; yr >= minY; yr--) out.push(yr)
    return out
  }, [max, min])

  const dayCount = Number.isNaN(y) || Number.isNaN(m) ? 31 : daysInMonth(y, m)

  const emit = (nd: number, nm: number, ny: number) => {
    if (!nd || !nm || !ny) return onChange('')
    const clampedDay = Math.min(nd, daysInMonth(ny, nm))
    let iso = `${ny}-${pad(nm)}-${pad(clampedDay)}`
    if (max && iso > max) iso = max
    if (min && iso < min) iso = min
    onChange(iso)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1.2fr', gap: 8 }}>
      <select style={selectStyle} value={Number.isNaN(d) ? '' : d}
        onChange={e => emit(Number(e.target.value), m, y)}>
        <option value="" disabled>DD</option>
        {Array.from({ length: dayCount }, (_, i) => i + 1).map(n => (
          <option key={n} value={n}>{pad(n)}</option>
        ))}
      </select>
      <select style={selectStyle} value={Number.isNaN(m) ? '' : m}
        onChange={e => emit(d, Number(e.target.value), y)}>
        <option value="" disabled>MM</option>
        {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
          <option key={n} value={n}>{pad(n)}</option>
        ))}
      </select>
      <select style={selectStyle} value={Number.isNaN(y) ? '' : y}
        onChange={e => emit(d, m, Number(e.target.value))}>
        <option value="" disabled>YYYY</option>
        {years.map(yr => (
          <option key={yr} value={yr}>{yr}</option>
        ))}
      </select>
    </div>
  )
}
