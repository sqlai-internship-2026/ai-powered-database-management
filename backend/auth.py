"""Keycloak access token validation.

The browser signs in against Keycloak and the frontend sends the resulting
access token as a bearer header. This module is what makes that token mean
something: every endpoint that reads a row depends on require_user, so an
unauthenticated request is answered before any query runs, and on
require_permission, which checks the caller's role against the matrix at the
end of this module before the endpoint does anything.

Validation is offline. The token is checked against the realm's signing keys,
which PyJWT fetches from the realm JWKS endpoint and caches, so a request costs
no round trip to Keycloak. The repository root .env is loaded by db.py, which
main.py imports first, and every value below is read per request so a changed
realm needs a restart and nothing else.
"""

import os

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

# Keycloak signs realm tokens with RS256. The algorithm is pinned rather than
# taken from the token header, because a decoder that trusts the header would
# also accept a token that names "none".
ALGORITHMS = ["RS256"]

_jwk_client = None


def realm_url():
    """Issuer URL of the realm - also the base of its OpenID endpoints."""
    url = os.getenv("KEYCLOAK_URL", "http://localhost:8080").rstrip("/")
    realm = os.getenv("KEYCLOAK_REALM", "sql-ai")
    return f"{url}/realms/{realm}"


def expected_client():
    return os.getenv("KEYCLOAK_CLIENT_ID", "frontend")


def required_role():
    """Realm role every caller must hold. Empty accepts any account."""
    return os.getenv("KEYCLOAK_REQUIRED_ROLE", "app_user").strip()


def jwk_client():
    """The realm signing keys, fetched on first use and cached by PyJWT."""
    global _jwk_client
    if _jwk_client is None:
        _jwk_client = jwt.PyJWKClient(f"{realm_url()}/protocol/openid-connect/certs")
    return _jwk_client


class TokenRejected(Exception):
    """The token is genuine, but its claims do not authorise the caller."""


def check_claims(claims, client, role):
    """Claim checks that go beyond the signature, the issuer and the expiry.

    Keycloak issues an access token for a public client with an audience of
    "account", so the audience says nothing about which application asked for
    the token - which is why verify_aud is off below. "azp" (authorized party)
    does say it, and it is what pins a token to this frontend instead of to any
    other client that happens to live in the same realm.

    Returned as a small dict rather than a model: the endpoints only need to
    know who is calling, and nothing writes.
    """
    if claims.get("azp") != client:
        raise TokenRejected(
            f"The token was issued for another client than '{client}'."
        )

    realm_access = claims.get("realm_access") or {}
    roles = realm_access.get("roles") or []
    if role and role not in roles:
        raise TokenRejected(
            f"The account is missing the '{role}' realm role, which every "
            "caller of this API has to hold."
        )

    return {
        "username": claims.get("preferred_username") or claims.get("sub", ""),
        "name": claims.get("name", ""),
        "roles": list(roles),
    }


def _unauthorized(detail):
    """401 with the header that tells a client which scheme to retry with."""
    return HTTPException(
        status_code=401,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


# auto_error is off so a missing header produces the sentence below rather than
# the library's bare "Not authenticated".
bearer = HTTPBearer(auto_error=False, description="Keycloak access token")


def require_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
):
    """Rejects the request unless it carries a valid token for this realm."""
    if credentials is None:
        raise _unauthorized(
            "This endpoint needs a Keycloak access token in the Authorization "
            "header."
        )

    token = credentials.credentials
    try:
        signing_key = jwk_client().get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=ALGORITHMS,
            issuer=realm_url(),
            options={
                "verify_aud": False,
                "require": ["exp", "iat", "iss", "sub"],
            },
        )
    except jwt.PyJWKClientError as exc:
        # Keycloak is down, or it signed the token with a key the realm no
        # longer publishes. Neither is the caller's fault, so this is not a 401:
        # a client that retried with a fresh token would fail the same way.
        raise HTTPException(
            status_code=503,
            detail=f"Keycloak signing keys could not be read: {exc}",
        )
    except jwt.ExpiredSignatureError:
        raise _unauthorized(
            "The access token has expired. Refresh it and send the request "
            "again."
        )
    except jwt.InvalidTokenError as exc:
        raise _unauthorized(f"The access token is not valid: {exc}")

    try:
        return check_claims(claims, expected_client(), required_role())
    except TokenRejected as exc:
        # Authenticated, but not allowed - a new token would say the same.
        raise HTTPException(status_code=403, detail=str(exc))


