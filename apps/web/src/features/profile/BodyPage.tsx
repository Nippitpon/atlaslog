import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { BodyMetricEntry } from '@atlaslog/shared'
import { useAppStore } from '../../store/useAppStore.js'
import { formatDMY, formatDM, formatNum2 } from '../../lib/utils.js'
import {
  BODY_MEASURES, measureDef, buildBodySeries, sortedByDate, measureDelta,
  buildNormalizedSeries, totalPctChange,
  type BodySelection,
} from '../../lib/bodyMetrics.js'
import { MetricChart } from '../../components/charts/MetricChart.js'
import { LogBodyMetricSheet } from './LogBodyMetricSheet.js'
import { IconChevronLeft, IconScale, IconEdit, IconTrash } from '../../components/icons/index.js'

// Small transparent action button — two 44px btn-icons would not leave room for
// the four data columns at 390px. Same shape ProgramsPage uses on its cards.
const ROW_BTN: React.CSSProperties = {
  all: 'unset', cursor: 'pointer', padding: 4, borderRadius: 6,
  color: 'var(--muted)', display: 'flex', alignItems: 'center',
}

export function BodyPage() {
  const navigate = useNavigate()
  const { bodyMetrics, addBodyMetric, removeBodyMetric } = useAppStore()

  const [measure, setMeasure] = useState<BodySelection>('all')
  const [showLog, setShowLog] = useState(false)
  const [editing, setEditing] = useState<BodyMetricEntry | null>(null)

  const rows = useMemo(() => sortedByDate(bodyMetrics), [bodyMetrics])
  const latest = rows[0]
  const isAll = measure === 'all'
  const series = useMemo(() => isAll
    ? buildNormalizedSeries(bodyMetrics)
    : [{ key: measure, color: measureDef(measure).color, points: buildBodySeries(bodyMetrics, measure) }],
  [bodyMetrics, measure, isAll])

  // `existing` present = edit: addBodyMetric upserts by id, so reusing the id
  // replaces the row. A new entry mints its id HERE, at save time — minting it
  // while rendering would hand every re-render a different id.
  const saveHandler = (existing?: BodyMetricEntry) =>
    (iso: string, weightKg: number, muscle?: number, fat?: number) => {
      addBodyMetric({
        id: existing?.id ?? `bm${Date.now()}`,
        date: iso,
        weightKg,
        skeletalMuscleKg: muscle,
        bodyFatPct: fat,
      })
    }

  const handleDelete = (e: BodyMetricEntry) => {
    if (window.confirm(`ลบบันทึกวันที่ ${formatDMY(e.date)} (${formatNum2(e.weightKg)} kg)?`)) {
      removeBodyMetric(e.id)
    }
  }

  return (
    <div className="atlas-screen screen-enter">
      {/* .scr-header is space-between by default — override so back + title group */}
      <div className="scr-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 12 }}>
        <button className="btn-icon" onClick={() => navigate(-1)} aria-label="Back"><IconChevronLeft size={20} /></button>
        <div>
          <div className="sub">BODY</div>
          <h1>Body Composition</h1>
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: '0 20px 20px' }}>
          <div className="card" style={{ textAlign: 'center', padding: '32px 20px' }}>
            <IconScale size={28} style={{ color: 'var(--muted)', marginBottom: 8 }} />
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
              ยังไม่มีข้อมูล — บันทึกน้ำหนักครั้งแรกเพื่อเริ่มเก็บแนวโน้ม
            </div>
            <button className="btn btn-primary" style={{ width: '100%', height: 44, fontSize: 13 }}
              onClick={() => setShowLog(true)}>
              บันทึกครั้งแรก
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Chart */}
          <div style={{ padding: '0 20px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <IconScale size={14} style={{ color: 'var(--muted)' }} />
              <div className="t-eyebrow">PROGRESSION</div>
            </div>

            <div className="card">
              {/* Raw kg and % still cannot share a y-axis — 75 kg next to 33 kg
                  squashes both lines flat — so ALL plots percent change from each
                  measure's own first reading instead, and the strip below keeps
                  the real numbers. */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {(['all', ...BODY_MEASURES.map(m => m.key)] as BodySelection[]).map(k => {
                  const active = measure === k
                  // ALL wears the accent on its border only. A drawn line never
                  // gets it: lime means "you / now / active" everywhere else, so
                  // a series in it would read as the privileged one.
                  const color = k === 'all' ? 'var(--accent)' : measureDef(k).color
                  return (
                    <button
                      key={k}
                      className="pill"
                      onClick={() => setMeasure(k)}
                      style={{
                        flexShrink: 0, cursor: 'pointer', fontSize: 10,
                        background: 'transparent',
                        borderColor: active ? color : 'var(--border)',
                        color: active ? color : 'var(--text-2)',
                      }}
                    >
                      {k === 'all' ? 'ALL' : measureDef(k).pill}
                    </button>
                  )
                })}
              </div>

              <MetricChart series={series} unit={isAll ? '%Δ' : measureDef(measure).unit} />

              {/* Latest values, and the change the chart is currently drawing:
                  percent from the first reading in ALL, otherwise the step since
                  the previous reading. This strip doubles as the colour legend. */}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                background: 'var(--surface-2)', borderRadius: 10, padding: '10px 14px', marginTop: 14,
              }}>
                {BODY_MEASURES.map(m => {
                  const val = latest ? m.get(latest) : undefined
                  const d = isAll ? totalPctChange(bodyMetrics, m.key) : measureDelta(bodyMetrics, m.key)
                  return (
                    <div key={m.key} style={{ textAlign: 'center', flex: 1 }}>
                      <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 3, color: m.color }}>{m.pill}</div>
                      <div className="t-mono tnum" style={{ fontSize: 16, fontWeight: 700, color: val != null ? 'var(--text)' : 'var(--muted)' }}>
                        {val != null ? formatNum2(val) : '—'}
                        {val != null && <span style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 1 }}>{m.unit}</span>}
                      </div>
                      {/* Neutral on purpose. Green-up/red-down would have the app
                          decide that losing weight is bad and losing fat is bad —
                          it cannot know whether you are cutting or bulking. The
                          sign carries the direction. */}
                      <div className="t-mono tnum" style={{ fontSize: 9, marginTop: 2, minHeight: 11, color: 'var(--text-2)' }}>
                        {d != null && d !== 0 ? `${d > 0 ? '+' : ''}${formatNum2(d)}${isAll ? '%' : ''}` : ''}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* The small number above was shipped unlabelled; now that it has
                  two meanings it has to say which one is on screen. Folded into
                  this existing line so the card height does not jump per pill. */}
              {latest && (
                <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8, textAlign: 'center' }}>
                  ล่าสุด {formatDMY(latest.date)} · {isAll ? '% เทียบค่าแรกของแต่ละค่า' : 'เทียบครั้งก่อน'}
                </div>
              )}

              <button className="btn btn-primary" style={{ width: '100%', marginTop: 14, height: 44, fontSize: 13 }}
                onClick={() => setShowLog(true)}>
                บันทึกค่าใหม่
              </button>
            </div>
          </div>

          {/* History table — CSS grid, like the logger's set table. The app has no
              <table> anywhere and no styles for one. */}
          <div style={{ padding: '0 20px 32px' }}>
            <div className="t-eyebrow" style={{ marginBottom: 10 }}>HISTORY · {rows.length} ครั้ง</div>

            <div className="card card-tight">
              <div style={{
                display: 'grid', gridTemplateColumns: '58px 1fr 1fr 1fr 50px', gap: 6,
                padding: '0 0 8px', borderBottom: '1px solid var(--border)',
              }}>
                {['DATE', 'WEIGHT', 'MUSCLE', 'FAT', ''].map((h, i) => (
                  <div key={h || i} className="t-eyebrow" style={{ fontSize: 9, textAlign: i === 0 ? 'left' : 'center' }}>{h}</div>
                ))}
              </div>

              {rows.map(e => (
                <div
                  key={e.id}
                  style={{
                    display: 'grid', gridTemplateColumns: '58px 1fr 1fr 1fr 50px', gap: 6,
                    alignItems: 'center', padding: '9px 0',
                    borderBottom: '1px solid var(--surface-2)',
                  }}
                >
                  <div className="t-mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>{formatDM(e.date)}</div>
                  {BODY_MEASURES.map(m => {
                    const val = m.get(e)
                    return (
                      <div key={m.key} className="t-mono tnum" style={{
                        fontSize: 13, fontWeight: 600, textAlign: 'center',
                        color: val != null ? 'var(--text)' : 'var(--muted)',
                      }}>
                        {val != null ? formatNum2(val) : '—'}
                      </div>
                    )
                  })}
                  <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditing(e)} style={ROW_BTN} aria-label={`Edit ${formatDMY(e.date)}`}>
                      <IconEdit size={14} />
                    </button>
                    <button onClick={() => handleDelete(e)} style={ROW_BTN} aria-label={`Delete ${formatDMY(e.date)}`}>
                      <IconTrash size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {showLog && (
        <LogBodyMetricSheet
          previous={latest}
          onSave={saveHandler()}
          onClose={() => setShowLog(false)}
        />
      )}

      {editing && (
        <LogBodyMetricSheet
          entry={editing}
          onSave={saveHandler(editing)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
