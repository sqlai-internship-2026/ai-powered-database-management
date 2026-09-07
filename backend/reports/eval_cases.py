"""The questions the natural-language reporting feature is expected to answer.

Each case pairs a question with SQL written by hand. The reference SQL is not
the expected answer - it is the way of producing the expected answer. Grading
runs both queries and compares the rows that come back, because the same
question has many correct spellings:

    SELECT COUNT(*) FROM employees
    SELECT COUNT(id) FROM employees
    SELECT COUNT(*) AS total FROM employees

All three are right. Comparing SQL text would fail two of them.

Running the reference at grading time also keeps the set honest when the seed
data changes: nothing here stores a row count that can quietly go stale, and a
case like `late_active_projects`, whose answer depends on today's date, stays
correct on any day.

Writing this set is also how the feature gets a definition. The questions below
say what "it works" means: aggregation, filtering by a stored value, joins in
both directions, two-hop paths through the link tables, anti-joins, arithmetic
across tables, and comparing one aggregate against another column.

    difficulty  what it exercises
    easy        one table, no join
    medium      one join or one GROUP BY
    hard        several joins, a link table, an anti-join, or HAVING

Adding a case: write the question the way a person would type it, make it
precise enough to have exactly one defensible reading, then write the SQL.
Ambiguity in the question shows up as a false failure in the report.

Every case returns at least one row on purpose. A question with an empty answer
grades anything that returns nothing as correct, including a query that joined
the wrong tables, so it measures nothing.
"""

