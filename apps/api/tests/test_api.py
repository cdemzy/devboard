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


def test_new_project_names_increment_for_each_default_project(client):
    names = [
        client.post("/projects", json={"name": "New Project"}).json()["name"] for _ in range(3)
    ]
    assert names == ["New Project", "New Project (1)", "New Project (2)"]


def test_project_order_persists_for_active_projects(client):
    projects = [
        client.post("/projects", json={"name": name}).json() for name in ("One", "Two", "Three")
    ]
    reordered = [projects[2]["id"], projects[0]["id"], projects[1]["id"]]

    response = client.put("/projects/order", json={"project_ids": reordered})

    assert response.status_code == 204
    assert [project["id"] for project in client.get("/projects").json()] == reordered
    assert client.put("/projects/order", json={"project_ids": reordered[:2]}).status_code == 422


def test_cors_allows_tag_order_reordering(client):
    response = client.options(
        "/project-tags/order",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "PUT",
        },
    )
    assert response.status_code == 200
    assert "PUT" in response.headers["access-control-allow-methods"]


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
    assert [a["ticket_id"], b["ticket_id"], c["ticket_id"]] == ["DE-1", "DE-2", "DE-3"]
    moved = client.post(f"/tasks/{a['id']}/move", json={"status": "todo", "position": 2})
    assert moved.status_code == 204
    assert [t["title"] for t in client.get(f"/projects/{pid}/tasks").json()] == ["b", "c", "a"]
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


def test_project_prefixes_are_unique_per_owner_and_task_ids_are_not_reused(client):
    devboard = client.post("/projects", json={"name": "DevBoard"}).json()
    denver = client.post("/projects", json={"name": "DenverExample"}).json()
    assert devboard["ticket_prefix"] == "DE"
    assert denver["ticket_prefix"] == "DN"

    renamed = client.patch(f"/projects/{devboard['id']}", json={"name": "Renamed"}).json()
    assert renamed["ticket_prefix"] == "DE"

    first = task(client, devboard["id"], "First")
    assert client.delete(f"/tasks/{first['id']}").status_code == 204
    assert task(client, devboard["id"], "Second")["ticket_id"] == "DE-2"


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


def test_project_tags_are_reusable_per_owner(client):
    client.post("/projects", json={"name": "One", "tags": ["Frontend", "Urgent"]})
    client.post("/projects", json={"name": "Two", "tags": ["urgent", "Backend"]})
    tags = client.get("/project-tags").json()
    assert [tag["name"] for tag in tags] == ["Frontend", "Urgent", "Backend"]
    assert len({tag["color"] for tag in tags}) == len(tags)
    reordered = client.put(
        "/project-tags/order", json={"tag_ids": [tag["id"] for tag in reversed(tags)]}
    )
    assert reordered.status_code == 200
    assert [tag["name"] for tag in client.get("/project-tags").json()] == [
        "Backend",
        "Urgent",
        "Frontend",
    ]
    urgent = next(tag for tag in tags if tag["name"] == "Urgent")
    assert (
        client.patch(f"/project-tags/{urgent['id']}", json={"color": "green"}).json()["color"]
        == "green"
    )
    assert (
        client.patch(f"/project-tags/{urgent['id']}", json={"name": "Priority"}).json()["name"]
        == "Priority"
    )
    assert all("Priority" in project["tags"] for project in client.get("/projects").json())
    assert client.delete(f"/project-tags/{urgent['id']}").status_code == 204
    assert all("Urgent" not in project["tags"] for project in client.get("/projects").json())


def test_new_project_tags_use_unused_colors_before_reusing_colors(client):
    tag_names = [f"Tag {index}" for index in range(9)]
    client.post("/projects", json={"name": "Palette", "tags": tag_names})
    tags = client.get("/project-tags").json()
    colors = [tag["color"] for tag in tags]

    assert len(set(colors[:8])) == 8
    assert colors[8] in colors[:8]


def test_new_project_tag_uses_the_requested_preview_color(client):
    project_id = project(client)
    response = client.patch(
        f"/projects/{project_id}",
        json={"tags": ["Preview"], "new_tag_colors": {"Preview": "green"}},
    )

    assert response.status_code == 200
    assert client.get("/project-tags").json()[0]["color"] == "green"


def test_task_archive_restore_and_permanent_delete(client):
    pid = project(client)
    archived = task(client, pid, "Archive me")
    assert client.post(f"/tasks/{archived['id']}/archive").status_code == 200
    assert client.get(f"/projects/{pid}/tasks").json() == []
    archived_tasks = client.get(f"/projects/{pid}/tasks?archived=true").json()
    assert [item["id"] for item in archived_tasks] == [archived["id"]]
    assert client.post(f"/tasks/{archived['id']}/restore").status_code == 200
    assert [item["id"] for item in client.get(f"/projects/{pid}/tasks").json()] == [archived["id"]]
    assert client.post(f"/tasks/{archived['id']}/archive").status_code == 200
    assert client.delete(f"/tasks/{archived['id']}").status_code == 204
