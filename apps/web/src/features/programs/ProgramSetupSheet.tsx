import { useState, useMemo } from 'react'
import type { StructuredProgram, ProgramConfig } from '@atlaslog/shared'
import { useProgramStore } from '../../store/useProgramStore.js'
import { useAppStore } from '../../store/useAppStore.js'
import { IconX } from '../../components/icons/index.js'
import { formatDMY, programEndDate, todayYMD } from '../../lib/utils.js'
import { DateField } from '../../components/DateField.js'

interface Props {
  program: StructuredProgram
  onClose: () => void
  // 'restart' keeps the same fields but wipes the program's progress and day
  // layouts before writing the new config — see useProgramStore.restartProgram.
  mode?: 'setup' | 'restart'
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

export function ProgramSetupSheet({ program, onClose, mode = 'setup' }: Props) {
  const { setConfig, restartProgram, getConfig } = useProgramStore()
  const { personalOneRMs, workout } = useAppStore()

  const isRestart = mode === 'restart'
  const existingConfig = getConfig(program.id)
  // Live 1RM first — a restart usually follows a test block. Falls back to what
  // the program was last set up with so the fields are never blank on a restart.
  const prefill = (lift: 'squat' | 'bench' | 'deadlift') => {
    const personal = personalOneRMs[lift]
    if (personal > 0) return String(personal)
    const previous = existingConfig?.oneRMs[lift] ?? 0
    return previous > 0 ? String(previous) : ''
  }

  const [startDate, setStartDate] = useState(todayYMD())
  const [squatRM, setSquatRM] = useState(() => prefill('squat'))
  const [benchRM, setBenchRM] = useState(() => prefill('bench'))
  const [deadliftRM, setDeadliftRM] = useState(() => prefill('deadlift'))

  const endDate = useMemo(
    () => programEndDate(startDate, program.totalWeeks),
    [startDate, program.totalWeeks],
  )

  // Warned about explicitly: restarting drops it, and it is the one thing here
  // the user could still lose real work to.
  const hasLiveWorkout = workout?.programId.split('/')[0] === program.id

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
    if (isRestart) restartProgram(program.id, config)
    else setConfig(program.id, config)
    onClose()
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="sheet-handle" />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h3 className="t-display" style={{ margin: 0, fontSize: 22 }}>
            {isRestart ? 'Restart Program' : 'Setup Program'}
          </h3>
          <button className="btn-icon" onClick={onClose}><IconX size={18} /></button>
        </div>
        <p style={{ margin: '0 0 16px', color: 'var(--text-2)', fontSize: 13, lineHeight: 1.5 }}>
          {isRestart
            ? 'เริ่มโปรแกรมนี้ใหม่ตั้งแต่ Week 1 — เลือกวันเริ่มต้นใหม่ แล้วทุกสัปดาห์จะนับวันที่ใหม่จากวันนั้น'
            : isGeneral
              ? 'เลือกวันเริ่มต้นโปรแกรม — โปรแกรมแบบ General ไม่คำนวณน้ำหนักจาก 1RM (บันทึกน้ำหนักเองตอนเทรน)'
              : 'กรอกค่า 1RM และวันเริ่มต้น เพื่อให้โปรแกรมคำนวณน้ำหนักแต่ละเซ็ตจากตาราง RPE'}
        </p>

        {isRestart && (
          <div style={{
            background: 'rgba(255,91,58,0.08)', border: '1px solid rgba(255,91,58,0.3)',
            borderRadius: 12, padding: '12px 14px', marginBottom: 24,
          }}>
            <div className="t-eyebrow" style={{ fontSize: 9, color: 'var(--danger)', marginBottom: 8 }}>
              สิ่งที่จะถูกล้าง
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 }}>
              <li>ความคืบหน้าทุกวัน (done / skipped) ทั้งโปรแกรม</li>
              <li>ท่าที่ปรับแต่งเองรายวัน — กลับเป็นตารางต้นฉบับ</li>
              <li>การผูกวันวิ่งกับวันในโปรแกรม (ตัวรายการวิ่งยังอยู่)</li>
              {hasLiveWorkout && <li>เวิร์กเอาต์ที่ค้างอยู่ของโปรแกรมนี้ จะถูกยกเลิก</li>}
            </ul>
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
              ✓ ประวัติการเทรนใน History ยังอยู่ครบทุกเซสชัน
            </div>
          </div>
        )}

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
          className={isRestart ? 'btn' : 'btn btn-primary'}
          style={isRestart
            ? { width: '100%', background: 'var(--danger)', color: '#fff', border: 'none' }
            : { width: '100%' }}
          onClick={handleConfirm}
          disabled={!isValid}
        >
          {isRestart ? 'Restart from Week 1' : 'Start Program'}
        </button>
      </div>
    </div>
  )
}
