import type { OneRMLift } from '@atlaslog/shared'
import type { LiftSeries, OneRMPoint } from '../../lib/oneRM.js'
import { formatDM } from '../../lib/utils.js'
import { LIFT_ORDER, LIFT_COLOR, LIFT_PILL, makeScale, polyPoints, type Box } from './oneRMScale.js'

export type LiftSelection = OneRMLift | 'all'

interface OneRMChartProps {
  series: LiftSeries[]
  selected: LiftSelection
  onSelect: (k: LiftSelection) => void
  height?: number
}

const VB_W = 320
const PAD_L = 30
const PAD_R = 6
const PAD_T = 10
const PAD_B = 20

export function OneRMChart({ series, selected, onSelect, height = 168 }: OneRMChartProps) {
  const box: Box = { w: VB_W, h: height, padL: PAD_L, padR: PAD_R, padT: PAD_T, padB: PAD_B }

  // ALL shows manual only. Three lifts x two series is six polylines across a
  // 284px plot — unreadable, and solid-vs-dashed is a weak channel at 1.5px.
  // Manual entries are sparse enough that three solid lines stay legible.
  const shown = selected === 'all' ? series : series.filter(s => s.lift === selected)
  const withEstimates = selected !== 'all'

  const visible: OneRMPoint[] = shown.flatMap(s =>
    withEstimates ? [...s.manual, ...s.estimated] : s.manual
  )
  const scale = makeScale(visible, box)

  const allTimes = visible.map(p => p.t)
  const firstT = allTimes.length ? Math.min(...allTimes) : 0
  const lastT = allTimes.length ? Math.max(...allTimes) : 0

  return (
    <div>
      {/* Lift selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {(['all', ...LIFT_ORDER] as LiftSelection[]).map(k => {
          const active = selected === k
          const color = k === 'all' ? 'var(--accent)' : LIFT_COLOR[k]
          return (
            <button
              key={k}
              className="pill"
              onClick={() => onSelect(k)}
              style={{
                flexShrink: 0, cursor: 'pointer', fontSize: 10,
                background: 'transparent',
                borderColor: active ? color : 'var(--border)',
                color: active ? color : 'var(--text-2)',
              }}
            >
              {k === 'all' ? 'ALL' : LIFT_PILL[k]}
            </button>
          )
        })}
      </div>

      {scale && visible.length >= 2 ? (
        <>
          <svg
            viewBox={`0 0 ${VB_W} ${height}`}
            style={{ width: '100%', height: 'auto', display: 'block' }}
          >
            {/* Gridlines — three only; vertical ones just add clutter at this width */}
            {scale.ticks.map((v, i) => (
              <g key={i}>
                <line
                  x1={PAD_L} x2={VB_W - PAD_R}
                  y1={scale.y(v)} y2={scale.y(v)}
                  stroke="var(--border)" strokeWidth={1}
                />
                <text
                  x={PAD_L - 4} y={scale.y(v) + 3}
                  textAnchor="end" fontSize={8}
                  fill="var(--muted)" fontFamily="var(--font-mono)"
                >
                  {Math.round(v)}
                </text>
              </g>
            ))}

            {shown.map(s => (
              <g key={s.lift} style={{ transition: 'opacity .2s ease' }}>
                {/* Estimated: dashed, no dots. "No dots" is the semantic cue —
                    a trend, not a measurement. */}
                {withEstimates && s.estimated.length >= 2 && (
                  <polyline
                    fill="none"
                    stroke={LIFT_COLOR[s.lift]}
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    opacity={0.55}
                    points={polyPoints(s.estimated, scale)}
                  />
                )}
                {s.manual.length >= 2 && (
                  <polyline
                    fill="none"
                    stroke={LIFT_COLOR[s.lift]}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={polyPoints(s.manual, scale)}
                  />
                )}
                {s.manual.map((p, i) => (
                  <circle
                    key={p.entryId ?? i}
                    cx={scale.x(p.t)} cy={scale.y(p.value)}
                    r={i === s.manual.length - 1 ? 4 : 3}
                    fill={LIFT_COLOR[s.lift]}
                    stroke="var(--surface-1)" strokeWidth={1.5}
                  />
                ))}
              </g>
            ))}

            {/* First and last date only — evenly spaced ticks would misrepresent
                an irregular time axis. */}
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
          </svg>

          {withEstimates && shown[0]?.estimated.length >= 2 && (
            <div
              className="t-mono"
              style={{ fontSize: 10, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}
            >
              <svg width={14} height={6}><rect x={0} y={2} width={14} height={2} fill="var(--text-2)" /></svg>
              ทดสอบจริง
              <svg width={14} height={6}><rect x={0} y={2} width={14} height={2} fill="var(--muted)" opacity={0.6} /></svg>
              ประมาณจากการซ้อม
            </div>
          )}
        </>
      ) : (
        <div
          className="t-mono"
          style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', padding: '24px 8px' }}
        >
          {visible.length === 1
            ? 'มีข้อมูลจุดเดียว — บันทึกอีกครั้งเพื่อดูกราฟความก้าวหน้า'
            : 'ยังไม่มีข้อมูลของท่านี้'}
        </div>
      )}
    </div>
  )
}
