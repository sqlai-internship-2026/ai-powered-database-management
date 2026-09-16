"""Unit tests for the token check and the role check.

No Keycloak and no database: the claim rules and the role matrix are pure
functions, and whether a route is guarded is a property of the route table, so
both can be asserted without a signed token. Where a whole request is sent, it
goes through the application the way uvicorn hands it one, with the signature
check replaced and the database and the model made to fail - and to record the
attempt - if anything reaches them. Verifying a real RS256 signature is PyJWT's
job and is not re-tested here.
"""

import asyncio
import json
import re

import psycopg
import pytest
from fastapi import HTTPException
from fastapi.routing import APIRoute

import auth
from auth import (
    AI,
    ALGORITHMS,
    APP_ROLES,
    PERMISSIONS,
    SCHEMA_AUDIT,
    TokenRejected,
    app_roles,
    check_claims,
    effective_role,
    realm_url,
    require_permission,
    require_user,
    required_role,
)
from llm import client


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
# Roles
# ---------------------------------------------------------------------------


def test_role_names_are_normalised_and_unknown_roles_grant_nothing():
    roles = [" admin ", "Analyst", "app_user", "offline_access", "superuser", 7, None]
    assert app_roles(roles) == ["ADMIN", "ANALYST"]


def test_an_account_with_no_application_role_has_no_role():
    assert app_roles(None) == []
    assert effective_role([]) is None
    assert effective_role(["app_user", "offline_access"]) is None


def test_the_effective_role_is_the_most_privileged_one_held():
    assert effective_role(["viewer", "DBA"]) == "DBA"
    assert effective_role(["ANALYST", "admin"]) == "ADMIN"


def test_every_permission_names_only_known_roles():
    for permission, roles in PERMISSIONS.items():
        assert roles, f"{permission} allows nobody"
        assert set(roles) <= set(APP_ROLES), permission


def test_an_unknown_permission_cannot_be_required():
    with pytest.raises(KeyError):
        require_permission("delete_everything")


def test_the_permission_check_returns_the_caller_for_an_allowed_role():
    check = require_permission(AI)
    user = {"username": "tester", "roles": ["app_user", "analyst"]}
    assert check(user) is user


def test_the_permission_check_refuses_a_signed_in_caller_with_403():
    check = require_permission(SCHEMA_AUDIT)
    with pytest.raises(HTTPException) as raised:
        check({"username": "tester", "roles": ["app_user", "ANALYST"]})

    assert raised.value.status_code == 403
    # Says which role the account has and which one it would need.
    assert "ANALYST" in raised.value.detail
    assert "DBA or ADMIN" in raised.value.detail


def test_an_account_without_an_application_role_is_told_so():
    check = require_permission(auth.READ)
    with pytest.raises(HTTPException) as raised:
        check({"username": "tester", "roles": ["app_user"]})

    assert raised.value.status_code == 403
    assert "no application role" in raised.value.detail


# ---------------------------------------------------------------------------
# The route table
#
# Two things are declared per router in main.py: the token check, and the
# permission its routes need. These tests check both, against a matrix written
# out by hand below rather than derived from PERMISSIONS, so a route moved into
# the wrong group - or a new route nobody classified - fails the suite.
#
# FastAPI 0.141 stores an included router as a single entry wrapping the
# original, so the walk descends into included routers. The tests also refuse
# to pass unless they found the routes they exist to check: an earlier version
# walked app.routes directly, found /api/health and nothing else, and passed.
# ---------------------------------------------------------------------------

# Deliberately reachable without a token, and nothing else.
PUBLIC_PATHS = {"/api/health"}

# Dashboard, the lists, project detail and the fixed reports.
READ_ROUTES = {
    ("GET", "/api/dashboard"),
    ("GET", "/api/departments"),
    ("GET", "/api/employees"),
    ("GET", "/api/projects"),
    ("GET", "/api/projects/{project_id}"),
    ("GET", "/api/products"),
    ("GET", "/api/investments"),
    ("GET", "/api/reports/filters"),
    ("GET", "/api/reports/financial"),
    ("GET", "/api/reports/workforce"),
    ("GET", "/api/reports/portfolio"),
}

# The Assistant and dynamic reports.
AI_ROUTES = {
    ("GET", "/api/reports/ask/examples"),
    ("POST", "/api/reports/ask"),
    ("POST", "/api/reports/run"),
}

# Schema Audit, and its explanations.
AUDIT_ROUTES = {
    ("GET", "/api/schema-audit"),
    ("GET", "/api/schema-audit/rules"),
    ("POST", "/api/schema-audit/explain"),
}

