from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.core.auth import get_user_id
from app.core.database import get_db
from app.repositories.projects import owned_project, owned_task, project_tasks
from app.schemas import (
    ProjectCreate,
    ProjectTagOut,
    ProjectTagUpdate,
    ProjectOut,
    ProjectUpdate,
    TaskCreate,
    TaskMove,
    TaskOut,
    TaskUpdate,
)
from app.services import boards

router = APIRouter()
DB = Annotated[Session, Depends(get_db)]
User = Annotated[UUID, Depends(get_user_id)]


@router.get("/projects", response_model=list[ProjectOut])
def list_projects(db: DB, user: User, archived: bool = False):
    return boards.list_projects(db, user, archived)


@router.get("/project-tags", response_model=list[ProjectTagOut])
def list_project_tags(db: DB, user: User):
    return boards.list_project_tags(db, user)


@router.patch("/project-tags/{tag_id}", response_model=ProjectTagOut)
def update_project_tag(tag_id: UUID, data: ProjectTagUpdate, db: DB, user: User):
    return boards.update_project_tag(db, user, tag_id, data)


@router.delete("/project-tags/{tag_id}", status_code=204)
def delete_project_tag(tag_id: UUID, db: DB, user: User):
    boards.delete_project_tag(db, user, tag_id)
    return Response(status_code=204)


@router.post("/projects", response_model=ProjectOut, status_code=201)
def create_project(data: ProjectCreate, db: DB, user: User):
    return boards.create_project(db, user, data)


@router.get("/projects/{project_id}", response_model=ProjectOut)
def get_project(project_id: UUID, db: DB, user: User):
    return owned_project(db, project_id, user)


@router.patch("/projects/{project_id}", response_model=ProjectOut)
def update_project(project_id: UUID, data: ProjectUpdate, db: DB, user: User):
    return boards.update_project(db, user, project_id, data)


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: UUID, db: DB, user: User):
    boards.delete_project(db, user, project_id)
    return Response(status_code=204)


@router.get("/projects/{project_id}/tasks", response_model=list[TaskOut])
def list_tasks(project_id: UUID, db: DB, user: User, archived: bool = False):
    owned_project(db, project_id, user)
    return project_tasks(db, project_id, archived)


@router.post("/projects/{project_id}/tasks", response_model=TaskOut, status_code=201)
def create_task(project_id: UUID, data: TaskCreate, db: DB, user: User):
    return boards.create_task(db, user, project_id, data)


@router.get("/tasks/{task_id}", response_model=TaskOut)
def get_task(task_id: UUID, db: DB, user: User):
    return owned_task(db, task_id, user)


@router.patch("/tasks/{task_id}", response_model=TaskOut)
def update_task(task_id: UUID, data: TaskUpdate, db: DB, user: User):
    return boards.update_task(db, user, task_id, data)


@router.post("/tasks/{task_id}/archive", response_model=TaskOut)
def archive_task(task_id: UUID, db: DB, user: User):
    return boards.archive_task(db, user, task_id)


@router.post("/tasks/{task_id}/restore", response_model=TaskOut)
def restore_task(task_id: UUID, db: DB, user: User):
    return boards.restore_task(db, user, task_id)


@router.post("/tasks/{task_id}/move", status_code=204)
def move_task(task_id: UUID, data: TaskMove, db: DB, user: User):
    boards.update_task(db, user, task_id, TaskUpdate(**data.model_dump()))
    return Response(status_code=204)


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: UUID, db: DB, user: User):
    boards.delete_task(db, user, task_id)
    return Response(status_code=204)
