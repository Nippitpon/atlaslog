import { formatDM, formatNum2 } from '../../lib/utils.js'
import { makeScale, polyPoints, FINE_STEPS, type Box, type ChartPoint } from './oneRMScale.js'

interface MetricChartProps {
  points: ChartPoint[]          // oldest → newest
  color: string
  unit: string
  height?: number
}

const VB_W = 320
const PAD_L = 34
const PAD_R = 6
const PAD_T = 10
const PAD_B = 20

// One dated series. Deliberately simpler than OneRMChart, which has to fit three
// lifts and a measured/estimated split; here the caller switches between measures
// instead, because kg and % cannot share a y-axis.
export function MetricChart({ points, color, unit, height = 168 }: MetricChartProps) {
  const box: Box = { w: VB_W, h: height, padL: PAD_L, padR: PAD_R, padT: PAD_T, padB: PAD_B }
  const scale = makeScale(points, box, FINE_STEPS)

  if (!scale || points.length < 2) {
    return (
      <div
        className="t-mono"
        style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', padding: '24px 8px' }}
      >
        {points.length === 1
          ? 'มีข้อมูลจุดเดียว — บันทึกอีกครั้งเพื่อดูกราฟแนวโน้ม'
          : 'ยังไม่มีข้อมูลของค่านี้'}
      </div>
    )
  }

  const firstT = points[0]!.t
  const lastT = points[points.length - 1]!.t

  return (
    <svg viewBox={`0 0 ${VB_W} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* Three gridlines only; vertical ones just add clutter at this width */}
      {scale.ticks.map((v, i) => (
        <g key={i}>
          <line
            x1={PAD_L} x2={VB_W - PAD_R}
            y1={scale.y(v)} y2={scale.y(v)}
            stroke="var(--border)" strokeWidth={1}
          />
          {/* NOT Math.round like OneRMChart: these ranges are tight enough that a
              72.5 / 75 / 77.5 axis rounds to 73 / 75 / 78 — wrong, and unevenly spaced. */}
          <text
            x={PAD_L - 4} y={scale.y(v) + 3}
            textAnchor="end" fontSize={8}
            fill="var(--muted)" fontFamily="var(--font-mono)"
          >
            {formatNum2(v)}
          </text>
        </g>
      ))}

      <polyline
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polyPoints(points, scale)}
      />
      {points.map((p, i) => (
        <circle
          key={p.t}
          cx={scale.x(p.t)} cy={scale.y(p.value)}
          r={i === points.length - 1 ? 4 : 3}
          fill={color}
          stroke="var(--surface-1)" strokeWidth={1.5}
        />
      ))}

      {/* First and last date only — evenly spaced ticks would misrepresent an
          irregular time axis. */}
      <text
        x={PAD_L} y={height - 6}
        textAnchor="start" fontSize={8}
        fill="var(--muted)" fontFamily="var(--font-mono)"
      >
        {formatDM(new Date(firstT))}
      </text>
      <text
        x={VB_W - PAD_R} y={height - 6}
        textAnchor="end" fontSize={8}
        fill="var(--muted)" fontFamily="var(--font-mono)"
      >
        {formatDM(new Date(lastT))}
      </text>

      {/* Top-RIGHT: the left gutter is where the highest gridline label sits, and
          at these value ranges the two collided ("77.5" running into "kg"). */}
      <text
        x={VB_W - PAD_R} y={PAD_T - 2}
        textAnchor="end" fontSize={7}
        fill="var(--muted)" fontFamily="var(--font-mono)"
      >
        {unit}
      </text>
    </svg>
  )
}