ALL_ROUTES = READ_ROUTES | AI_ROUTES | AUDIT_ROUTES

EXPECTED_ACCESS = {
    "VIEWER": READ_ROUTES,
    "ANALYST": READ_ROUTES | AI_ROUTES,
    "DBA": READ_ROUTES | AI_ROUTES | AUDIT_ROUTES,
    "ADMIN": ALL_ROUTES,
    # Signed in with a valid token, but holding none of the four roles.
    None: set(),
}

# A real value for every path parameter, so every route can be requested. A new
# route with a parameter not listed here fails with the parameter's name.
PATH_EXAMPLES = {"project_id": "3004"}

# A valid body for every POST, so an allowed request goes on to its handler
# instead of stopping at validation.
BODY_EXAMPLES = {
    ("POST", "/api/reports/ask"): {"question": "How many projects are there?"},
    ("POST", "/api/reports/run"): {"sql": "SELECT 1", "question": ""},
    ("POST", "/api/schema-audit/explain"): {
        "rule_id": "R001",
        "target": "public.projects",
        "message": "An example finding.",
    },
}


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


def route_keys(route):
    return {(method, route.path) for method in route.methods}


def is_guarded(route):
    return require_user in [dependency.dependency for dependency in route.dependencies]


def permissions_of(route):
    return [
        dependency.dependency.permission
        for dependency in route.dependencies
        if hasattr(dependency.dependency, "permission")
    ]


def concrete_path(template):
    def example(match):
        name = match.group(1)
        assert name in PATH_EXAMPLES, f"add an example value for {{{name}}} to PATH_EXAMPLES"
        return PATH_EXAMPLES[name]

    return re.sub(r"\{(\w+)(?::\w+)?\}", example, template)


def send(method, path, token=None, body=None):
    """The status the whole application answers with, called as ASGI is called.

    No HTTP client and no network: the scope is what uvicorn would hand over.
    """
    import main

    headers = []
    if token:
        headers.append((b"authorization", f"Bearer {token}".encode()))
    payload = b""
    if body is not None:
        payload = json.dumps(body).encode()
        headers.append((b"content-type", b"application/json"))

    sent = []

    async def receive():
        return {"type": "http.request", "body": payload, "more_body": False}

    async def reply(message):
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
        "headers": headers,
        "client": ("127.0.0.1", 50000),
        "server": ("127.0.0.1", 8000),
    }
    asyncio.run(main.app(scope, receive, reply))
    return next(message["status"] for message in sent if message["type"] == "http.response.start")


@pytest.fixture
def backends(monkeypatch):
    """Makes the database and the model fail, and records every attempt on them.

    Both fail the way the real thing fails when it is down, so an allowed
    request ends in the application's own 503 rather than crashing the test.
    """
    reached = []

    def no_database(*args, **kwargs):
        reached.append("database")
        raise psycopg.OperationalError("the tests have no database")

    def no_model(*args, **kwargs):
        reached.append("model")
        raise client.LLMUnavailable("the tests have no model")

    monkeypatch.setattr(psycopg, "connect", no_database)
    monkeypatch.setattr(client, "chat", no_model)
    return reached


class SignedIn:
    """Stands in for Keycloak: any bearer token decodes to the claims set here."""

    def __init__(self, monkeypatch):
        self.roles = []
        self.decoded = []
        monkeypatch.setenv("KEYCLOAK_CLIENT_ID", "frontend")
        monkeypatch.setenv("KEYCLOAK_REQUIRED_ROLE", "app_user")
        monkeypatch.setattr(auth, "jwk_client", lambda: self)
        monkeypatch.setattr(auth.jwt, "decode", self.decode)

    def get_signing_key_from_jwt(self, token):
        return type("SigningKey", (), {"key": "test-key"})()

    def decode(self, token, key, **options):
        self.decoded.append(token)
        return claims(realm_access={"roles": ["app_user", *self.roles]})

    def as_role(self, role):
        self.roles = [role] if role else []
        return "test-token"


@pytest.fixture
def signed_in(monkeypatch):
    return SignedIn(monkeypatch)


def reachable(role, signed_in):
    """The routes a role gets past the security layer on, by sending requests."""
    token = signed_in.as_role(role)
    allowed = set()
    for route in protected_routes():
        for key in route_keys(route):
            method, path = key
            status = send(method, concrete_path(path), token, BODY_EXAMPLES.get(key))
            assert status != 401, f"{key} rejected a valid token"
            if status != 403:
                allowed.add(key)
    return allowed


