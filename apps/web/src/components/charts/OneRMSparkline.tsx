import type { LiftSeries, OneRMPoint } from '../../lib/oneRM.js'
import { LIFT_COLOR, makeScale, polyPoints, type Box } from './oneRMScale.js'

interface OneRMSparklineProps {
  series: LiftSeries[]
}

const VB_W = 210
const VB_H = 26

// Manual series only, no axes. Returns null unless some lift has 2+ points —
// nothing is drawable below that, and the caller's whole section should vanish
// rather than show an empty stub (same instinct as the sbdTotal / trend guards).
export function OneRMSparkline({ series }: OneRMSparklineProps) {
  const box: Box = { w: VB_W, h: VB_H, padL: 2, padR: 4, padT: 3, padB: 3 }
  if (!series.some(s => s.manual.length >= 2)) return null
  const visible: OneRMPoint[] = series.flatMap(s => s.manual)

  const scale = makeScale(visible, box)
  if (!scale) return null

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {series.map(s => s.manual.length >= 2 && (
        <g key={s.lift}>
          <polyline
            fill="none"
            stroke={LIFT_COLOR[s.lift]}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polyPoints(s.manual, scale)}
          />
          <circle
            cx={scale.x(s.manual[s.manual.length - 1].t)}
            cy={scale.y(s.manual[s.manual.length - 1].value)}
            r={2}
            fill={LIFT_COLOR[s.lift]}
          />
        </g>
      ))}
    </svg>
  )
}
