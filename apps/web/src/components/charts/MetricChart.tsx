import { formatDM, formatNum2 } from '../../lib/utils.js'
import { makeScale, polyPoints, FINE_STEPS, type Box, type ChartSeries } from './oneRMScale.js'

interface MetricChartProps {
  series: ChartSeries[]   // each oldest → newest
  unit: string
  height?: number
}

const VB_W = 320
const PAD_L = 34
const PAD_R = 6
const PAD_T = 10
const PAD_B = 20

// N dated series pooled onto one y-axis. Measures that do not share a unit are
// the CALLER's problem: BodyPage normalises them to percent change first. A
// single measure passes an array of one, so there is no second rendering branch
// to drift out of sync.
export function MetricChart({ series, unit, height = 168 }: MetricChartProps) {
  const box: Box = { w: VB_W, h: height, padL: PAD_L, padR: PAD_R, padT: PAD_T, padB: PAD_B }
  const all = series.flatMap(s => s.points)
  const scale = makeScale(all, box, FINE_STEPS)
  // The longest single series, not the pooled count: one entry with all three
  // measures filled is three points stacked on one pixel, not a chart.
  const longest = series.reduce((n, s) => Math.max(n, s.points.length), 0)

  if (!scale || longest < 2) {
    return (
      <div
        className="t-mono"
        style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', padding: '24px 8px' }}
      >
        {longest > 0
          ? 'มีข้อมูลจุดเดียว — บันทึกอีกครั้งเพื่อดูกราฟแนวโน้ม'
          : 'ยังไม่มีข้อมูลของค่านี้'}
      </div>
    )
  }

  // An axis that crosses zero is a CHANGE axis. Raw kg and % readings are always
  // positive, so this stays false for them and their labels keep no sign — no
  // prop needed, and a lone normalised series still gets the right treatment.
  const signed = scale.vMin < 0 && scale.vMax > 0
  const tickLabel = (v: number) => (signed && v > 0 ? '+' : '') + formatNum2(v)

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
            {tickLabel(v)}
          </text>
        </g>
      ))}

      {/* Every normalised series starts at exactly 0, so vMin ≤ 0 ≤ vMax always
          holds and this needs no help from makeScale. Dashed, not merely darker:
          --border-strong sits one shade off --border in light theme and would
          otherwise read as a fourth gridline. */}
      {signed && (
        <line
          x1={PAD_L} x2={VB_W - PAD_R}
          y1={scale.y(0)} y2={scale.y(0)}
          stroke="var(--border-strong)" strokeWidth={1} strokeDasharray="3 3"
        />
      )}

      {series.map(s => (
        <g key={s.key}>
          {s.points.length >= 2 && (
            <polyline
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              points={polyPoints(s.points, scale)}
            />
          )}
          {/* Keyed by index, not by t: two readings can share a timestamp. */}
          {s.points.map((p, i) => (
            <circle
              key={i}
              cx={scale.x(p.t)} cy={scale.y(p.value)}
              r={i === s.points.length - 1 ? 4 : 3}
              fill={s.color}
              stroke="var(--surface-1)" strokeWidth={1.5}
            />
          ))}
        </g>
      ))}

      {/* First and last date only — evenly spaced ticks would misrepresent an
          irregular time axis. Taken from the union, not one series. */}
      <text
        x={PAD_L} y={height - 6}
        textAnchor="start" fontSize={8}
        fill="var(--muted)" fontFamily="var(--font-mono)"
      >
        {formatDM(new Date(scale.tMin))}
      </text>
      <text
        x={VB_W - PAD_R} y={height - 6}
        textAnchor="end" fontSize={8}
        fill="var(--muted)" fontFamily="var(--font-mono)"
      >
        {formatDM(new Date(scale.tMax))}
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
