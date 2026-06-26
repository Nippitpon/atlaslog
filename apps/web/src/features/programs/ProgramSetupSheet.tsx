import { useState, useMemo } from 'react'
import type { StructuredProgram, ProgramConfig } from '@atlaslog/shared'
import { useProgramStore } from '../../store/useProgramStore.js'
import { useAppStore } from '../../store/useAppStore.js'
import { IconX } from '../../components/icons/index.js'
import { formatDMY } from '../../lib/utils.js'
import { DateField } from '../../components/DateField.js'

interface Props {
  program: StructuredProgram
  onClose: () => void
}

function NumInput({ label, value, onChange, placeholder }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div style={{ flex: 1 }}>
      <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 6, textAlign: 'center' }}>{label}</div>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        placeholder={placeholder ?? '0'}
        onChange={e => onChange(e.target.value)}
        onFocus={e => e.target.select()}
        style={{
          width: '100%',
          height: 52,
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          color: 'var(--text)',
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          fontSize: 20,
          textAlign: 'center',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      <div className="t-eyebrow" style={{ fontSize: 9, marginTop: 4, textAlign: 'center', color: 'var(--muted)' }}>KG</div>
    </div>
  )
}

export function ProgramSetupSheet({ program, onClose }: Props) {
  const { setConfig } = useProgramStore()
  const { personalOneRMs } = useAppStore()

  const todayISO = new Date().toISOString().split('T')[0]
  const [startDate, setStartDate] = useState(todayISO)
  const [squatRM, setSquatRM] = useState(personalOneRMs.squat > 0 ? String(personalOneRMs.squat) : '')
  const [benchRM, setBenchRM] = useState(personalOneRMs.bench > 0 ? String(personalOneRMs.bench) : '')
  const [deadliftRM, setDeadliftRM] = useState(personalOneRMs.deadlift > 0 ? String(personalOneRMs.deadlift) : '')

  const endDate = useMemo(() => {
    const [y, m, dd] = startDate.split('-').map(Number)
    const d = new Date(y, m - 1, dd + program.totalWeeks * 7)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }, [startDate, program.totalWeeks])

  const formatDate = formatDMY

  const isGeneral = program.programType === 'general'
  const has1RMs = !!(squatRM && benchRM && deadliftRM && Number(squatRM) > 0 && Number(benchRM) > 0 && Number(deadliftRM) > 0)
  const isValid = isGeneral ? !!startDate : has1RMs

  const handleConfirm = () => {
    const config: ProgramConfig = {
      startDate,
      endDate,
      oneRMs: {
        squat: Number(squatRM) || 0,
        bench: Number(benchRM) || 0,
        deadlift: Number(deadliftRM) || 0,
      },
    }
    setConfig(program.id, config)
    onClose()
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="sheet-handle" />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h3 className="t-display" style={{ margin: 0, fontSize: 22 }}>Setup Program</h3>
          <button className="btn-icon" onClick={onClose}><IconX size={18} /></button>
        </div>
        <p style={{ margin: '0 0 24px', color: 'var(--text-2)', fontSize: 13, lineHeight: 1.5 }}>
          {isGeneral
            ? 'เลือกวันเริ่มต้นโปรแกรม — โปรแกรมแบบ General ไม่คำนวณน้ำหนักจาก 1RM (บันทึกน้ำหนักเองตอนเทรน)'
            : 'กรอกค่า 1RM และวันเริ่มต้น เพื่อให้โปรแกรมคำนวณน้ำหนักแต่ละเซ็ตจากตาราง RPE'}
        </p>

        {/* 1RM Inputs (powerlifting only — general programs don't calculate weight) */}
        {!isGeneral && (
          <>
            <div className="t-eyebrow" style={{ marginBottom: 10, fontSize: 10 }}>1 REP MAX</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
              <NumInput label="SQUAT" value={squatRM} onChange={setSquatRM} placeholder="e.g. 180" />
              <NumInput label="BENCH" value={benchRM} onChange={setBenchRM} placeholder="e.g. 120" />
              <NumInput label="DEADLIFT" value={deadliftRM} onChange={setDeadliftRM} placeholder="e.g. 220" />
            </div>
          </>
        )}

        {/* Start Date */}
        <div className="t-eyebrow" style={{ marginBottom: 6, fontSize: 10 }}>START DATE</div>
        <div style={{ marginBottom: 16 }}>
          <DateField value={startDate} onChange={iso => iso && setStartDate(iso)} />
        </div>

        {/* End Date (read only) */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '12px 14px', marginBottom: 28,
        }}>
          <div>
            <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 3 }}>PROGRAM END DATE</div>
            <div className="t-mono" style={{ fontSize: 14, fontWeight: 600 }}>{formatDate(endDate)}</div>
          </div>
          <div className="t-mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
            {program.totalWeeks} WEEKS
          </div>
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={handleConfirm}
          disabled={!isValid}
        >
          Start Program
        </button>
      </div>
    </div>
  )
}
