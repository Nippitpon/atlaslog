import { useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { StructuredProgram, ProgramConfig } from '@atlaslog/shared'
import { parseExcelFile } from '../../lib/excelImport.js'
import { useProgramStore } from '../../store/useProgramStore.js'
import { useAppStore } from '../../store/useAppStore.js'
import { IconX, IconUpload, IconCheck } from '../../components/icons/index.js'
import { formatDMY } from '../../lib/utils.js'

type Step = 'upload' | 'preview' | 'setup'

interface Props {
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
          width: '100%', height: 52,
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: 12, color: 'var(--text)',
          fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 20,
          textAlign: 'center', outline: 'none', boxSizing: 'border-box',
        }}
      />
      <div className="t-eyebrow" style={{ fontSize: 9, marginTop: 4, textAlign: 'center', color: 'var(--muted)' }}>KG</div>
    </div>
  )
}

export function ImportProgramSheet({ onClose }: Props) {
  const navigate = useNavigate()
  const { addCustomProgram, setConfig } = useProgramStore()
  const { personalOneRMs } = useAppStore()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [program, setProgram] = useState<StructuredProgram | null>(null)

  // Setup step state
  const todayISO = new Date().toISOString().split('T')[0]
  const [startDate, setStartDate] = useState(todayISO)
  const [squatRM, setSquatRM] = useState(personalOneRMs.squat > 0 ? String(personalOneRMs.squat) : '')
  const [benchRM, setBenchRM] = useState(personalOneRMs.bench > 0 ? String(personalOneRMs.bench) : '')
  const [deadliftRM, setDeadliftRM] = useState(personalOneRMs.deadlift > 0 ? String(personalOneRMs.deadlift) : '')

  const endDate = useMemo(() => {
    if (!program) return todayISO
    const [y, m, dd] = startDate.split('-').map(Number)
    const d = new Date(y, m - 1, dd + program.totalWeeks * 7)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }, [startDate, program, todayISO])

  const formatDate = formatDMY

  const isGeneral = program?.programType === 'general'
  const has1RMs = !!(squatRM && benchRM && deadliftRM &&
    Number(squatRM) > 0 && Number(benchRM) > 0 && Number(deadliftRM) > 0)
  const isSetupValid = isGeneral ? !!startDate : has1RMs

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setErrors(['รองรับเฉพาะไฟล์ .xlsx และ .xls เท่านั้น'])
      return
    }
    setLoading(true)
    setErrors([])
    try {
      const result = await parseExcelFile(file)
      if (result.errors.length > 0) {
        setErrors(result.errors)
      } else if (result.program) {
        setProgram(result.program)
        setStep('preview')
      }
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการอ่านไฟล์'])
    } finally {
      setLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleConfirmSetup = () => {
    if (!program || !isSetupValid) return
    const config: ProgramConfig = {
      startDate,
      endDate,
      oneRMs: {
        squat: Number(squatRM) || 0,
        bench: Number(benchRM) || 0,
        deadlift: Number(deadliftRM) || 0,
      },
    }
    addCustomProgram(program)
    setConfig(program.id, config)
    onClose()
    navigate(`/programs/${program.id}`)
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="sheet-handle" />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h3 className="t-display" style={{ margin: 0, fontSize: 22 }}>
            {step === 'upload' && 'Import from Excel'}
            {step === 'preview' && 'Preview Program'}
            {step === 'setup' && 'Setup Program'}
          </h3>
          <button className="btn-icon" onClick={onClose}><IconX size={18} /></button>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {(['upload', 'preview', 'setup'] as Step[]).map((s, i) => (
            <div key={s} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: i <= ['upload', 'preview', 'setup'].indexOf(step)
                ? 'var(--accent)' : 'var(--surface-2)',
              transition: 'background .3s',
            }} />
          ))}
        </div>

        {/* ── Step 1: Upload ─────────────────────────────── */}
        {step === 'upload' && (
          <>
            <p style={{ margin: '0 0 20px', color: 'var(--text-2)', fontSize: 13, lineHeight: 1.6 }}>
              อัพโหลดไฟล์ Excel ที่มี 2 Sheets:<br />
              <span className="t-mono" style={{ color: 'var(--accent)', fontSize: 11 }}>Program</span>
              {' '}— รายการ exercises ทั้งหมด<br />
              <span className="t-mono" style={{ color: 'var(--accent)', fontSize: 11 }}>Meta</span>
              {' '}— ชื่อ, description, focus ของโปรแกรม
            </p>

            {/* Column list */}
            <div style={{
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 12, padding: 14, marginBottom: 20,
            }}>
              <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 8 }}>COLUMNS ที่จำเป็นใน SHEET "PROGRAM"</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['week', 'phase', 'day_of_week', 'focus', 'exercise_name', 'exercise_id', 'type', 'sets', 'reps'].map(c => (
                  <span key={c} className="pill" style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{c}</span>
                ))}
              </div>
              <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8 }}>
                optional: pct (0-1), rpe (6-10), note
              </div>
              <a
                href="/atlaslog-program-template.xlsx"
                download
                className="t-mono"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12,
                  fontSize: 11, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600,
                }}
              >
                <IconUpload size={13} style={{ transform: 'rotate(180deg)' }} />
                ดาวน์โหลดไฟล์ตัวอย่าง (template)
              </a>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            {errors.length > 0 && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 12, padding: 14, marginBottom: 16,
              }}>
                <div className="t-eyebrow" style={{ fontSize: 9, color: '#ef4444', marginBottom: 6 }}>ข้อผิดพลาด</div>
                {errors.map((e, i) => (
                  <div key={i} className="t-mono" style={{ fontSize: 12, color: '#ef4444', marginBottom: 2 }}>{e}</div>
                ))}
              </div>
            )}

            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={() => fileRef.current?.click()}
              disabled={loading}
            >
              {loading ? (
                'กำลังอ่านไฟล์...'
              ) : (
                <>
                  <IconUpload size={18} />
                  เลือกไฟล์ Excel
                </>
              )}
            </button>
          </>
        )}

        {/* ── Step 2: Preview ────────────────────────────── */}
        {step === 'preview' && program && (
          <>
            <div style={{
              background: 'rgba(212,255,58,0.06)', border: '1px solid rgba(212,255,58,0.2)',
              borderRadius: 12, padding: 14, marginBottom: 16,
            }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, marginBottom: 4 }}>
                {program.name}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 10 }}>{program.description}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[`${program.totalWeeks} WEEKS`, `${program.daysPerWeek} DAYS/WK`, program.focus].map(t => (
                  <span key={t} className="pill" style={{ fontSize: 9 }}>{t}</span>
                ))}
              </div>
            </div>

            {/* Week breakdown */}
            <div className="t-eyebrow" style={{ fontSize: 9, marginBottom: 8 }}>WEEK SUMMARY</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
              {program.weeks.slice(0, 6).map(w => (
                <div key={w.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'var(--surface-2)', borderRadius: 10, padding: '8px 12px',
                }}>
                  <div className="t-mono" style={{ fontSize: 11, fontWeight: 700, minWidth: 60 }}>
                    Week {w.weekNumber}
                  </div>
                  <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)', flex: 1 }}>
                    {w.phase} · {w.days.length} days
                  </div>
                  <div className="t-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
                    {w.days.reduce((s, d) => s + d.exercises.length, 0)} ex
                  </div>
                </div>
              ))}
              {program.weeks.length > 6 && (
                <div className="t-mono" style={{ fontSize: 11, color: 'var(--muted)', padding: '4px 12px' }}>
                  +{program.weeks.length - 6} more weeks
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }}
                onClick={() => { setStep('upload'); setErrors([]) }}>
                เลือกไฟล์ใหม่
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }}
                onClick={() => setStep('setup')}>
                ต่อไป <IconCheck size={16} stroke={3} />
              </button>
            </div>
          </>
        )}

        {/* ── Step 3: Setup (1RM + date) ─────────────────── */}
        {step === 'setup' && program && (
          <>
            <p style={{ margin: '0 0 20px', color: 'var(--text-2)', fontSize: 13, lineHeight: 1.5 }}>
              {isGeneral
                ? 'เลือกวันเริ่มต้นโปรแกรม — โปรแกรมแบบ General ไม่คำนวณน้ำหนักจาก 1RM (บันทึกน้ำหนักเองตอนเทรน)'
                : 'กรอก 1RM และวันเริ่มต้น เพื่อให้ระบบคำนวณน้ำหนักแต่ละเซ็ต'}
            </p>

            {!isGeneral && (
              <>
                <div className="t-eyebrow" style={{ marginBottom: 10, fontSize: 10 }}>1 REP MAX</div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
                  <NumInput label="SQUAT" value={squatRM} onChange={setSquatRM} placeholder="เช่น 180" />
                  <NumInput label="BENCH" value={benchRM} onChange={setBenchRM} placeholder="เช่น 120" />
                  <NumInput label="DEADLIFT" value={deadliftRM} onChange={setDeadliftRM} placeholder="เช่น 220" />
                </div>
              </>
            )}

            <div className="t-eyebrow" style={{ marginBottom: 6, fontSize: 10 }}>START DATE</div>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={{
                width: '100%', height: 48,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 12, color: 'var(--text)',
                fontFamily: 'var(--font-mono)', fontSize: 14,
                padding: '0 14px', outline: 'none', boxSizing: 'border-box', marginBottom: 16,
              }}
            />

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

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setStep('preview')}>
                ย้อนกลับ
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={handleConfirmSetup}
                disabled={!isSetupValid}
              >
                <IconCheck size={18} stroke={3} /> เริ่มโปรแกรม
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
