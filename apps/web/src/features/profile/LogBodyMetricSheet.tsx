import { useState } from 'react'
import type { BodyMetricEntry } from '@atlaslog/shared'
import { IconX } from '../../components/icons/index.js'
import { DateField } from '../../components/DateField.js'
import { formatDMY, formatNum2, isoFromYMD, todayYMD, ymdOfISO } from '../../lib/utils.js'

interface Props {
  // Present = edit mode: the fields prefill and the caller keeps the entry's id,
  // so saving replaces the row instead of adding one (addBodyMetric upserts).
  entry?: BodyMetricEntry
  previous?: BodyMetricEntry
  onSave: (iso: string, weightKg: number, muscle?: number, fat?: number) => void
  onClose: () => void
}

function Field({ label, unit, value, onChange, max, placeholder }: {
  label: string
  unit: string
  value: string
  onChange: (v: string) => void
  max: number
  placeholder: string
}) {
  return (
    <div style={{ flex: 1 }}>
      <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>{label} ({unit})</div>
      <input
        className="input-num tnum"
        type="number" inputMode="decimal" step="0.01" min={0} max={max}
        value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onFocus={e => e.target.select()}
        style={{ width: '100%', textAlign: 'center' }}
      />
    </div>
  )
}

export function LogBodyMetricSheet({ entry, previous, onSave, onClose }: Props) {
  const today = todayYMD()
  const isEdit = !!entry

  const [date, setDate] = useState(entry ? ymdOfISO(entry.date) : today)
  const [weight, setWeight] = useState(entry ? String(entry.weightKg) : '')
  const [muscle, setMuscle] = useState(entry?.skeletalMuscleKg != null ? String(entry.skeletalMuscleKg) : '')
  const [fat, setFat] = useState(entry?.bodyFatPct != null ? String(entry.bodyFatPct) : '')
  const [saved, setSaved] = useState(false)

  const kg = Number(weight)
  const canSave = kg > 0 && !!date
  const delta = previous ? kg - previous.weightKg : 0

  const optional = (v: string) => {
    const n = Number(v)
    return v.trim() !== '' && Number.isFinite(n) && n > 0 ? n : undefined
  }

  const handleSave = () => {
    if (!canSave) return
    // Anchor a backdated day at local noon so it lands on the right calendar date
    // in any timezone; today keeps the real clock time. Editing keeps the same
    // rule, so re-saving an old row does not shunt it a day either way.
    const iso = date === today && !isEdit ? new Date().toISOString() : isoFromYMD(date)
    onSave(iso, kg, optional(muscle), optional(fat))
    setSaved(true)
    setTimeout(() => { setSaved(false); onClose() }, 900)
  }

  return (
    <div className="sheet-backdrop" onClick={onClose} style={{ zIndex: 100 }}>
      <div className="sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="sheet-handle" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h3 className="t-display" style={{ margin: 0, fontSize: 20 }}>
            {isEdit ? 'แก้ไขบันทึก' : 'บันทึกค่าใหม่'}
          </h3>
          <button className="btn-icon" onClick={onClose} aria-label="Close"><IconX size={18} /></button>
        </div>
        <p className="t-mono" style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 16 }}>
          {isEdit
            ? 'แก้ค่าที่กรอกผิดได้ — บันทึกทับรายการเดิม ไม่เพิ่มรายการใหม่'
            : 'กรอกน้ำหนักเป็นอย่างน้อย — กล้ามเนื้อกับไขมันจะเว้นไว้ก็ได้'}
        </p>

        <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 6 }}>DATE</div>
        <div style={{ marginBottom: 14 }}>
          <DateField value={date} max={today} onChange={iso => setDate(iso || today)} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Field label="WEIGHT" unit="kg" value={weight} onChange={setWeight} max={500} placeholder="0" />
          <Field label="MUSCLE" unit="kg" value={muscle} onChange={setMuscle} max={200} placeholder="—" />
          <Field label="FAT" unit="%" value={fat} onChange={setFat} max={100} placeholder="—" />
        </div>

        {/* minHeight so the button never jumps as this line appears. Editing shows
            nothing: there is no "previous" to compare a correction against, and the
            add-mode fallback ("never logged") would be plainly wrong here. */}
        <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 10, minHeight: 14 }}>
          {isEdit
            ? ''
            : previous
              ? `ก่อนหน้า ${formatNum2(previous.weightKg)} kg (${formatDMY(previous.date)})${
                  kg > 0 ? ` · ${delta >= 0 ? '+' : ''}${formatNum2(delta)} kg` : ''}`
              : 'ยังไม่เคยบันทึกน้ำหนัก'}
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
          {saved ? 'Saved!' : isEdit ? 'บันทึกการแก้ไข' : 'บันทึก'}
        </button>
      </div>
    </div>
  )
}
