from string import ascii_uppercase, digits
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Project


def project_ticket_prefix(db: Session, owner_id: UUID, name: str) -> str:
    """Choose a stable two-character prefix, preferring the project's name."""
    characters = [character for character in name.upper() if character in ascii_uppercase + digits]
    first = characters[0] if characters else "P"
    existing = set(db.scalars(select(Project.ticket_prefix).where(Project.owner_id == owner_id)))
    candidates: list[str] = []

    for character in characters[1:] + list(ascii_uppercase + digits):
        candidate = first + character
        if candidate not in candidates:
            candidates.append(candidate)

    for candidate in candidates:
        if candidate not in existing:
            return candidate
    raise HTTPException(status_code=409, detail="No ticket prefix is available")
