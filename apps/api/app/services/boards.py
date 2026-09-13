from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Project, ProjectTag, Task, utcnow
from app.repositories.projects import owned_project, owned_task, project_tasks
from app.schemas import (
    ProjectCreate,
    ProjectTagOrder,
    ProjectTagUpdate,
    ProjectUpdate,
    TaskCreate,
    TaskUpdate,
)
from app.services.tickets import project_ticket_prefix

NEW_PROJECT_NAME = "New Project"


def list_projects(db: Session, user: UUID, archived: bool):
    return list(
        db.scalars(
            select(Project)
            .where(Project.owner_id == user, Project.archived == archived)
            .order_by(Project.created_at, Project.id)
        )
    )


def list_project_tags(db: Session, user: UUID):
    return list(
        db.scalars(
            select(ProjectTag)
            .where(ProjectTag.owner_id == user)
            .order_by(ProjectTag.position, ProjectTag.id)
        )
    )


def sync_project_tags(db: Session, user: UUID, tags: list[str]):
    existing_tags = list(db.scalars(select(ProjectTag).where(ProjectTag.owner_id == user)))
    existing = {tag.normalized_name for tag in existing_tags}
    next_position = len(existing_tags)
    for name in tags:
        normalized = name.casefold()
        if normalized not in existing:
            db.add(
                ProjectTag(
                    owner_id=user, name=name, normalized_name=normalized, position=next_position
                )
            )
            existing.add(normalized)
            next_position += 1


def reorder_project_tags(db: Session, user: UUID, data: ProjectTagOrder):
    tags = list(
        db.scalars(
            select(ProjectTag)
            .where(ProjectTag.owner_id == user)
            .order_by(ProjectTag.position, ProjectTag.id)
            .with_for_update()
        )
    )
    tag_ids = data.tag_ids
    if len(tag_ids) != len(set(tag_ids)) or set(tag_ids) != {tag.id for tag in tags}:
        raise HTTPException(422, "Tag order must include every platform exactly once")
    tags_by_id = {tag.id: tag for tag in tags}
    ordered_tags = [tags_by_id[tag_id] for tag_id in tag_ids]
    for position, tag in enumerate(ordered_tags):
        tag.position = position
    db.commit()
    return ordered_tags


def create_project(db: Session, user: UUID, data: ProjectCreate):
    values = data.model_dump()
    if values["name"] == NEW_PROJECT_NAME:
        # O(n + k): scan existing names once, then find the first available suffix.
        existing_names = set(db.scalars(select(Project.name).where(Project.owner_id == user)))
        suffix = 0
        while values["name"] in existing_names:
            suffix += 1
            values["name"] = f"{NEW_PROJECT_NAME} ({suffix})"
    project = Project(
        owner_id=user,
        ticket_prefix=project_ticket_prefix(db, user, values["name"]),
        **values,
    )
    sync_project_tags(db, user, data.tags)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def update_project(db: Session, user: UUID, project_id: UUID, data: ProjectUpdate):
    project = owned_project(db, project_id, user, lock=True)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(project, key, value)
    if data.tags is not None:
        sync_project_tags(db, user, data.tags)
    db.commit()
    db.refresh(project)
    return project


def update_project_tag(db: Session, user: UUID, tag_id: UUID, data: ProjectTagUpdate):
    tag = db.scalar(select(ProjectTag).where(ProjectTag.id == tag_id, ProjectTag.owner_id == user))
    if not tag:
        raise HTTPException(404, "Tag not found")
    if data.name is not None:
        normalized_name = data.name.casefold()
        duplicate = db.scalar(
            select(ProjectTag).where(
                ProjectTag.owner_id == user,
                ProjectTag.normalized_name == normalized_name,
                ProjectTag.id != tag.id,
            )
        )
        if duplicate:
            raise HTTPException(409, "A platform with this name already exists")
        for project in db.scalars(select(Project).where(Project.owner_id == user)):
            renamed = [
                data.name if name.casefold() == tag.normalized_name else name
                for name in project.tags
            ]
            if renamed != project.tags:
                project.tags = renamed
                project.updated_at = utcnow()
        tag.name = data.name
        tag.normalized_name = normalized_name
    if data.color is not None:
        tag.color = data.color
    db.commit()
    db.refresh(tag)
    return tag


def delete_project_tag(db: Session, user: UUID, tag_id: UUID):
    tag = db.scalar(select(ProjectTag).where(ProjectTag.id == tag_id, ProjectTag.owner_id == user))
    if not tag:
        raise HTTPException(404, "Tag not found")
    for project in db.scalars(select(Project).where(Project.owner_id == user)):
        filtered = [name for name in project.tags if name.casefold() != tag.normalized_name]
        if len(filtered) != len(project.tags):
            project.tags = filtered
            project.updated_at = utcnow()
    db.delete(tag)
    remaining_tags = list(
        db.scalars(
            select(ProjectTag)
            .where(ProjectTag.owner_id == user, ProjectTag.id != tag_id)
            .order_by(ProjectTag.position, ProjectTag.id)
        )
    )
    for position, remaining_tag in enumerate(remaining_tags):
        remaining_tag.position = position
    db.commit()


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


def archive_task(db: Session, user: UUID, task_id: UUID):
    task = owned_task(db, task_id, user)
    project = writable_project(db, task.project_id, user)
    tasks = project_tasks(db, task.project_id)
    task.archived = True
    normalize([item for item in tasks if item.id != task.id])
    project.updated_at = utcnow()
    db.commit()
    db.refresh(task)
    return task


def restore_task(db: Session, user: UUID, task_id: UUID):
    task = owned_task(db, task_id, user)
    project = writable_project(db, task.project_id, user)
    tasks = project_tasks(db, task.project_id)
    task.archived = False
    task.position = sum(item.status == task.status for item in tasks)
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