# Each case: id, question, sql, difficulty, tags.
CASES = [
    # ---------------------------------------------------------------- easy
    {
        "id": "count_employees",
        "question": "How many employees are there?",
        "difficulty": "easy",
        "tags": ["aggregate"],
        "sql": "SELECT COUNT(*) AS employee_count FROM employees",
    },
    {
        "id": "on_hold_projects",
        "question": "Which projects are on hold?",
        "difficulty": "easy",
        "tags": ["filter", "stored-value"],
        "sql": """
            SELECT name
            FROM projects
            WHERE status = 'On Hold'
            ORDER BY name
        """,
    },
    {
        "id": "total_budget",
        "question": "What is the total budget across all projects?",
        "difficulty": "easy",
        "tags": ["aggregate"],
        "sql": "SELECT SUM(budget) AS total_budget FROM projects",
    },
    {
        "id": "largest_project",
        "question": "Which project has the largest budget? Give its name and budget.",
        "difficulty": "easy",
        "tags": ["order", "limit"],
        "sql": """
            SELECT name, budget
            FROM projects
            ORDER BY budget DESC
            LIMIT 1
        """,
    },
    {
        "id": "hired_in_2023",
        "question": "How many employees were hired in 2023?",
        "difficulty": "easy",
        "tags": ["date"],
        "sql": """
            SELECT COUNT(*) AS hired
            FROM employees
            WHERE hire_date >= DATE '2023-01-01'
              AND hire_date < DATE '2024-01-01'
        """,
    },
    # -------------------------------------------------------------- medium
    {
        "id": "headcount_per_department",
        "question": (
            "How many employees work in each department? "
            "Include departments with no employees."
        ),
        "difficulty": "medium",
        "tags": ["join", "group-by", "outer-join"],
        "sql": """
            SELECT d.name AS department, COUNT(e.id) AS employee_count
            FROM departments d
            LEFT JOIN employees e ON e.department_id = d.id
            GROUP BY d.name
            ORDER BY d.name
        """,
    },
    {
        "id": "payroll_per_department",
        "question": (
            "What is the total salary cost of each department, "
            "highest first? Only departments that have employees."
        ),
        "difficulty": "medium",
        "tags": ["join", "group-by", "order"],
        "sql": """
            SELECT d.name AS department, SUM(e.salary) AS total_salary
            FROM departments d
            JOIN employees e ON e.department_id = d.id
            GROUP BY d.name
            ORDER BY total_salary DESC
        """,
    },
    {
        "id": "investment_per_project",
        "question": (
            "How much has been invested in each project, largest first? "
            "Only projects that have at least one investment."
        ),
        "difficulty": "medium",
        "tags": ["join", "group-by"],
        "sql": """
            SELECT p.name AS project, SUM(i.amount) AS total_investment
            FROM projects p
            JOIN investments i ON i.project_id = p.id
            GROUP BY p.name
            ORDER BY total_investment DESC
        """,
    },
    {
        "id": "investment_by_type",
        "question": "Total investment amount per investment type, largest first.",
        "difficulty": "medium",
        "tags": ["group-by", "stored-value"],
        "sql": """
            SELECT investment_type, SUM(amount) AS total_amount
            FROM investments
            GROUP BY investment_type
            ORDER BY total_amount DESC
        """,
    },
    {
        "id": "investment_by_year",
        "question": "Total investment amount per calendar year, oldest year first.",
        "difficulty": "medium",
        "tags": ["group-by", "date"],
        "sql": """
            SELECT EXTRACT(YEAR FROM investment_date)::int AS year,
                   SUM(amount) AS total_amount
            FROM investments
            GROUP BY 1
            ORDER BY 1
        """,
    },
    {
        "id": "top_earners",
        "question": (
            "The five highest paid employees, with their name, "
            "salary and department name."
        ),
        "difficulty": "medium",
        "tags": ["join", "order", "limit"],
        "sql": """
            SELECT e.first_name, e.last_name, e.salary, d.name AS department
            FROM employees e
            LEFT JOIN departments d ON d.id = e.department_id
            ORDER BY e.salary DESC
            LIMIT 5
        """,
    },
    {
        # Answered against today's date, so the reference is re-run every time
        # rather than compared to a stored answer.
        "id": "overdue_projects",
        "question": (
            "Which projects have an end date in the past "
            "but are not marked as Completed?"
        ),
        "difficulty": "medium",
        "tags": ["filter", "date", "negation", "stored-value"],
        "sql": """
            SELECT name, status, end_date
            FROM projects
            WHERE end_date < CURRENT_DATE
              AND status <> 'Completed'
            ORDER BY end_date
        """,
    },
    # ---------------------------------------------------------------- hard
    {
        "id": "unassigned_employees",
        "question": "Which employees are not assigned to any project?",
        "difficulty": "hard",
        "tags": ["anti-join", "link-table"],
        "sql": """
            SELECT e.first_name, e.last_name
            FROM employees e
            WHERE NOT EXISTS (
                SELECT 1 FROM project_employees pe WHERE pe.employee_id = e.id
            )
            ORDER BY e.last_name, e.first_name
        """,
    },
    {
        "id": "unused_products",
        "question": "Which products are not used in any project?",
        "difficulty": "hard",
        "tags": ["anti-join", "link-table"],
        "sql": """
            SELECT pr.name
            FROM products pr
            WHERE NOT EXISTS (
                SELECT 1 FROM project_products pp WHERE pp.product_id = pr.id
            )
            ORDER BY pr.name
        """,
    },
    {
        "id": "team_size_per_project",
        "question": (
            "How many employees are assigned to each project? "
            "Include projects with nobody assigned."
        ),
        "difficulty": "hard",
        "tags": ["link-table", "outer-join", "group-by"],
        "sql": """
            SELECT p.name AS project, COUNT(pe.employee_id) AS team_size
            FROM projects p
            LEFT JOIN project_employees pe ON pe.project_id = p.id
            GROUP BY p.name
            ORDER BY p.name
        """,
    },
    {
        "id": "multi_project_employees",
        "question": (
            "Which employees are assigned to more than one project? "
            "Give the name and how many projects."
        ),
        "difficulty": "hard",
        "tags": ["link-table", "having"],
        "sql": """
            SELECT e.first_name, e.last_name, COUNT(*) AS project_count
            FROM employees e
            JOIN project_employees pe ON pe.employee_id = e.id
            GROUP BY e.id, e.first_name, e.last_name
            HAVING COUNT(*) > 1
            ORDER BY project_count DESC, e.last_name
        """,
    },
    {
        "id": "hardware_cost_per_project",
        "question": (
            "What is the total hardware cost of each project, where hardware "
            "cost is the quantity of each product times its unit cost?"
        ),
        "difficulty": "hard",
        "tags": ["link-table", "arithmetic", "two-hop"],
        "sql": """
            SELECT p.name AS project,
                   SUM(pp.quantity * pr.unit_cost) AS hardware_cost
            FROM projects p
            JOIN project_products pp ON pp.project_id = p.id
            JOIN products pr ON pr.id = pp.product_id
            GROUP BY p.name
            ORDER BY hardware_cost DESC
        """,
    },
    {
        "id": "over_budget_projects",
        "question": "Which projects have received more investment than their budget?",
        "difficulty": "hard",
        "tags": ["having", "compare-aggregate"],
        "sql": """
            SELECT p.name, p.budget, SUM(i.amount) AS total_investment
            FROM projects p
            JOIN investments i ON i.project_id = p.id
            GROUP BY p.id, p.name, p.budget
            HAVING SUM(i.amount) > p.budget
            ORDER BY p.name
        """,
    },
    {
        "id": "department_on_active_projects",
        "question": (
            "Which department has the most people assigned to Active projects? "
            "Give the department and the number of people."
        ),
        "difficulty": "hard",
        "tags": ["two-hop", "link-table", "filter", "limit"],
        "sql": """
            SELECT d.name AS department,
                   COUNT(DISTINCT e.id) AS people
            FROM departments d
            JOIN employees e ON e.department_id = d.id
            JOIN project_employees pe ON pe.employee_id = e.id
            JOIN projects p ON p.id = pe.project_id
            WHERE p.status = 'Active'
            GROUP BY d.name
            ORDER BY people DESC
            LIMIT 1
        """,
    },
    {
        "id": "big_departments",
        "question": (
            "Departments with more than five employees, "
            "with their headcount and average salary."
        ),
        "difficulty": "hard",
        "tags": ["group-by", "having", "aggregate"],
        "sql": """
            SELECT d.name AS department,
                   COUNT(e.id) AS headcount,
                   AVG(e.salary) AS average_salary
            FROM departments d
            JOIN employees e ON e.department_id = d.id
            GROUP BY d.name
            HAVING COUNT(e.id) > 5
            ORDER BY d.name
        """,
    },
]


def case_by_id(case_id):
    """One case, or None. Used by the runner's --only flag."""
    for case in CASES:
        if case["id"] == case_id:
            return case
    return None
