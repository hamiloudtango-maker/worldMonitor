"""
Per-source authentication — applies auth config to outgoing requests.
Handles: API key (header/query), Bearer token, OAuth2 client credentials.
"""

import time

import httpx

from app.source_engine.schemas import AuthConfig

# In-memory cache for OAuth2 tokens: {secret_ref: (token, expires_at)}
_oauth2_cache: dict[str, tuple[str, float]] = {}


def apply_auth_headers(
    auth: AuthConfig | None,
    secrets: dict[str, str],
    headers: dict[str, str],
    params: dict[str, str],
) -> None:
    """Mutate headers/params in place to apply auth config."""
    if auth is None or auth.type == "none":
        return

    secret_value = secrets.get(auth.secret_ref or "", "")

    if auth.type == "api_key_header":
        header_name = auth.header_name or "X-Api-Key"
        headers[header_name] = secret_value

    elif auth.type == "api_key_query":
        param_name = auth.query_param or "apiKey"
        params[param_name] = secret_value

    elif auth.type == "bearer":
        headers["Authorization"] = f"Bearer {secret_value}"

    elif auth.type == "oauth2_client":
        token = _get_oauth2_token(auth, secret_value)
        headers["Authorization"] = f"Bearer {token}"


def _get_oauth2_token(auth: AuthConfig, client_secret: str) -> str:
    """Get OAuth2 token, using cache if still valid."""
    cache_key = auth.secret_ref or auth.token_url or ""

    cached = _oauth2_cache.get(cache_key)
    if cached and cached[1] > time.time() + 60:  # 60s margin
        return cached[0]

    if not auth.token_url:
        raise ValueError("OAuth2 auth requires token_url")

    # Client credentials grant
    resp = httpx.post(
        auth.token_url,
        data={
            "grant_type": "client_credentials",
            "client_id": cache_key,
            "client_secret": client_secret,
        },
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()

    token = data["access_token"]
    expires_in = data.get("expires_in", 3600)
    _oauth2_cache[cache_key] = (token, time.time() + expires_in)

    return token
