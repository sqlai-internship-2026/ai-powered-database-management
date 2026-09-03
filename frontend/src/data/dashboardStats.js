import { mockProjects } from './mockProjects'
import { mockEmployees } from './mockEmployees'
import { mockDepartments } from './mockDepartments'
import { mockProducts } from './mockProducts'
import { mockInvestments } from './mockInvestments'

// Dashboard summary derived from the mock datasets so every page stays
// consistent. Later this whole object will come from a single API endpoint.
export const dashboardStats = {
  total_projects: mockProjects.length,
  active_projects: mockProjects.filter((project) => project.status === 'Active').length,
  // The Employees page only lists a sample of records, so the headcount is
  // taken from the per-department counts.
  total_employees: mockDepartments.reduce(
    (total, department) => total + department.employee_count,
    0
  ),
  total_departments: mockDepartments.length,
  total_products: mockProducts.length,
  total_investment_amount: mockInvestments.reduce(
    (total, investment) => total + investment.amount,
    0
  ),
  total_project_budget: mockProjects.reduce(
    (total, project) => total + project.budget,
    0
  ),
  listed_employees: mockEmployees.length,
}
