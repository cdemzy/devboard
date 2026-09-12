from typing import Annotated
from uuid import UUID

import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings

bearer = HTTPBearer(auto_error=False)


def get_user_id(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> UUID:
    if credentials is None:
        raise HTTPException(401, "Authentication required", headers={"WWW-Authenticate": "Bearer"})
    settings = get_settings()
    if not settings.supabase_publishable_key:
        raise HTTPException(503, "Authentication is not configured")
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
        return UUID(response.json()["id"])
    except (httpx.HTTPError, ValueError, KeyError) as exc:
        raise HTTPException(503, "Authentication service unavailable") from exc
