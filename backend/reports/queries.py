"""The SQL behind the three reporting screens.

Each report returns one payload with everything a screen needs - summary
tiles, chart series and table rows - so a screen is one request instead of
five. Filters are applied as query parameters, never by string formatting, and
the date window is applied in the JOIN condition rather than the WHERE clause
so a project with no investment inside the window still appears in the table
with a zero.
"""

from db import fetch_all, fetch_one


def _investment_window(year_from, year_to, params):
    """Extra JOIN condition restricting investments to a closed year range.

    Appends to params in the same order the fragment uses them, so the caller
    can keep passing one flat parameter list to psycopg.
    """
    fragment = ""
    if year_from is not None:
        fragment += " AND i.investment_date >= make_date(%s, 1, 1)"
        params.append(int(year_from))
    if year_to is not None:
        fragment += " AND i.investment_date <= make_date(%s, 12, 31)"
        params.append(int(year_to))
    return fragment


def _status_filter(statuses, params, alias="p"):
    if not statuses:
        return ""
    params.append(list(statuses))
    return f" AND {alias}.status = ANY(%s)"


def filter_options():
    """Everything the filter bar needs to build itself from live data."""
    statuses = fetch_all(
        """
        SELECT status, COUNT(*)::int AS count
        FROM projects
        WHERE status IS NOT NULL
        GROUP BY status
        ORDER BY COUNT(*) DESC, status
        """
    )
    years = fetch_one(
        """
        SELECT MIN(EXTRACT(YEAR FROM investment_date))::int AS min_year,
               MAX(EXTRACT(YEAR FROM investment_date))::int AS max_year
        FROM investments
        """
    )
    departments = fetch_all(
        "SELECT id, name FROM departments ORDER BY name"
    )
    return {"statuses": statuses, "years": years, "departments": departments}


def financial_report(year_from=None, year_to=None, statuses=None):
    """Budget against money actually committed, per project and over time."""
    params = []
    window = _investment_window(year_from, year_to, params)
    status_clause = _status_filter(statuses, params)

    projects = fetch_all(
        f"""
        SELECT p.id,
               p.name,
               p.status,
               p.start_date::text AS start_date,
               p.end_date::text   AS end_date,
               p.budget::float8   AS budget,
               COALESCE(SUM(i.amount), 0)::float8              AS invested,
               (p.budget - COALESCE(SUM(i.amount), 0))::float8 AS remaining,
               COUNT(i.id)::int                                AS investment_count,
               CASE
                   WHEN p.budget > 0
                   THEN ROUND(COALESCE(SUM(i.amount), 0) / p.budget * 100, 1)::float8
               END AS utilization
        FROM projects p
        LEFT JOIN investments i ON i.project_id = p.id{window}
        WHERE TRUE{status_clause}
        GROUP BY p.id, p.name, p.status, p.start_date, p.end_date, p.budget
        ORDER BY p.budget DESC
        """,
        params,
    )

    # The chart series re-use the same window, but a project row is not needed
    # here - only the investments that survive the filter.
    series_params = []
    series_window = _investment_window(year_from, year_to, series_params)
    series_status = _status_filter(statuses, series_params)

    trend = fetch_all(
        f"""
        SELECT EXTRACT(YEAR FROM i.investment_date)::int AS year,
               SUM(i.amount)::float8                     AS amount,
               COUNT(*)::int                             AS count
        FROM investments i
        JOIN projects p ON p.id = i.project_id
        WHERE TRUE{series_window}{series_status}
        GROUP BY 1
        ORDER BY 1
        """,
        series_params,
    )

    type_params = []
    type_window = _investment_window(year_from, year_to, type_params)
    type_status = _status_filter(statuses, type_params)

    by_type = fetch_all(
        f"""
        SELECT i.investment_type   AS label,
               SUM(i.amount)::float8 AS amount,
               COUNT(*)::int         AS count
        FROM investments i
        JOIN projects p ON p.id = i.project_id
        WHERE TRUE{type_window}{type_status}
        GROUP BY 1
        ORDER BY 2 DESC
        """,
        type_params,
    )

    total_budget = sum(row["budget"] or 0 for row in projects)
    total_invested = sum(row["invested"] for row in projects)
    over_budget = [row for row in projects if row["invested"] > (row["budget"] or 0)]

    summary = {
        "project_count": len(projects),
        "total_budget": total_budget,
        "total_invested": total_invested,
        "total_remaining": total_budget - total_invested,
        "utilization": round(total_invested / total_budget * 100, 1) if total_budget else None,
        "over_budget_count": len(over_budget),
        "investment_count": sum(row["investment_count"] for row in projects),
    }

    return {
        "summary": summary,
        "projects": projects,
        "trend": trend,
        "by_type": by_type,
    }


