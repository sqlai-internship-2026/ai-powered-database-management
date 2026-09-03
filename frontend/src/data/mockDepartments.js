// Temporary mock data. Property names follow the "departments" table columns
// (id, name, description). "employee_count" is a derived value that the future
// FastAPI endpoint will calculate with a COUNT over the employees table.
export const mockDepartments = [
  { id: 1, name: 'Engineering', description: 'Systems and platform engineering', employee_count: 42 },
  { id: 2, name: 'Avionics', description: 'Flight control and onboard software', employee_count: 26 },
  { id: 3, name: 'Radar Systems', description: 'Radar design and signal processing', employee_count: 19 },
  { id: 4, name: 'Quality Assurance', description: 'Testing, certification and compliance', employee_count: 15 },
  { id: 5, name: 'Production', description: 'Assembly lines and manufacturing', employee_count: 21 },
  { id: 6, name: 'Supply Chain', description: 'Procurement and logistics', employee_count: 9 },
  { id: 7, name: 'Research and Development', description: 'Advanced concepts and prototypes', employee_count: 8 },
  { id: 8, name: 'Finance', description: 'Budget planning and cost control', employee_count: 5 }
]
