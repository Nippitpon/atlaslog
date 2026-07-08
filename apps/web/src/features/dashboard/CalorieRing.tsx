interface CalorieRingProps {
  calories: number
  peak: number
  subtitle?: string
  onClick?: () => void
}

export function CalorieRing({ calories, peak, subtitle, onClick }: CalorieRingProps) {
  const size = 132
  const stroke = 10
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const frac = peak > 0 ? Math.min(1, calories / peak) : 0

  return (
    <button
      onClick={onClick}
      style={{
        all: 'unset', cursor: onClick ? 'pointer' : 'default',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      }}
    >
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke="var(--surface-3)" strokeWidth={stroke}
          />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke="var(--accent)" strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - frac)}
            style={{ transition: 'stroke-dashoffset .5s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <div className="stat-big tnum" style={{ fontSize: 34, lineHeight: 1 }}>{calories}</div>
          <div className="t-eyebrow" style={{ fontSize: 9, marginTop: 3 }}>KCAL TODAY</div>
        </div>
      </div>
      {subtitle && (
        <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center' }}>
          {subtitle}
        </div>
      )}
    </button>
  )
}
