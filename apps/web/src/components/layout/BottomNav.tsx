import { useLocation, useNavigate } from 'react-router-dom'
import { IconHome, IconDumbbell, IconHistory, IconUser } from '../icons/index.js'

const NAV_ITEMS = [
  { id: 'home', path: '/', label: 'Home', Ic: IconHome },
  { id: 'programs', path: '/programs', label: 'Programs', Ic: IconDumbbell },
  { id: 'history', path: '/history', label: 'History', Ic: IconHistory },
  { id: 'profile', path: '/profile', label: 'Profile', Ic: IconUser },
]

export function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  const activeId = location.pathname === '/library' ? 'programs'
    : location.pathname === '/' ? 'home'
    : NAV_ITEMS.find(i => i.path === location.pathname)?.id ?? 'home'

  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(it => {
        const active = activeId === it.id
        return (
          <button key={it.id} className={active ? 'active' : ''} onClick={() => navigate(it.path)}>
            <it.Ic size={22} stroke={active ? 2.4 : 2} />
            <span>{it.label}</span>
            <div className="nav-dot" />
          </button>
        )
      })}
    </nav>
  )
}
