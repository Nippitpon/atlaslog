import { useState } from 'react'
import type { OneRMEntry, OneRMLift } from '@atlaslog/shared'
import { DateField } from '../../components/DateField.js'
import { IconX } from '../../components/icons/index.js'
import { todayYMD, isoFromYMD, formatDMY } from '../../lib/utils.js'
import { LIFT_ORDER, LIFT_LABEL } from '../../components/charts/oneRMScale.js'

interface LogOneRMSheetProps {
  defaultLift?: OneRMLift
  previous: Partial<Record<OneRMLift, OneRMEntry>>
  onSave: (lift: OneRMLift, iso: string, weightKg: number) => void
  onClose: () => void
}

export function LogOneRMSheet({ defaultLift = 'squat', previous, onSave, onClose }: LogOneRMSheetProps) {
  const today = todayYMD()
  const [lift, setLift] = useState<OneRMLift>(defaultLift)
  const [date, setDate] = useState(today)
  const [weight, setWeight] = useState('')
  const [saved, setSaved] = useState(false)

  const kg = Number(weight)
  const canSave = kg > 0 && !!date
  const prev = previous[lift]
  const delta = prev ? kg - prev.weightKg : 0

  const handleSave = () => {
    if (!canSave) return
    // Anchor a backdated day at local noon so it lands on the right calendar date
    // in any timezone; today keeps the real clock time.
    onSave(lift, date === today ? new Date().toISOString() : isoFromYMD(date), kg)
    setSaved(true)
    setTimeout(() => { setSaved(false); onClose() }, 900)
  }

  return (
    <div className="sheet-backdrop" onClick={onClose} style={{ zIndex: 100 }}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h3 className="t-display" style={{ margin: 0, fontSize: 20 }}>Log a 1RM test</h3>
          <button className="btn-icon" onClick={onClose}><IconX size={18} /></button>
        </div>
        <p className="t-mono" style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 16 }}>
          บันทึกสถิติที่ทดสอบได้จริง — ใช้คำนวณน้ำหนักในโปรแกรม
        </p>

        <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 6 }}>LIFT</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {LIFT_ORDER.map(k => (
            <button
              key={k}
              className="btn"
              onClick={() => setLift(k)}
              style={{
                flex: 1, height: 40, fontSize: 12, borderRadius: 12,
                background: lift === k ? 'var(--accent)' : 'var(--surface-2)',
                color: lift === k ? 'var(--accent-ink)' : 'var(--text-2)',
              }}
            >
              {LIFT_LABEL[k]}
            </button>
          ))}
        </div>

        <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 6 }}>DATE</div>
        <div style={{ marginBottom: 14 }}>
          <DateField value={date} max={today} onChange={iso => setDate(iso || today)} />
        </div>

        <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 6 }}>WEIGHT (KG)</div>
        <input
          className="input-num tnum"
          type="number" inputMode="decimal" min={0} max={1000}
          value={weight} placeholder="0"
          onChange={e => setWeight(e.target.value)}
          onFocus={e => e.target.select()}
          style={{ width: '100%', textAlign: 'center' }}
        />

        <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 10, minHeight: 14 }}>
          {prev
            ? `ก่อนหน้า ${prev.weightKg} kg (${formatDMY(prev.date)})${kg > 0 ? ` · ${delta >= 0 ? '+' : ''}${Math.round(delta * 10) / 10} kg` : ''}`
            : 'ยังไม่เคยบันทึกท่านี้'}
        </div>

        <button
          className="btn btn-primary"
          style={{
            width: '100%', marginTop: 16, height: 44, fontSize: 13,
            opacity: canSave || saved ? 1 : 0.4,
            background: saved ? '#4ade80' : undefined,
            color: saved ? '#000' : undefined,
          }}
          disabled={!canSave && !saved}
          onClick={handleSave}
        >
          {saved ? 'Saved!' : 'Save 1RM'}
        </button>
      </div>
    </div>
  )
}
