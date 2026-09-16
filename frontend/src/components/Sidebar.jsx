import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { roleLabel } from '../auth/permissions'
import { initials } from '../utils/format'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  DashboardIcon,
  DepartmentsIcon,
  EmployeesIcon,
  InvestmentsIcon,
  LogOutIcon,
  ProductsIcon,
  ProjectsIcon,
  ReportsIcon,
  SchemaIcon,
} from './icons'

// Junction tables (project_employees, project_products) intentionally have no
// navigation entry - they will be shown inside project detail screens.
//
// Grouped rather than listed flat: the three headings say what kind of screen
// is under them, which is what lets somebody looking for Investments skip the
// analysis entries without reading them.
//
// Each entry names the permission its page needs, and an entry the reader's
// role cannot open is left out - as is a group with nothing left in it.
const navigationGroups = [
  {
    label: 'Overview',
    items: [{ to: '/dashboard', label: 'Dashboard', Icon: DashboardIcon, permission: 'read' }],
  },
  {
    label: 'Management data',
    items: [
      { to: '/projects', label: 'Projects', Icon: ProjectsIcon, permission: 'read' },
      { to: '/employees', label: 'Employees', Icon: EmployeesIcon, permission: 'read' },
      { to: '/departments', label: 'Departments', Icon: DepartmentsIcon, permission: 'read' },
      { to: '/products', label: 'Products', Icon: ProductsIcon, permission: 'read' },
      { to: '/investments', label: 'Investments', Icon: InvestmentsIcon, permission: 'read' },
    ],
  },
  {
    label: 'Analysis and AI',
    items: [
      { to: '/reports', label: 'Reports', Icon: ReportsIcon, permission: 'read' },
      { to: '/schema-audit', label: 'Schema Audit', Icon: SchemaIcon, permission: 'schema_audit' },
    ],
  },
]

// The flat list, for anything that only needs to turn a path into a label.
const navigationItems = navigationGroups.flatMap((group) =>
  group.items.map((item) => ({ ...item, group: group.label })),
)

export default function Sidebar({
  collapsed = false,
  drawerOpen = false,
  onToggleCollapse,
  onCloseDrawer,
  closeButtonRef,
}) {
  const { username, fullName, logout, role, can } = useAuth()
  const displayName = fullName || username
  const visibleGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => can(item.permission)),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <aside
      id="app-sidebar"
      className={drawerOpen ? 'sidebar is-open' : 'sidebar'}
      aria-label="Main navigation"
    >
      <div className="sidebar-brand">
        <span className="sidebar-brand-mark" aria-hidden="true">
          <DashboardIcon size={18} />
        </span>
        <div className="sidebar-brand-text">
          <div className="sidebar-brand-title">SQL-AI</div>
          <div className="sidebar-brand-subtitle">Management System</div>
        </div>

        <button
          type="button"
          className="sidebar-icon-button sidebar-close"
          onClick={onCloseDrawer}
          ref={closeButtonRef}
          aria-label="Close the navigation menu"
        >
          <CloseIcon size={18} />
        </button>
      </div>

      <div className="sidebar-scroll">
        {visibleGroups.map((group) => (
          <div className="sidebar-group" key={group.label}>
            <div className="sidebar-group-label" aria-hidden={collapsed}>
              {group.label}
            </div>
            <nav className="sidebar-nav" aria-label={group.label}>
              {group.items.map(({ to, label, Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    isActive ? 'sidebar-link active' : 'sidebar-link'
                  }
                  // Collapsed, the label is gone from the screen but not from
                  // the link: the accessible name stays, and the native
                  // tooltip gives a sighted reader the same word back.
                  title={collapsed ? label : undefined}
                >
                  <span className="sidebar-link-icon">
                    <Icon size={18} />
                  </span>
                  <span className="sidebar-link-label">{label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        ))}
      </div>

      <div className="sidebar-foot">
        <div className="sidebar-user">
          <span className="sidebar-avatar" aria-hidden="true">
            {initials(displayName)}
          </span>
          <div className="sidebar-user-text">
            <div className="sidebar-user-name" title={displayName}>
              {displayName}
            </div>
            <div className="sidebar-user-role" title={roleLabel(role)}>
              {roleLabel(role)}
            </div>
          </div>
        </div>

        <button
          type="button"
          className="sidebar-action"
          onClick={logout}
          title={collapsed ? 'Log out' : undefined}
        >
          <LogOutIcon size={18} />
          <span className="sidebar-action-label">Log out</span>
        </button>

        {/* Desktop only: narrow the sidebar to a rail. It sits with the other
            actions rather than in the brand row, which on a 68px rail has no
            width left beside the mark. Hidden at the drawer breakpoint, where
            the drawer already opens and closes. */}
        <button
          type="button"
          className="sidebar-action sidebar-collapse"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
          title={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
        >
          {collapsed ? <ChevronRightIcon size={18} /> : <ChevronLeftIcon size={18} />}
          <span className="sidebar-action-label">Collapse</span>
        </button>
      </div>
    </aside>
  )
}

export { navigationGroups, navigationItems }
