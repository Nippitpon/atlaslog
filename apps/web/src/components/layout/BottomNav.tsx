import { useLocation, useNavigate } from 'react-router-dom'
import { IconHome, IconDumbbell, IconHistory, IconUser } from '../icons/index.js'
import { useAuthStore } from '../../store/useAuthStore.js'

const NAV_ITEMS = [
  { id: 'home', path: '/', label: 'Home', Ic: IconHome },
  { id: 'programs', path: '/programs', label: 'Programs', Ic: IconDumbbell },
  { id: 'history', path: '/history', label: 'History', Ic: IconHistory },
  { id: 'profile', path: '/profile', label: 'Profile', Ic: IconUser },
]

export function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const unread = useAuthStore(s => s.notifications.filter(n => !n.readAt).length)

  // Prefix match, so a detail route keeps its section lit: /history/<id> stays on
  // History and /library/<id> stays on Programs, both of which used to fall
  // through to Home. '/' is handled first since every path starts with it.
  const activeId = location.pathname === '/' ? 'home'
    : location.pathname.startsWith('/library') ? 'programs'
    : NAV_ITEMS.slice(1).find(i => location.pathname.startsWith(i.path))?.id ?? 'home'

  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(it => {
        const active = activeId === it.id
        const badge = it.id === 'profile' && unread > 0
        return (
          <button key={it.id} className={active ? 'active' : ''} onClick={() => navigate(it.path)}>
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <it.Ic size={22} stroke={active ? 2.4 : 2} />
              {badge && (
                <span style={{
                  position: 'absolute', top: -4, right: -7, minWidth: 15, height: 15, padding: '0 3px',
                  borderRadius: 8, background: 'var(--danger)', color: '#fff',
                  fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                }}>
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </span>
            <span>{it.label}</span>
            <div className="nav-dot" />
          </button>
        )
      })}
    </nav>
  )
}
