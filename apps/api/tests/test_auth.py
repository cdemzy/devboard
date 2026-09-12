from uuid import uuid4

import httpx

from app.core.auth import get_user_id
from app.core.config import Settings


def test_verified_supabase_identity(client, monkeypatch):
    app_user = uuid4()
    client.app.dependency_overrides.pop(get_user_id)
    monkeypatch.setattr(
        "app.core.auth.get_settings",
        lambda: Settings(
            supabase_url="https://test.supabase.co", supabase_publishable_key="public-test-key"
        ),
    )

    def verify(url, headers, timeout):
        assert url == "https://test.supabase.co/auth/v1/user"
        assert headers["Authorization"] == "Bearer opaque-token"
        assert headers["apikey"] == "public-test-key"
        return httpx.Response(200, json={"id": str(app_user)}, request=httpx.Request("GET", url))

    monkeypatch.setattr("app.core.auth.httpx.get", verify)
    response = client.post(
        "/projects", json={"name": "Verified"}, headers={"Authorization": "Bearer opaque-token"}
    )
    assert response.status_code == 201
    assert response.json()["owner_id"] == str(app_user)


def test_invalid_token_and_auth_outage(client, monkeypatch):
    client.app.dependency_overrides.pop(get_user_id)
    monkeypatch.setattr(
        "app.core.auth.get_settings", lambda: Settings(supabase_publishable_key="public-test-key")
    )
    for upstream, expected in [(401, 401), (403, 401), (500, 503)]:
        monkeypatch.setattr(
            "app.core.auth.httpx.get",
            lambda url, status=upstream, **kwargs: httpx.Response(
                status, request=httpx.Request("GET", url)
            ),
        )
        assert (
            client.get("/projects", headers={"Authorization": "Bearer invalid"}).status_code
            == expected
        )
