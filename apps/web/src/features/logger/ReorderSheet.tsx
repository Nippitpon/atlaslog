import { useState } from 'react'
import type { WorkoutExercise } from '@atlaslog/shared'
import { getExercise, moveItem } from '../../lib/utils.js'
import { ReorderList } from '../../components/ReorderList.js'
import { IconCheck } from '../../components/icons/index.js'

interface Props {
  exercises: WorkoutExercise[]
  currentIdx: number
  onSave: (exercises: WorkoutExercise[]) => void
  onClose: () => void
}

// Reorder the remaining exercises of a live workout. Logged sets travel with
// their exercise — only the order changes.
export function ReorderSheet({ exercises, currentIdx, onSave, onClose }: Props) {
  const [list, setList] = useState<WorkoutExercise[]>(exercises)
  const currentKey = exercises[currentIdx]?.id

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" style={{ maxHeight: '80%', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h3 className="t-display" style={{ margin: '0 0 4px', fontSize: 22 }}>Reorder</h3>
        <p style={{ margin: '0 0 14px', color: 'var(--text-2)', fontSize: 12 }}>
          ลากเพื่อสลับลำดับท่า · เซ็ตที่บันทึกไว้ไม่หาย
        </p>

        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 14 }}>
          <ReorderList
            items={list}
            getKey={(ex, i) => ex.id ?? String(i)}
            onReorder={(from, to) => setList(l => moveItem(l, from, to))}
            groupId="logger-reorder"
            gap={0}
            rowStyle={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}
            renderRow={(ex, _i, handle) => {
              const done = ex.sets.filter(s => s.done).length
              const isCurrent = ex.id === currentKey
              return (
                <>
                  {handle}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15,
                      color: isCurrent ? 'var(--accent)' : 'var(--text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {ex.name ?? getExercise(ex.exerciseId).name}
                    </div>
                    {ex.label && (
                      <div className="t-mono" style={{ fontSize: 9, color: 'var(--muted)' }}>{ex.label}</div>
                    )}
                  </div>
                  <span className="t-mono" style={{
                    fontSize: 10, flexShrink: 0,
                    color: done === ex.sets.length ? 'var(--accent)' : 'var(--muted)',
                  }}>
                    {done}/{ex.sets.length}
                  </span>
                </>
              )
            }}
          />
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={() => { onSave(list); onClose() }}
        >
          <IconCheck size={16} stroke={3} /> Save Order
        </button>
      </div>
    </div>
  )
}
