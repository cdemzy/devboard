from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

Status = Literal["todo", "in_progress", "done"]
Priority = Literal["low", "medium", "high"]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=240)]
Description = Annotated[str, StringConstraints(max_length=10000)]
Tag = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
TagColor = Literal["default", "gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Patch(Input):
    @model_validator(mode="after")
    def disallow_null(self):
        if any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError("Fields cannot be null")
        return self


class ProjectCreate(Input):
    name: Name
    description: Description = ""
    tags: list[Tag] = Field(default_factory=list, max_length=20)


class ProjectUpdate(Patch):
    name: Name | None = None
    description: Description | None = None
    archived: bool | None = None
    tags: list[Tag] | None = Field(default=None, max_length=20)


class ProjectOut(ProjectCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    owner_id: UUID
    ticket_prefix: str
    archived: bool
    created_at: datetime
    updated_at: datetime


class ProjectTagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    color: TagColor


class ProjectTagUpdate(Patch):
    color: TagColor | None = None


class TaskCreate(Input):
    title: Title
    description: Description = ""
    status: Status = "todo"
    priority: Priority = "medium"


class TaskUpdate(Patch):
    title: Title | None = None
    description: Description | None = None
    status: Status | None = None
    priority: Priority | None = None
    position: int | None = Field(default=None, ge=0, le=2147483647)


class TaskMove(Input):
    status: Status
    position: int = Field(ge=0, le=2147483647)


class TaskOut(TaskCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    position: int
    ticket_number: int
    ticket_id: str
    archived: bool
    created_at: datetime
    updated_at: datetime
