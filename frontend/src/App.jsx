import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './auth/ProtectedRoute'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import Employees from './pages/Employees'
import Departments from './pages/Departments'
import Products from './pages/Products'
import Investments from './pages/Investments'
import Reports from './pages/Reports'
import FinancialReport from './pages/reports/FinancialReport'
import WorkforceReport from './pages/reports/WorkforceReport'
import PortfolioReport from './pages/reports/PortfolioReport'
import SchemaAudit from './pages/SchemaAudit'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <ProtectedRoute>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/departments" element={<Departments />} />
          <Route path="/products" element={<Products />} />
          <Route path="/investments" element={<Investments />} />
          <Route path="/reports" element={<Reports />}>
            <Route index element={<FinancialReport />} />
            <Route path="workforce" element={<WorkforceReport />} />
            <Route path="portfolio" element={<PortfolioReport />} />
          </Route>
          <Route path="/schema-audit" element={<SchemaAudit />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </ProtectedRoute>
  )
}
