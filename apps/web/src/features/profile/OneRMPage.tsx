import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { OneRMEntry, OneRMLift } from '@atlaslog/shared'
import { useAppStore } from '../../store/useAppStore.js'
import { formatDMY } from '../../lib/utils.js'
import { buildLiftSeries, latestEntryFor } from '../../lib/oneRM.js'
import { OneRMChart, type LiftSelection } from '../../components/charts/OneRMChart.js'
import { LIFT_COLOR, LIFT_LABEL, LIFT_SHORT, LIFT_ORDER } from '../../components/charts/oneRMScale.js'
import { LogOneRMSheet } from './LogOneRMSheet.js'
import { IconChevronLeft, IconTrendingUp, IconTrash, IconX } from '../../components/icons/index.js'

const LIFTS: { key: OneRMLift; label: string; short: string }[] =
  LIFT_ORDER.map(k => ({ key: k, label: LIFT_LABEL[k], short: LIFT_SHORT[k] }))

export function OneRMPage() {
  const navigate = useNavigate()
  const { history, personalOneRMs, setPersonalOneRMs, oneRMHistory, addOneRMEntry, removeOneRMEntry } = useAppStore()

  const [liftSel, setLiftSel] = useState<LiftSelection>('all')
  const [showLog, setShowLog] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [draft, setDraft] = useState(personalOneRMs)
  const [saved, setSaved] = useState(false)

  const liftSeries = useMemo(() => buildLiftSeries(history, oneRMHistory), [history, oneRMHistory])

  const prevByLift = useMemo(() => {
    const out: Partial<Record<OneRMLift, OneRMEntry>> = {}
    for (const k of LIFT_ORDER) out[k] = latestEntryFor(oneRMHistory, k)
    return out
  }, [oneRMHistory])

  const sbdTotal = personalOneRMs.squat + personalOneRMs.bench + personalOneRMs.deadlift
  const hasAny = oneRMHistory.length > 0 || sbdTotal > 0

  const rmRows = useMemo(() => {
    const rows = liftSel === 'all' ? oneRMHistory : oneRMHistory.filter(e => e.lift === liftSel)
    return [...rows].sort((a, b) => b.date.localeCompare(a.date))
  }, [oneRMHistory, liftSel])

  const hasChanges =
    draft.squat !== personalOneRMs.squat ||
    draft.bench !== personalOneRMs.bench ||
    draft.deadlift !== personalOneRMs.deadlift

  const openEdit = () => { setDraft(personalOneRMs); setShowEdit(true) }
  const handleEditSave = () => {
    setPersonalOneRMs(draft)
    setSaved(true)
    setTimeout(() => { setSaved(false); setShowEdit(false) }, 900)
  }
  const handleDelete = (e: OneRMEntry) => {
    if (window.confirm(`ลบสถิติ ${LIFT_LABEL[e.lift]} ${e.weightKg} kg วันที่ ${formatDMY(e.date)}?`)) {
      removeOneRMEntry(e.id)
    }
  }

  return (
    <div className="atlas-screen screen-enter">
      {/* .scr-header defaults to space-between, which would shove the title to the
          right edge away from the back button (see /runs) — group them at the left. */}
      <div className="scr-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 12 }}>
        <button className="btn-icon" onClick={() => navigate(-1)} aria-label="Back">
          <IconChevronLeft size={20} />
        </button>
        <div>
          <div className="sub">STRENGTH</div>
          <h1>1RM</h1>
        </div>
      </div>

      {!hasAny ? (
        <div style={{ padding: '0 20px 20px' }}>
          <div className="card" style={{ textAlign: 'center', padding: '32px 20px' }}>
            <IconTrendingUp size={28} style={{ color: 'var(--muted)', marginBottom: 8 }} />
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
              ยังไม่มีสถิติ 1RM — ใส่ตัวเลขเริ่มต้นเพื่อให้โปรแกรมคำนวณน้ำหนักให้อัตโนมัติ
            </div>
            <button
              className="btn btn-primary"
              style={{ width: '100%', height: 44, fontSize: 13 }}
              onClick={openEdit}
            >
              ตั้งค่า 1RM
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ padding: '0 20px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <IconTrendingUp size={14} style={{ color: 'var(--muted)' }} />
              <div className="t-eyebrow">PROGRESSION</div>
              <button
                onClick={openEdit}
                className="t-mono"
                style={{ all: 'unset', cursor: 'pointer', marginLeft: 'auto', fontSize: 10, color: 'var(--muted)' }}
              >
                Edit current →
              </button>
            </div>
            <div className="card">
              <OneRMChart series={liftSeries} selected={liftSel} onSelect={setLiftSel} />

              {/* Latest per lift — doubles as the colour legend for the chart */}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                background: 'var(--surface-2)', borderRadius: 10,
                padding: '10px 14px', marginTop: 14,
              }}>
                {LIFT_ORDER.filter(k => liftSel === 'all' || liftSel === k).map(k => {
                  const latest = prevByLift[k]
                  const manual = liftSeries.find(s => s.lift === k)?.manual ?? []
                  const d = manual.length >= 2
                    ? manual[manual.length - 1].value - manual[manual.length - 2].value
                    : null
                  return (
                    <div key={k} style={{ textAlign: 'center', flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 3 }}>
                        <span style={{ width: 6, height: 6, borderRadius: 3, background: LIFT_COLOR[k] }} />
                        <span className="t-eyebrow" style={{ fontSize: 9 }}>{LIFT_LABEL[k].toUpperCase()}</span>
                      </div>
                      <div className="t-mono tnum" style={{ fontSize: 16, fontWeight: 700, color: latest ? 'var(--text)' : 'var(--muted)' }}>
                        {latest ? latest.weightKg : personalOneRMs[k] || '—'}
                        {(latest || personalOneRMs[k] > 0) && (
                          <span style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 1 }}>kg</span>
                        )}
                      </div>
                      <div className="t-mono tnum" style={{
                        fontSize: 9,
                        color: d == null ? 'var(--muted)' : d >= 0 ? '#4ade80' : 'var(--danger)',
                      }}>
                        {d == null ? '—' : `${d >= 0 ? '+' : ''}${Math.round(d * 10) / 10}`}
                      </div>
                    </div>
                  )
                })}
              </div>

              <button
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 14, height: 44, fontSize: 13 }}
                onClick={() => setShowLog(true)}
              >
                Log a 1RM test
              </button>
            </div>
          </div>

          {rmRows.length > 0 && (
            <div style={{ padding: '0 20px 32px' }}>
              <div className="t-eyebrow" style={{ marginBottom: 10 }}>
                HISTORY{liftSel !== 'all' ? ` · ${LIFT_LABEL[liftSel].toUpperCase()}` : ''}
              </div>
              {rmRows.map(e => (
                <div
                  key={e.id}
                  className="card card-tight"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12,
                    color: LIFT_COLOR[e.lift],
                  }}>{LIFT_SHORT[e.lift]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t-mono tnum" style={{ fontSize: 15, fontWeight: 700 }}>
                      {e.weightKg}<span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 1 }}>kg</span>
                    </div>
                    <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                      {formatDMY(e.date)}
                    </div>
                  </div>
                  <button className="btn-icon" onClick={() => handleDelete(e)} aria-label="Delete 1RM record">
                    <IconTrash size={16} style={{ color: 'var(--muted)' }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showLog && (
        <LogOneRMSheet
          defaultLift={liftSel === 'all' ? 'squat' : liftSel}
          previous={prevByLift}
          onSave={(lift, iso, weightKg) => addOneRMEntry({
            id: `rm${Date.now()}-${lift}`,
            date: iso,
            lift,
            weightKg,
            source: 'test',
          })}
          onClose={() => setShowLog(false)}
        />
      )}

      {/* Current 1RM — the undated values programs calculate from */}
      {showEdit && (
        <div className="sheet-backdrop" onClick={() => setShowEdit(false)} style={{ zIndex: 100 }}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <h3 className="t-display" style={{ margin: 0, fontSize: 20 }}>Personal 1RM</h3>
              <button className="btn-icon" onClick={() => setShowEdit(false)}><IconX size={18} /></button>
            </div>
            <p className="t-mono" style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 16 }}>
              ใช้คำนวณน้ำหนักในโปรแกรม Powerlifting อัตโนมัติ
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {LIFTS.map(({ key, label, short }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11, color: 'var(--accent)',
                  }}>{short}</div>
                  <div style={{ flex: 1, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>{label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input className="input-num tnum" type="number" inputMode="decimal" min={0} max={1000}
                      value={draft[key] || ''} placeholder="0"
                      onChange={e => setDraft(d => ({ ...d, [key]: Math.max(0, Number(e.target.value) || 0) }))}
                      onFocus={e => e.target.select()}
                      style={{ width: 116, textAlign: 'right', paddingRight: 12 }} />
                    <span className="t-mono" style={{ fontSize: 11, color: 'var(--muted)' }}>kg</span>
                  </div>
                </div>
              ))}
            </div>
            <button
              className="btn btn-primary"
              style={{
                width: '100%', marginTop: 18, height: 44, fontSize: 13,
                opacity: !hasChanges && !saved ? 0.4 : 1,
                background: saved ? '#4ade80' : undefined, color: saved ? '#000' : undefined,
              }}
              disabled={!hasChanges && !saved}
              onClick={handleEditSave}
            >
              {saved ? 'Saved!' : 'Save 1RM'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
