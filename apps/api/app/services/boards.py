from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Project, Task, utcnow
from app.repositories.projects import owned_project, owned_task, project_tasks
from app.schemas import ProjectCreate, ProjectUpdate, TaskCreate, TaskUpdate
from app.services.tickets import project_ticket_prefix


def list_projects(db: Session, user: UUID, archived: bool):
    return list(
        db.scalars(
            select(Project)
            .where(Project.owner_id == user, Project.archived == archived)
            .order_by(Project.created_at, Project.id)
        )
    )


def list_project_tags(db: Session, user: UUID):
    tags = db.scalars(select(Project.tags).where(Project.owner_id == user)).all()
    unique: dict[str, str] = {}
    for project_tags in tags:
        for tag in project_tags:
            unique.setdefault(tag.casefold(), tag)
    return sorted(unique.values(), key=str.lower)


def create_project(db: Session, user: UUID, data: ProjectCreate):
    project = Project(
        owner_id=user,
        ticket_prefix=project_ticket_prefix(db, user, data.name),
        **data.model_dump(),
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def update_project(db: Session, user: UUID, project_id: UUID, data: ProjectUpdate):
    project = owned_project(db, project_id, user, lock=True)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(project, key, value)
    db.commit()
    db.refresh(project)
    return project


def delete_project(db: Session, user: UUID, project_id: UUID):
    db.delete(owned_project(db, project_id, user, lock=True))
    db.commit()


def writable_project(db: Session, project_id: UUID, user: UUID):
    project = owned_project(db, project_id, user, lock=True)
    if project.archived:
        raise HTTPException(409, "Restore the project before changing its tasks")
    return project


def normalize(tasks: list[Task]):
    for status in ("todo", "in_progress", "done"):
        for position, task in enumerate(t for t in tasks if t.status == status):
            task.position = position


def create_task(db: Session, user: UUID, project_id: UUID, data: TaskCreate):
    project = writable_project(db, project_id, user)
    tasks = project_tasks(db, project_id)
    task = Task(
        project_id=project_id,
        position=sum(t.status == data.status for t in tasks),
        ticket_number=project.next_ticket_number,
        ticket_id=f"{project.ticket_prefix}-{project.next_ticket_number}",
        **data.model_dump(),
    )
    project.next_ticket_number += 1
    db.add(task)
    project.updated_at = utcnow()
    db.commit()
    db.refresh(task)
    return task


def update_task(db: Session, user: UUID, task_id: UUID, data: TaskUpdate):
    task = owned_task(db, task_id, user)
    project = writable_project(db, task.project_id, user)
    # Refresh after acquiring the project lock so concurrent moves serialize correctly.
    task = owned_task(db, task_id, user)
    tasks = project_tasks(db, task.project_id)
    values = data.model_dump(exclude_unset=True)
    status = values.get("status", task.status)
    moving = "position" in values or status != task.status
    if moving:
        remaining = [t for t in tasks if t.id != task.id]
        target = [t for t in remaining if t.status == status]
        position = min(values.pop("position", len(target)), len(target))
        task.status = status
        target.insert(position, task)
        normalize([t for t in remaining if t.status != status] + target)
    for key, value in values.items():
        setattr(task, key, value)
    project.updated_at = utcnow()
    db.commit()
    db.refresh(task)
    return task


def delete_task(db: Session, user: UUID, task_id: UUID):
    task = owned_task(db, task_id, user)
    project = writable_project(db, task.project_id, user)
    tasks = project_tasks(db, task.project_id)
    db.delete(task)
    normalize([t for t in tasks if t.id != task_id])
    project.updated_at = utcnow()
    db.commit()
