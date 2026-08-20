interface MiniBarsProps {
  values: number[]          // oldest → newest
  height?: number
  maxBarWidth?: number
  gap?: number
  color?: string
}

// Normalized bar sparkline. Bars span 20–100% of the track so the smallest value
// stays visible instead of collapsing to nothing. Returns null below 2 values —
// a single bar carries no trend.
export function MiniBars({
  values,
  height = 56,
  maxBarWidth = 18,
  gap = 4,
  color = 'var(--accent)',
}: MiniBarsProps) {
  if (values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(1, max - min)

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap, height }}>
      {values.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1, display: 'flex', alignItems: 'flex-end',
            justifyContent: 'center', height: '100%',
          }}
        >
          <div style={{
            width: '100%', maxWidth: maxBarWidth,
            height: `${20 + ((v - min) / range) * 80}%`,
            background: color, borderRadius: 3, opacity: 0.85,
          }} />
        </div>
      ))}
    </div>
  )
}
