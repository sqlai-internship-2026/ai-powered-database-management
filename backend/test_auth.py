"""Unit tests for the token check.

No Keycloak and no database: the claim rules are a pure function, and whether a
route is guarded is a property of the route table, so both can be asserted
without a signed token. Verifying a real RS256 signature is PyJWT's job and is
not re-tested here.
"""

import pytest

from auth import (
    ALGORITHMS,
    TokenRejected,
    check_claims,
    realm_url,
    required_role,
)


def claims(**overrides):
    """A token body Keycloak would issue for the frontend client."""
    body = {
        "azp": "frontend",
        "sub": "9b1c-uuid",
        "preferred_username": "testuser",
        "name": "Test User",
        "realm_access": {"roles": ["app_user", "offline_access"]},
    }
    body.update(overrides)
    return body


def test_a_frontend_token_with_the_role_is_accepted():
    user = check_claims(claims(), "frontend", "app_user")
    assert user["username"] == "testuser"
    assert user["name"] == "Test User"
    assert "app_user" in user["roles"]


def test_a_token_from_another_client_is_rejected():
    with pytest.raises(TokenRejected, match="another client"):
        check_claims(claims(azp="admin-cli"), "frontend", "app_user")


def test_a_token_without_azp_is_rejected():
    body = claims()
    del body["azp"]
    with pytest.raises(TokenRejected, match="another client"):
        check_claims(body, "frontend", "app_user")


def test_an_account_without_the_role_is_rejected():
    with pytest.raises(TokenRejected, match="app_user"):
        check_claims(
            claims(realm_access={"roles": ["offline_access"]}),
            "frontend",
            "app_user",
        )


def test_a_token_carrying_no_roles_at_all_is_rejected():
    body = claims()
    del body["realm_access"]
    with pytest.raises(TokenRejected, match="app_user"):
        check_claims(body, "frontend", "app_user")


def test_an_empty_required_role_accepts_any_signed_in_account():
    user = check_claims(claims(realm_access={}), "frontend", "")
    assert user["username"] == "testuser"
    assert user["roles"] == []


def test_the_subject_stands_in_for_a_missing_username():
    body = claims()
    del body["preferred_username"]
    assert check_claims(body, "frontend", "app_user")["username"] == "9b1c-uuid"


def test_only_rs256_is_accepted():
    # A decoder that also accepted "none" would take an unsigned token.
    assert ALGORITHMS == ["RS256"]


def test_the_issuer_is_built_from_the_environment(monkeypatch):
    monkeypatch.setenv("KEYCLOAK_URL", "https://sso.example.com/")
    monkeypatch.setenv("KEYCLOAK_REALM", "sql-ai")
    assert realm_url() == "https://sso.example.com/realms/sql-ai"


def test_the_required_role_defaults_to_app_user(monkeypatch):
    monkeypatch.delenv("KEYCLOAK_REQUIRED_ROLE", raising=False)
    assert required_role() == "app_user"


# ---------------------------------------------------------------------------
# The route table
#
# The guard is declared once, on the router every data endpoint hangs off. This
# checks that it stayed that way: an endpoint added with @app.get instead of
# @api.get would read rows without a token and would otherwise look fine.
#
# These tests used to walk app.routes directly. FastAPI 0.141 stores an
# included router as a single entry wrapping the original router, so that walk
# found /api/health and nothing else, and the guard check passed on an empty
# list. The walk below descends into included routers, and the tests refuse to
# pass unless they found the routes they exist to check.
# ---------------------------------------------------------------------------

from fastapi.routing import APIRoute

from auth import require_user

# Deliberately reachable without a token, and nothing else.
PUBLIC_PATHS = {"/api/health"}

# Routes that must be found. If the walk ever stops reaching the included
# router again, these are missing and the suite fails instead of checking an
# empty list.
KNOWN_PROTECTED = {
    ("GET", "/api/projects"),
    ("GET", "/api/projects/{project_id}"),
    ("GET", "/api/dashboard"),
    ("GET", "/api/reports/financial"),
    ("POST", "/api/reports/ask"),
    ("POST", "/api/schema-audit/explain"),
}

# A real value for every path parameter, so every route can be requested. A new
# route with a parameter not listed here fails the request test with its name.
PATH_EXAMPLES = {"project_id": "3004"}


def served_routes(routes):
    """Every APIRoute the app answers, including those in an included router."""
    for route in routes:
        inner = getattr(route, "original_router", None)
        if inner is not None:
            yield from served_routes(inner.routes)
        elif isinstance(route, APIRoute):
            yield route


def api_routes():
    import main

    return [
        route
        for route in served_routes(main.app.routes)
        if route.path.startswith("/api/")
    ]


def protected_routes():
    return [route for route in api_routes() if route.path not in PUBLIC_PATHS]


def is_guarded(route):
    return require_user in [dependency.dependency for dependency in route.dependencies]


def concrete_path(template):
    import re

    def example(match):
        name = match.group(1)
        assert name in PATH_EXAMPLES, f"add an example value for {{{name}}} to PATH_EXAMPLES"
        return PATH_EXAMPLES[name]

    return re.sub(r"\{(\w+)(?::\w+)?\}", example, template)


def request_without_a_token(method, path):
    """The status the whole application answers with, called as ASGI is called.

    No HTTP client and no network: the scope is what uvicorn would hand over
    for a request carrying no Authorization header.
    """
    import asyncio

    import main

    sent = []

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        sent.append(message)

    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": method,
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "root_path": "",
        "headers": [],
        "client": ("127.0.0.1", 50000),
        "server": ("127.0.0.1", 8000),
    }
    asyncio.run(main.app(scope, receive, send))
    return next(message["status"] for message in sent if message["type"] == "http.response.start")


def test_the_route_walk_finds_the_routes_it_is_meant_to_check():
    found = {(method, route.path) for route in protected_routes() for method in route.methods}
    assert KNOWN_PROTECTED <= found
    assert len(protected_routes()) >= len(KNOWN_PROTECTED)


def test_every_data_endpoint_is_behind_the_token_check():
    routes = protected_routes()
    assert routes, "no protected routes were found, so nothing was checked"

    unguarded = [
        f"{sorted(route.methods)} {route.path}" for route in routes if not is_guarded(route)
    ]
    assert unguarded == []


def test_health_stays_reachable_without_a_token():
    public = [route.path for route in api_routes() if not is_guarded(route)]
    assert public == ["/api/health"]


def test_every_protected_route_refuses_a_request_without_a_token():
    checked = []
    for route in protected_routes():
        for method in sorted(route.methods):
            path = concrete_path(route.path)
            status = request_without_a_token(method, path)
            assert status == 401, f"{method} {path} answered {status} without a token"
            checked.append((method, path))

    assert checked, "no protected routes were requested, so nothing was checked"
    assert ("GET", "/api/projects/3004") in checked
