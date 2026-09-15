from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Project, Task


def owned_project(db: Session, project_id: UUID, user_id: UUID, *, lock=False) -> Project:
    query = select(Project).where(Project.id == project_id, Project.owner_id == user_id)
    if lock:
        query = query.with_for_update()
    project = db.scalar(query)
    if project is None:
        raise HTTPException(404, "Project not found")
    return project


def owned_task(db: Session, task_id: UUID, user_id: UUID) -> Task:
    task = db.scalar(
        select(Task)
        .join(Project)
        .where(Task.id == task_id, Project.owner_id == user_id)
        .execution_options(populate_existing=True)
    )
    if task is None:
        raise HTTPException(404, "Task not found")
    return task


def project_tasks(db: Session, project_id: UUID, archived: bool = False) -> list[Task]:
    return list(
        db.scalars(
            select(Task)
            .where(Task.project_id == project_id, Task.archived == archived)
            .order_by(Task.status, Task.position, Task.created_at, Task.id)
        )
    )
