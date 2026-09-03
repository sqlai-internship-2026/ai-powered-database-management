import { useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { navigationItems } from './Sidebar'

function usePageTitle() {
  const { pathname } = useLocation()
  const match = navigationItems.find((item) => pathname.startsWith(item.to))
  return match ? match.label : 'SQL-AI Management System'
}

export default function Topbar() {
  const { username, logout } = useAuth()
  const title = usePageTitle()

  return (
    <header className="topbar">
      <div className="topbar-title">{title}</div>
      <div className="topbar-user">
        <span className="topbar-username">
          Signed in as <strong>{username}</strong>
        </span>
        <button className="button" onClick={logout}>
          Log out
        </button>
      </div>
    </header>
  )
}
