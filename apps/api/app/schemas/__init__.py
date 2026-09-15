from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

Status = Literal["todo", "in_progress", "done"]
Priority = Literal["low", "medium", "high"]
Complexity = Literal["easy", "standard", "hard"]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=240)]
Description = Annotated[str, StringConstraints(max_length=10000)]
ProjectDescription = Annotated[str, StringConstraints(max_length=90)]
Tag = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
TagColor = Literal["green", "yellow", "purple", "orange", "blue", "pink", "red", "brown"]


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
    description: ProjectDescription = ""
    tags: list[Tag] = Field(default_factory=list, max_length=20)


class ProjectUpdate(Patch):
    name: Name | None = None
    description: ProjectDescription | None = None
    archived: bool | None = None
    tags: list[Tag] | None = Field(default=None, max_length=20)
    new_tag_colors: dict[Tag, TagColor] | None = None


class ProjectOut(ProjectCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    owner_id: UUID
    ticket_prefix: str
    next_ticket_number: int
    archived: bool
    created_at: datetime
    updated_at: datetime


class ProjectTagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    color: TagColor
    position: int


class ProjectTagUpdate(Patch):
    name: Tag | None = None
    color: TagColor | None = None


class ProjectTagOrder(Input):
    tag_ids: list[UUID] = Field(max_length=20)


class TaskCreate(Input):
    title: Title
    description: Description = ""
    status: Status = "todo"
    priority: Priority = "medium"
    complexity: Complexity = "standard"


class TaskUpdate(Patch):
    title: Title | None = None
    description: Description | None = None
    status: Status | None = None
    priority: Priority | None = None
    complexity: Complexity | None = None
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
