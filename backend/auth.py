"""Keycloak access token validation.

The browser signs in against Keycloak and the frontend sends the resulting
access token as a bearer header. This module is what makes that token mean
something: every endpoint that reads a row depends on require_user, so an
unauthenticated request is answered before any query runs.

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