# ---------------------------------------------------------------------------
# Roles
#
# Who may do what is decided here, once, and every route names the permission
# it needs through the router it hangs off (see main.py). Roles are Keycloak
# realm roles, assigned in Keycloak and read from the same realm_access claim
# check_claims reads, so nothing about them is stored in this application.
#
# The token is still decoded once per request. require_permission depends on
# require_user, and FastAPI resolves a dependency named twice in one request
# only once.
#
# frontend/src/auth/permissions.js holds a copy of this matrix so the screens
# can hide what a role cannot use. That copy is a courtesy to the reader; this
# one is the control.
# ---------------------------------------------------------------------------

# Most privileged first, so the first one an account holds is its effective role.
APP_ROLES = ("ADMIN", "DBA", "ANALYST", "VIEWER")

READ = "read"
AI = "ai"
SCHEMA_AUDIT = "schema_audit"
SCHEMA_AUDIT_EXPLAIN = "schema_audit_explain"

PERMISSIONS = {
    # Dashboard, the lists, project detail and the fixed reports.
    READ: frozenset({"VIEWER", "ANALYST", "DBA", "ADMIN"}),
    # The Assistant and dynamic reports: questions sent to a model, and the
    # generated SQL run again from a saved report.
    AI: frozenset({"ANALYST", "DBA", "ADMIN"}),
    # The structural review of the live schema.
    SCHEMA_AUDIT: frozenset({"DBA", "ADMIN"}),
    # A finding explained by a model.
    SCHEMA_AUDIT_EXPLAIN: frozenset({"DBA", "ADMIN"}),
}


def app_roles(roles):
    """The application roles among a token's realm roles, most privileged first.

    Keycloak compares role names exactly, so "Admin" and "ADMIN" would be two
    roles there. Here they are one, because a capitalisation slip in the admin
    console should not lock somebody out. Anything that is not one of the four
    application roles - app_user, offline_access, a typo, a value that is not
    even a string - grants nothing.
    """
    names = {role.strip().upper() for role in roles or [] if isinstance(role, str)}
    return [role for role in APP_ROLES if role in names]


def effective_role(roles):
    """The most privileged application role, or None for an account with none."""
    found = app_roles(roles)
    return found[0] if found else None


def _either(roles):
    ordered = [role for role in reversed(APP_ROLES) if role in roles]
    if len(ordered) == 1:
        return ordered[0]
    return ", ".join(ordered[:-1]) + f" or {ordered[-1]}"


def require_permission(permission):
    """A dependency that lets a request through only for a role holding permission.

    An unknown permission name fails when the router is built, not when the
    first request arrives, so a typo cannot quietly leave a route open or shut.
    """
    allowed = PERMISSIONS[permission]

    def check(user: dict = Depends(require_user)):
        if allowed.intersection(app_roles(user.get("roles"))):
            return user

        role = effective_role(user.get("roles"))
        if role is None:
            detail = (
                "This account has no application role. An administrator has to "
                f"assign one of {_either(APP_ROLES)} in Keycloak."
            )
        else:
            detail = f"The {role} role does not include this. It needs {_either(allowed)}."
        # 403, not 401: the token is valid, and signing in again would change
        # nothing - a different role would.
        raise HTTPException(status_code=403, detail=detail)

    # Read by the route-table tests, so every route's permission can be checked
    # against the matrix without sending a request.
    check.permission = permission
    check.__name__ = f"require_{permission}"
    return check
