import type { DayStatus } from '@atlaslog/shared'
import { DAY_STATUS_STYLE } from '../lib/programStatus.js'
import { IconCheck } from './icons/index.js'

export function DayStatusBadge({ status }: { status: DayStatus }) {
  const cfg = DAY_STATUS_STYLE[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 999,
      background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color,
      fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
      textTransform: 'uppercase', letterSpacing: '0.07em', flexShrink: 0,
    }}>
      {status === 'done' && <IconCheck size={10} stroke={3} />}
      {cfg.label}
    </span>
  )
}