def test_every_api_route_is_classified_in_the_matrix():
    served = set().union(*(route_keys(route) for route in protected_routes()))
    assert served, "no protected routes were found, so nothing was checked"
    assert served - ALL_ROUTES == set(), "an /api route is missing from the matrix"
    assert ALL_ROUTES - served == set(), "the matrix names a route the app does not serve"


def test_every_data_endpoint_is_behind_the_token_check():
    routes = protected_routes()
    assert routes, "no protected routes were found, so nothing was checked"

    unguarded = [
        f"{sorted(route.methods)} {route.path}" for route in routes if not is_guarded(route)
    ]
    assert unguarded == []


def test_every_protected_route_names_one_permission_matching_the_matrix():
    for route in protected_routes():
        found = permissions_of(route)
        assert len(found) == 1, f"{route.path} names {found}"
        allowed_roles = PERMISSIONS[found[0]]
        for key in route_keys(route):
            for role in APP_ROLES:
                assert (key in EXPECTED_ACCESS[role]) == (role in allowed_roles), (key, role)


def test_health_stays_reachable_without_a_token():
    public = [route.path for route in api_routes() if not is_guarded(route)]
    assert public == ["/api/health"]
    assert all(not permissions_of(route) for route in api_routes() if route.path in PUBLIC_PATHS)


def test_every_protected_route_refuses_a_request_without_a_token(backends):
    checked = []
    for route in protected_routes():
        for key in route_keys(route):
            method, path = key
            status = send(method, concrete_path(path), body=BODY_EXAMPLES.get(key))
            assert status == 401, f"{method} {path} answered {status} without a token"
            checked.append(key)

    assert checked, "no protected routes were requested, so nothing was checked"
    assert ("GET", "/api/projects/{project_id}") in checked
    assert backends == []


def test_admin_gets_past_the_role_check_on_every_protected_route(signed_in, backends):
    assert reachable("ADMIN", signed_in) == ALL_ROUTES


def test_dba_reaches_schema_audit_and_the_ai_routes(signed_in, backends):
    allowed = reachable("DBA", signed_in)
    assert AUDIT_ROUTES <= allowed
    assert AI_ROUTES <= allowed
    assert allowed == EXPECTED_ACCESS["DBA"]


def test_analyst_reaches_the_ai_routes_but_not_schema_audit(signed_in, backends):
    allowed = reachable("ANALYST", signed_in)
    assert AI_ROUTES <= allowed
    assert allowed & AUDIT_ROUTES == set()
    assert allowed == EXPECTED_ACCESS["ANALYST"]


def test_viewer_reaches_neither_the_ai_routes_nor_schema_audit(signed_in, backends):
    allowed = reachable("VIEWER", signed_in)
    assert allowed & (AI_ROUTES | AUDIT_ROUTES) == set()
    assert allowed == EXPECTED_ACCESS["VIEWER"]


def test_an_account_without_an_application_role_reaches_nothing(signed_in, backends):
    assert reachable(None, signed_in) == set()


def test_role_names_in_the_token_are_matched_whatever_their_case(signed_in, backends):
    token = signed_in.as_role("dba")
    assert send("GET", "/api/schema-audit/rules", token) != 403


@pytest.mark.parametrize("role", ["VIEWER", "ANALYST", "DBA", None])
def test_a_refused_request_reaches_neither_the_database_nor_the_model(role, signed_in, backends):
    token = signed_in.as_role(role)
    refused = sorted(ALL_ROUTES - EXPECTED_ACCESS[role])
    if role != "DBA":
        assert refused, "nothing to refuse, so nothing was checked"

    for key in refused:
        method, path = key
        backends.clear()
        status = send(method, concrete_path(path), token, BODY_EXAMPLES.get(key))
        assert status == 403, f"{key} answered {status} for {role}"
        assert backends == [], f"{key} reached {backends} before refusing {role}"


def test_an_allowed_request_goes_on_to_its_handler(signed_in, backends):
    # Past the role check the endpoint runs; here the database is down, so the
    # application's own 503 is the proof the request got that far.
    token = signed_in.as_role("ANALYST")
    status = send("POST", "/api/reports/ask", token, BODY_EXAMPLES[("POST", "/api/reports/ask")])
    assert status == 503
    assert backends, "the handler never ran"


def test_the_token_is_decoded_once_per_request(signed_in, backends):
    token = signed_in.as_role("ANALYST")
    signed_in.decoded.clear()
    send("GET", "/api/reports/ask/examples", token)
    assert len(signed_in.decoded) == 1