def workforce_report(department_id=None):
    """Headcount, payroll and how people are spread across the programs."""
    params = []
    department_clause = ""
    if department_id is not None:
        department_clause = " AND e.department_id = %s"
        params.append(int(department_id))

    departments = fetch_all(
        f"""
        SELECT d.id,
               d.name,
               COUNT(e.id)::int                       AS headcount,
               COALESCE(SUM(e.salary), 0)::float8     AS total_salary,
               ROUND(AVG(e.salary), 0)::float8        AS average_salary,
               MIN(e.salary)::float8                  AS min_salary,
               MAX(e.salary)::float8                  AS max_salary
        FROM departments d
        LEFT JOIN employees e ON e.department_id = d.id{department_clause}
        GROUP BY d.id, d.name
        ORDER BY COUNT(e.id) DESC, d.name
        """,
        params,
    )

    hires = fetch_all(
        f"""
        SELECT EXTRACT(YEAR FROM e.hire_date)::int AS year,
               COUNT(*)::int                       AS count
        FROM employees e
        WHERE e.hire_date IS NOT NULL{department_clause}
        GROUP BY 1
        ORDER BY 1
        """,
        params,
    )

    # Allocation counts distinct programs per person; the roles column is a
    # readable summary of what they do on them.
    allocation = fetch_all(
        f"""
        SELECT e.id,
               e.first_name || ' ' || e.last_name AS employee,
               e.job_title,
               d.name                             AS department_name,
               COUNT(pe.project_id)::int          AS project_count,
               STRING_AGG(DISTINCT pe.role_in_project, ', '
                          ORDER BY pe.role_in_project) AS roles
        FROM employees e
        LEFT JOIN departments d ON d.id = e.department_id
        LEFT JOIN project_employees pe ON pe.employee_id = e.id
        WHERE TRUE{department_clause}
        GROUP BY e.id, e.first_name, e.last_name, e.job_title, d.name
        ORDER BY COUNT(pe.project_id) DESC, e.last_name
        """,
        params,
    )

    titles = fetch_all(
        f"""
        SELECT e.job_title                  AS label,
               COUNT(*)::int                AS count,
               ROUND(AVG(e.salary), 0)::float8 AS average_salary
        FROM employees e
        WHERE e.job_title IS NOT NULL{department_clause}
        GROUP BY 1
        ORDER BY 2 DESC, 1
        """,
        params,
    )

    totals = fetch_one(
        f"""
        SELECT COUNT(*)::int                    AS headcount,
               COALESCE(SUM(e.salary), 0)::float8 AS total_salary,
               ROUND(AVG(e.salary), 0)::float8    AS average_salary,
               ROUND(AVG(EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.hire_date))), 1)::float8
                   AS average_tenure_years
        FROM employees e
        WHERE TRUE{department_clause}
        """,
        params,
    )
    totals["unassigned_count"] = sum(
        1 for row in allocation if row["project_count"] == 0
    )
    totals["department_count"] = sum(1 for row in departments if row["headcount"] > 0)

    return {
        "summary": totals,
        "departments": departments,
        "hires_by_year": hires,
        "allocation": allocation,
        "job_titles": titles,
    }


