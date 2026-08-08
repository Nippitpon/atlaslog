import { useEffect, useRef, useState } from 'react'
import { IconGrip } from './icons/index.js'

interface Props<T> {
  items: T[]
  getKey: (item: T, index: number) => string
  // Called live while dragging, once per row the pointer crosses.
  onReorder: (from: number, to: number) => void
  renderRow: (item: T, index: number, handle: React.ReactNode) => React.ReactNode
  // Distinguishes sibling lists rendered in the same document (e.g. one per day)
  // so a drag never jumps between them.
  groupId?: string
  gap?: number
  rowStyle?: React.CSSProperties
}

// Pointer-based drag to reorder a vertical list (touch + mouse, no deps).
// Live-reorders the array as the pointer passes over other rows in the same group.
export function ReorderList<T>({
  items, getKey, onReorder, renderRow, groupId = 'list', gap = 6, rowStyle,
}: Props<T>) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const dragRef = useRef<number | null>(null)
  // Keep the latest callback reachable from the long-lived pointermove listener.
  const cbRef = useRef(onReorder)
  useEffect(() => { cbRef.current = onReorder })

  const startDrag = (index: number, e: React.PointerEvent) => {
    e.preventDefault()
    dragRef.current = index
    setDragIdx(index)
    const onMove = (ev: PointerEvent) => {
      const from = dragRef.current
      if (from === null) return
      const row = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)
        ?.closest('[data-reorder-row]') as HTMLElement | null
      if (!row || row.dataset.group !== groupId) return
      const to = Number(row.dataset.idx)
      if (to === from) return
      cbRef.current(from, to)
      dragRef.current = to
      setDragIdx(to)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      dragRef.current = null
      setDragIdx(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {items.map((item, i) => (
        <div
          key={getKey(item, i)}
          data-reorder-row
          data-group={groupId}
          data-idx={i}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8,
            transition: 'background .12s',
            background: dragIdx === i ? 'var(--surface-3)' : 'transparent',
            ...rowStyle,
          }}
        >
          {renderRow(item, i, (
            <div
              onPointerDown={e => startDrag(i, e)}
              aria-label="Drag to reorder"
              style={{
                flexShrink: 0, display: 'flex', alignItems: 'center', cursor: 'grab',
                touchAction: 'none', color: 'var(--muted)', padding: '4px 0',
              }}
            >
              <IconGrip size={16} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
