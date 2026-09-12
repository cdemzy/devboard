from uuid import uuid4

from app.core.auth import get_user_id
from app.main import app


def project(client):
    response = client.post("/projects", json={"name": "DevBoard"})
    assert response.status_code == 201
    return response.json()["id"]


def task(client, project_id, title="Ship MVP"):
    response = client.post(f"/projects/{project_id}/tasks", json={"title": title})
    assert response.status_code == 201
    return response.json()


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_requires_authentication(client):
    app.dependency_overrides.pop(get_user_id)
    assert client.get("/projects").status_code == 401


def test_project_and_task_authorization(client):
    project_id = project(client)
    task_id = task(client, project_id)["id"]
    other_user = uuid4()
    app.dependency_overrides[get_user_id] = lambda: other_user
    assert client.get("/projects").json() == []
    for method, path, payload in [
        ("GET", f"/projects/{project_id}", None),
        ("PATCH", f"/projects/{project_id}", {"name": "Stolen"}),
        ("DELETE", f"/projects/{project_id}", None),
        ("GET", f"/projects/{project_id}/tasks", None),
        ("POST", f"/projects/{project_id}/tasks", {"title": "Stolen"}),
        ("GET", f"/tasks/{task_id}", None),
        ("PATCH", f"/tasks/{task_id}", {"title": "Stolen"}),
        ("POST", f"/tasks/{task_id}/move", {"status": "done", "position": 0}),
        ("DELETE", f"/tasks/{task_id}", None),
    ]:
        assert client.request(method, path, json=payload).status_code == 404


def test_task_create_update_move_and_persistence(client):
    pid = project(client)
    a, b, c = [task(client, pid, title) for title in ("a", "b", "c")]
    assert [a["position"], b["position"], c["position"]] == [0, 1, 2]
    moved = client.post(f"/tasks/{a['id']}/move", json={"status": "todo", "position": 2})
    assert moved.status_code == 200
    assert [t["title"] for t in moved.json()] == ["b", "c", "a"]
    updated = client.patch(
        f"/tasks/{b['id']}",
        json={
            "title": "Updated",
            "description": "Acceptance criteria",
            "priority": "high",
            "status": "done",
        },
    )
    assert updated.status_code == 200
    assert updated.json()["position"] == 0
    assert client.get(f"/tasks/{b['id']}").json()["description"] == "Acceptance criteria"
    persisted = client.get(f"/projects/{pid}/tasks").json()
    assert sorted(t["position"] for t in persisted if t["status"] == "todo") == [0, 1]
    assert client.delete(f"/tasks/{c['id']}").status_code == 204
    assert client.get(f"/tasks/{c['id']}").status_code == 404


def test_validation_and_mass_assignment(client):
    pid = project(client)
    assert client.post("/projects", json={"name": " ", "owner_id": str(uuid4())}).status_code == 422
    assert client.patch(f"/projects/{pid}", json={"name": None}).status_code == 422
    assert (
        client.post(f"/projects/{pid}/tasks", json={"title": " ", "status": "invalid"}).status_code
        == 422
    )
    t = task(client, pid)
    assert client.patch(f"/tasks/{t['id']}", json={"project_id": str(uuid4())}).status_code == 422
    assert client.patch(f"/tasks/{t['id']}", json={"position": -1}).status_code == 422


def test_archive_restore_and_cascade_delete(client):
    pid = project(client)
    tid = task(client, pid)["id"]
    assert client.patch(f"/projects/{pid}", json={"archived": True}).status_code == 200
    assert client.get("/projects").json() == []
    assert len(client.get("/projects?archived=true").json()) == 1
    assert client.post(f"/projects/{pid}/tasks", json={"title": "blocked"}).status_code == 409
    assert client.patch(f"/projects/{pid}", json={"archived": False}).status_code == 200
    assert client.delete(f"/projects/{pid}").status_code == 204
    assert client.get(f"/tasks/{tid}").status_code == 404
