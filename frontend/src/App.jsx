import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './auth/ProtectedRoute'
import RequirePermission from './auth/RequirePermission'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Employees from './pages/Employees'
import Departments from './pages/Departments'
import Products from './pages/Products'
import Investments from './pages/Investments'
import Reports from './pages/Reports'
import FinancialReport from './pages/reports/FinancialReport'
import WorkforceReport from './pages/reports/WorkforceReport'
import PortfolioReport from './pages/reports/PortfolioReport'
import AskReport from './pages/reports/AskReport'
import SchemaAudit from './pages/SchemaAudit'
import NotFound from './pages/NotFound'

// Every page names the permission it needs (see auth/permissions.js). The
// layout itself is not guarded, so a refused page still has the navigation
// around it and the reader is never stranded.
function guarded(permission, element) {
  return <RequirePermission permission={permission}>{element}</RequirePermission>
}

export default function App() {
  return (
    <ProtectedRoute>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={guarded('read', <Dashboard />)} />
          {/* The detail is a child of the list, so opening a project leaves the
              list mounted underneath with its search, filters and page intact.
              The list's guard covers the detail as well. */}
          <Route path="/projects" element={guarded('read', <Projects />)}>
            <Route path=":projectId" element={<ProjectDetail />} />
          </Route>
          <Route path="/employees" element={guarded('read', <Employees />)} />
          <Route path="/departments" element={guarded('read', <Departments />)} />
          <Route path="/products" element={guarded('read', <Products />)} />
          <Route path="/investments" element={guarded('read', <Investments />)} />
          <Route path="/reports" element={guarded('read', <Reports />)}>
            <Route index element={<FinancialReport />} />
            <Route path="workforce" element={<WorkforceReport />} />
            <Route path="portfolio" element={<PortfolioReport />} />
            <Route path="ask" element={guarded('ai', <AskReport />)} />
          </Route>
          <Route path="/schema-audit" element={guarded('schema_audit', <SchemaAudit />)} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </ProtectedRoute>
  )
}
