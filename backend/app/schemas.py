from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


class DocumentBase(BaseModel):
    """Base schema for document data."""
    title: Optional[str] = Field(None, max_length=255, description="Document title")
    content: Optional[str] = Field(None, description="Document content")


class DocumentCreate(DocumentBase):
    """Schema for creating a new document."""
    title: str = Field("Untitled Document", max_length=255, description="Document title")
    content: str = Field("", description="Document content")


class DocumentUpdate(DocumentBase):
    """Schema for updating an existing document."""
    # All fields are optional for updates
    pass


class DocumentResponse(DocumentBase):
    """Schema for returning document data."""
    id: UUID
    profile_id: UUID
    title: str
    content: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DocumentListItem(BaseModel):
    """Schema for listing documents (minimal fields for performance)."""
    id: UUID
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    """Schema for document list response."""
    documents: list[DocumentListItem]
    total: int


class ProfileResponse(BaseModel):
    """Schema for returning profile data."""
    id: UUID
    display_name: Optional[str]
    email: str
    created_at: datetime

    class Config:
        from_attributes = True 