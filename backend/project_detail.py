"""One project, and everything recorded against it.

Read-only, like the rest of the API. The project, its team, its products and
its investments are four queries on one connection rather than one join. A
project with seven people, six products and five investments joined in a
single statement comes back as 210 rows, and a SUM over those counts every
amount forty-two times. Each relation is read on its own, and the totals are
worked out from the rows that were read.

The budget figures follow financial_report in reports/queries.py, so a project
reads the same in its detail panel as it does on the Financial report:

    total_invested  every investment recorded against the project
    remaining       budget - total_invested, negative once it is overspent
    utilization     total_invested / budget * 100 to one decimal place,
                    rounded half away from zero as PostgreSQL's ROUND does,
                    and only defined for a budget above zero
    over_budget     total_invested > budget

A budget that is not recorded is unknown, not zero: it has no remaining, no
utilization, and is never over budget, because money spent against a budget
nobody wrote down is not evidence of an overspend. A budget of zero is a real
budget, so its remaining goes negative and anything invested against it is
over. The Financial report decides it with the same function, is_over_budget
in reports/queries.py, so the two cannot drift apart.

The arithmetic is done on the Decimal values the database returns, not on
floats: three investments of 0.10 against a budget of 0.30 are exactly on
budget, and a float sum would call that overspent.

The team is who works on the project and what they do there. Salary is not
selected, and the response is built from a fixed list of fields, so it cannot
reach the payload even if the query above it changes.
"""

from decimal import ROUND_HALF_UP, Decimal

from db import cursor
from reports.queries import is_over_budget

PROJECT_SQL = """
    SELECT id,
           name,
           description,
           status,
           start_date::text AS start_date,
           end_date::text   AS end_date,
           budget
    FROM projects
    WHERE id = %s
"""

# Through the junction table, so the role a person holds on this project comes
# with them. Ordered by surname, the way a team list is read.
TEAM_SQL = """
    SELECT e.id              AS employee_id,
           e.first_name,
           e.last_name,
           e.email,
           e.job_title,
           d.name            AS department_name,
           pe.role_in_project
    FROM project_employees pe
    JOIN employees e        ON e.id = pe.employee_id
    LEFT JOIN departments d ON d.id = e.department_id
    WHERE pe.project_id = %s
    ORDER BY e.last_name, e.first_name, e.id
"""

# Largest cost first: the question asked of a bill of materials is where the
# money went.
PRODUCTS_SQL = """
    SELECT pr.id      AS product_id,
           pr.name,
           pr.category,
           pp.quantity,
           pr.unit_cost
    FROM project_products pp
    JOIN products pr ON pr.id = pp.product_id
    WHERE pp.project_id = %s
    ORDER BY pp.quantity * pr.unit_cost DESC NULLS LAST, pr.name, pr.id
"""

# Newest first. An undated investment is unknown rather than oldest, so it goes
# last instead of being ranked by a date it does not have.
INVESTMENTS_SQL = """
    SELECT id                    AS investment_id,
           investment_type,
           amount,
           investment_date::text AS investment_date
    FROM investments
    WHERE project_id = %s
    ORDER BY investment_date DESC NULLS LAST, id DESC
"""

TEAM_FIELDS = (
    "employee_id",
    "first_name",
    "last_name",
    "email",
    "job_title",
    "department_name",
    "role_in_project",
)


def _number(value):
    """A NUMERIC value as JSON: psycopg hands over Decimal, the API sends floats."""
    return None if value is None else float(value)


def financial_summary(budget, amounts):
    """Budget position from a project's budget and its investment amounts.

    Both arrive as the Decimals the database returns. See the module docstring
    for why each figure is defined the way it is.
    """
    invested = sum((Decimal(amount) for amount in amounts), Decimal(0))
    budget = None if budget is None else Decimal(budget)
    remaining = None if budget is None else budget - invested

    utilization = None
    if budget is not None and budget > 0:
        utilization = float(
            (invested / budget * 100).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
        )

    return {
        "budget": _number(budget),
        "total_invested": float(invested),
        "remaining": _number(remaining),
        "utilization": utilization,
        "investment_count": len(amounts),
        "over_budget": is_over_budget(budget, invested),
    }


def _line_total(quantity, unit_cost):
    if quantity is None or unit_cost is None:
        return None
    return float(quantity * Decimal(unit_cost))


def build_detail(project, team, products, investments):
    """The response for one project, from the rows its four queries returned."""
    return {
        "project": {
            "id": project["id"],
            "name": project["name"],
            "description": project["description"],
            "status": project["status"],
            "start_date": project["start_date"],
            "end_date": project["end_date"],
            "budget": _number(project["budget"]),
        },
        "financial_summary": financial_summary(
            project["budget"], [row["amount"] for row in investments]
        ),
        "team": [{field: row[field] for field in TEAM_FIELDS} for row in team],
        "products": [
            {
                "product_id": row["product_id"],
                "name": row["name"],
                "category": row["category"],
                "quantity": row["quantity"],
                "unit_cost": _number(row["unit_cost"]),
                "line_total": _line_total(row["quantity"], row["unit_cost"]),
            }
            for row in products
        ],
        "investments": [
            {
                "investment_id": row["investment_id"],
                "investment_type": row["investment_type"],
                "amount": _number(row["amount"]),
                "investment_date": row["investment_date"],
            }
            for row in investments
        ],
        "counts": {
            "team_members": len(team),
            # (project_id, product_id) is the junction table's key, so every
            # row is a different product.
            "products": len(products),
            "product_units": sum(row["quantity"] or 0 for row in products),
            "investments": len(investments),
        },
    }


def read_project(project_id):
    """The detail for one project, or None when no project has that id."""
    with cursor() as cur:
        cur.execute(PROJECT_SQL, (project_id,))
        project = cur.fetchone()
        if project is None:
            return None

        cur.execute(TEAM_SQL, (project_id,))
        team = cur.fetchall()
        cur.execute(PRODUCTS_SQL, (project_id,))
        products = cur.fetchall()
        cur.execute(INVESTMENTS_SQL, (project_id,))
        investments = cur.fetchall()

    return build_detail(project, team, products, investments)
