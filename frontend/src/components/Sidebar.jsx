import { NavLink } from 'react-router-dom'

// Junction tables (project_employees, project_products) intentionally have no
// navigation entry - they will be shown inside project detail screens.
const navigationItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/projects', label: 'Projects' },
  { to: '/employees', label: 'Employees' },
  { to: '/departments', label: 'Departments' },
  { to: '/products', label: 'Products' },
  { to: '/investments', label: 'Investments' },
  { to: '/reports', label: 'Reports' },
]

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-title">SQL-AI</div>
        <div className="sidebar-brand-subtitle">Management System</div>
      </div>
      <nav className="sidebar-nav">
        {navigationItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              isActive ? 'sidebar-link active' : 'sidebar-link'
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

export { navigationItems }