def portfolio_report(statuses=None):
    """Schedule position of every program and the hardware it consumes."""
    params = []
    status_clause = _status_filter(statuses, params)

    schedule = fetch_all(
        f"""
        SELECT p.id,
               p.name,
               p.status,
               p.start_date::text AS start_date,
               p.end_date::text   AS end_date,
               p.budget::float8   AS budget,
               (DATE_PART('year',  AGE(p.end_date, p.start_date)) * 12
                + DATE_PART('month', AGE(p.end_date, p.start_date)))::int
                   AS duration_months,
               (DATE_PART('year',  AGE(p.end_date, CURRENT_DATE)) * 12
                + DATE_PART('month', AGE(p.end_date, CURRENT_DATE)))::int
                   AS months_remaining,
               CASE
                   WHEN p.end_date <= p.start_date THEN NULL
                   ELSE ROUND(
                       LEAST(GREATEST(
                           (CURRENT_DATE - p.start_date)::numeric
                           / (p.end_date - p.start_date)::numeric, 0), 1) * 100, 1)::float8
               END AS time_elapsed_percent
        FROM projects p
        WHERE TRUE{status_clause}
        ORDER BY p.end_date
        """,
        params,
    )

    usage_params = []
    usage_status = _status_filter(statuses, usage_params)

    product_usage = fetch_all(
        f"""
        SELECT p.id,
               p.name,
               p.status,
               p.budget::float8                             AS budget,
               SUM(pp.quantity)::int                        AS unit_count,
               COUNT(DISTINCT pp.product_id)::int           AS product_count,
               SUM(pp.quantity * pr.unit_cost)::float8      AS hardware_cost,
               CASE
                   WHEN p.budget > 0
                   THEN ROUND(SUM(pp.quantity * pr.unit_cost) / p.budget * 100, 1)::float8
               END AS percent_of_budget
        FROM project_products pp
        JOIN products pr ON pr.id = pp.product_id
        JOIN projects p  ON p.id  = pp.project_id
        WHERE TRUE{usage_status}
        GROUP BY p.id, p.name, p.status, p.budget
        ORDER BY SUM(pp.quantity * pr.unit_cost) DESC
        """,
        usage_params,
    )

    category_params = []
    category_status = _status_filter(statuses, category_params)

    by_category = fetch_all(
        f"""
        SELECT pr.category                                AS label,
               COUNT(DISTINCT pr.id)::int                 AS product_count,
               COALESCE(SUM(pp.quantity), 0)::int         AS unit_count,
               COALESCE(SUM(pp.quantity * pr.unit_cost), 0)::float8 AS amount
        FROM products pr
        LEFT JOIN project_products pp ON pp.product_id = pr.id
        LEFT JOIN projects p          ON p.id = pp.project_id
        WHERE TRUE{category_status}
        GROUP BY 1
        ORDER BY 4 DESC
        """,
        category_params,
    )

    top_params = []
    top_status = _status_filter(statuses, top_params)

    top_products = fetch_all(
        f"""
        SELECT pr.id,
               pr.name,
               pr.category,
               pr.unit_cost::float8                    AS unit_cost,
               SUM(pp.quantity)::int                   AS unit_count,
               COUNT(DISTINCT pp.project_id)::int      AS project_count,
               SUM(pp.quantity * pr.unit_cost)::float8 AS amount
        FROM project_products pp
        JOIN products pr ON pr.id = pp.product_id
        JOIN projects p  ON p.id  = pp.project_id
        WHERE TRUE{top_status}
        GROUP BY pr.id, pr.name, pr.category, pr.unit_cost
        ORDER BY 7 DESC
        """,
        top_params,
    )

    # "Overdue" means the end date has passed while the status still says the
    # work is running - the one schedule problem worth a tile of its own.
    overdue = [
        row
        for row in schedule
        if row["status"] in ("Active", "On Hold") and (row["months_remaining"] or 0) < 0
    ]
    ending_soon = [
        row
        for row in schedule
        if row["status"] == "Active" and 0 <= (row["months_remaining"] or 0) <= 12
    ]

    summary = {
        "project_count": len(schedule),
        "hardware_cost": sum(row["hardware_cost"] or 0 for row in product_usage),
        "unit_count": sum(row["unit_count"] or 0 for row in product_usage),
        "catalog_size": sum(row["product_count"] for row in by_category),
        "overdue_count": len(overdue),
        "ending_soon_count": len(ending_soon),
        "average_duration_months": (
            round(sum(row["duration_months"] or 0 for row in schedule) / len(schedule), 1)
            if schedule
            else None
        ),
    }

    return {
        "summary": summary,
        "schedule": schedule,
        "product_usage": product_usage,
        "by_category": by_category,
        "top_products": top_products,
    }
