import type { CSSProperties, ReactNode } from 'react'

interface IconProps {
  size?: number
  stroke?: number | string
  fill?: string
  style?: CSSProperties
  d?: string | ReactNode
}

function Icon({ d, size = 22, stroke = 2, fill = 'none', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style}>
      {typeof d === 'string' ? <path d={d} /> : d}
    </svg>
  )
}

export const IconHome = (p: IconProps) => <Icon {...p} d={<><path d="M3 12L12 4l9 8"/><path d="M5 10v10h14V10"/></>} />
export const IconDumbbell = (p: IconProps) => <Icon {...p} d={<>
  <path d="M6.5 6.5l11 11"/>
  <path d="M3 7v10"/>
  <path d="M21 7v10"/>
  <path d="M6 5v14"/>
  <path d="M18 5v14"/>
  <path d="M8 12h8"/>
</>} />
export const IconHistory = (p: IconProps) => <Icon {...p} d={<>
  <path d="M3 12a9 9 0 1 0 3-6.7L3 8"/>
  <path d="M3 3v5h5"/>
  <path d="M12 7v5l3 2"/>
</>} />
export const IconUser = (p: IconProps) => <Icon {...p} d={<>
  <circle cx="12" cy="8" r="4"/>
  <path d="M4 21c0-4 4-7 8-7s8 3 8 7"/>
</>} />
export const IconPlay = (p: IconProps) => <Icon {...p} fill="currentColor" stroke="none" d="M6 4l14 8-14 8V4z" />
export const IconPlus = (p: IconProps) => <Icon {...p} d={<><path d="M12 5v14"/><path d="M5 12h14"/></>} />
export const IconCheck = (p: IconProps) => <Icon {...p} stroke={p.stroke ?? 3} d="M4 12l5 5L20 6" />
export const IconX = (p: IconProps) => <Icon {...p} d={<><path d="M6 6l12 12"/><path d="M18 6L6 18"/></>} />
export const IconChevronRight = (p: IconProps) => <Icon {...p} d="M9 6l6 6-6 6" />
export const IconChevronLeft = (p: IconProps) => <Icon {...p} d="M15 6l-6 6 6 6" />
export const IconSearch = (p: IconProps) => <Icon {...p} d={<><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/></>} />
export const IconClock = (p: IconProps) => <Icon {...p} d={<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>} />
export const IconSwap = (p: IconProps) => <Icon {...p} d={<>
  <path d="M7 4l-4 4 4 4"/>
  <path d="M3 8h14"/>
  <path d="M17 20l4-4-4-4"/>
  <path d="M21 16H7"/>
</>} />
export const IconTrendingUp = (p: IconProps) => <Icon {...p} d={<><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></>} />
export const IconActivity = (p: IconProps) => <Icon {...p} d="M3 12h4l3-9 4 18 3-9h4" />
export const IconBolt = (p: IconProps) => <Icon {...p} fill="currentColor" stroke="none" d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
export const IconEdit = (p: IconProps) => <Icon {...p} d={<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>} />
export const IconUpload = (p: IconProps) => <Icon {...p} d={<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>} />
export const IconTrash = (p: IconProps) => <Icon {...p} d={<><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></>} />
export const IconSettings = (p: IconProps) => <Icon {...p} d={<>
  <circle cx="12" cy="12" r="3"/>
  <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>
</>} />
export const IconUsers = (p: IconProps) => <Icon {...p} d={<>
  <circle cx="9" cy="8" r="3.5"/>
  <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
  <path d="M16 4.5a3.5 3.5 0 0 1 0 7"/>
  <path d="M17 14c2.5.6 4 2.7 4 6"/>
</>} />
export const IconShare = (p: IconProps) => <Icon {...p} d={<>
  <circle cx="18" cy="5" r="3"/>
  <circle cx="6" cy="12" r="3"/>
  <circle cx="18" cy="19" r="3"/>
  <path d="M8.6 13.5l6.8 4"/>
  <path d="M15.4 6.5l-6.8 4"/>
</>} />
export const IconBell = (p: IconProps) => <Icon {...p} d={<>
  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
  <path d="M13.7 21a2 2 0 0 1-3.4 0"/>
</>} />
export const IconLink = (p: IconProps) => <Icon {...p} d={<>
  <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/>
  <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>
</>} />
export const IconCopy = (p: IconProps) => <Icon {...p} d={<>
  <rect x="9" y="9" width="11" height="11" rx="2"/>
  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
</>} />
export const IconRun = (p: IconProps) => <Icon {...p} d={<>
  <circle cx="13" cy="4" r="2"/>
  <path d="M13 6l-3 4 3 3v5"/>
  <path d="M10 10L6 9l-2 3"/>
  <path d="M13 13l4 1 1 4"/>
</>} />
export const IconScale = (p: IconProps) => <Icon {...p} d={<>
  <rect x="3" y="3" width="18" height="18" rx="3"/>
  <path d="M8 8h8"/>
  <circle cx="12" cy="14" r="3"/>
  <path d="M12 14l1.5-2"/>
</>} />
