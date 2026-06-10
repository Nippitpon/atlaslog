import { useEffect } from 'react'
import { useLocation, Outlet, useNavigate, Navigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { BottomNav } from './BottomNav.js'
import { FinishSummary } from '../../features/logger/FinishSummary.js'
import { PROGRAMS } from '../../lib/data.js'
import { IconX, IconChevronRight } from '../icons/index.js'

export function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, showPicker, setShowPicker, startWorkout, finishedSession, setFinishedSession } = useAppStore()
  const { user, initialized, init } = useAuthStore()

  useEffect(() => { init() }, [init])
  const isDark = theme === 'dark'
  const isLogger = location.pathname === '/workout'

  if (!initialized) {
    return (
      <div className={`atlas-app theme-${theme}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh' }}>
        <div className="t-mono" style={{ fontSize: 12, color: 'var(--muted)' }}>Loading…</div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  const handlePickProgram = (p: typeof PROGRAMS[number]) => {
    startWorkout(p)
    navigate('/workout')
  }

  return (
    <div className={`atlas-app theme-${theme}`}>
      <div className="dynamic-island" />

      <Outlet />

      {!isLogger && <BottomNav />}

      {showPicker && (
        <div className="sheet-backdrop" onClick={() => setShowPicker(false)}>
          <div className="sheet" style={{ maxHeight: '76%', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 className="t-display" style={{ margin: 0, fontSize: 22 }}>Pick a program</h3>
              <button className="btn-icon" onClick={() => setShowPicker(false)}>
                <IconX size={16} />
              </button>
            </div>
            <div style={{ overflowY: 'auto', margin: '0 -20px', padding: '4px 20px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {PROGRAMS.map(p => (
                <button key={p.id} onClick={() => handlePickProgram(p)} style={{ all: 'unset', cursor: 'pointer', display: 'block' }}>
                  <div className="card card-tight" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 4, alignSelf: 'stretch', background: 'var(--accent)', borderRadius: 2, minHeight: 40 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16 }}>{p.name}</div>
                      <div className="t-mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        {p.exercises.length} EX · {p.duration}M
                      </div>
                    </div>
                    <IconChevronRight size={18} style={{ color: 'var(--muted)' }} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {finishedSession && (
        <FinishSummary
          session={finishedSession}
          onDone={() => { setFinishedSession(null); navigate('/') }}
        />
      )}

      <div className="home-indicator">
        <div className="home-indicator-bar" style={{ background: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.25)' }} />
      </div>
    </div>
  )
}
