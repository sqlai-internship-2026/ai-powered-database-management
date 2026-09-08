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
# ---------------------------------------------------------------------------

PUBLIC_PATHS = {"/api/health"}


def api_routes():
    import main
    from auth import require_user

    for route in main.app.routes:
        path = getattr(route, "path", "")
        if path.startswith("/api/"):
            guards = [
                dependency.dependency
                for dependency in getattr(route, "dependencies", [])
            ]
            yield path, require_user in guards


def test_every_data_endpoint_is_behind_the_token_check():
    unguarded = [
        path
        for path, guarded in api_routes()
        if not guarded and path not in PUBLIC_PATHS
    ]
    assert unguarded == []


def test_health_stays_reachable_without_a_token():
    public = [path for path, guarded in api_routes() if not guarded]
    assert public == ["/api/health"]
