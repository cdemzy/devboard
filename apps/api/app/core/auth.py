from dataclasses import dataclass
from threading import Lock
from time import monotonic
from typing import Annotated
from uuid import UUID

import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings

bearer = HTTPBearer(auto_error=False)
identity_cache_lock = Lock()


@dataclass(frozen=True)
class CachedIdentity:
    user_id: UUID
    expires_at: float


identity_cache: dict[str, CachedIdentity] = {}


def get_cached_identity(token: str) -> UUID | None:
    # O(1): avoid a remote Supabase identity lookup for the same recently verified token.
    with identity_cache_lock:
        identity = identity_cache.get(token)
        if identity is None:
            return None
        if identity.expires_at <= monotonic():
            del identity_cache[token]
            return None
        return identity.user_id


def cache_identity(token: str, user_id: UUID, ttl_seconds: int) -> None:
    with identity_cache_lock:
        identity_cache[token] = CachedIdentity(
            user_id=user_id,
            expires_at=monotonic() + max(1, ttl_seconds),
        )


def get_user_id(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> UUID:
    if credentials is None:
        raise HTTPException(401, "Authentication required", headers={"WWW-Authenticate": "Bearer"})
    settings = get_settings()
    if not settings.supabase_publishable_key:
        raise HTTPException(503, "Authentication is not configured")
    cached_user_id = get_cached_identity(credentials.credentials)
    if cached_user_id is not None:
        return cached_user_id
    # Supabase verifies the token, expiry and user. Never trust decoded client claims.
    try:
        response = httpx.get(
            f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {credentials.credentials}",
                "apikey": settings.supabase_publishable_key,
            },
            timeout=10,
        )
        if response.status_code in (401, 403):
            raise HTTPException(401, "Invalid or expired session")
        response.raise_for_status()
        user_id = UUID(response.json()["id"])
        cache_identity(credentials.credentials, user_id, settings.auth_identity_cache_ttl_seconds)
        return user_id
    except (httpx.HTTPError, ValueError, KeyError) as exc:
        raise HTTPException(503, "Authentication service unavailable") from exc
