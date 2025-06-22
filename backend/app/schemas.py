from datetime import datetime
from typing import Optional, List
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
    content_preview: Optional[str] = Field(None, description="First ~100 characters of content for preview")
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


# === Suggestion Schemas ===

class ParagraphToAnalyze(BaseModel):
    """Schema for a paragraph to be analyzed for suggestions."""
    paragraph_id: str = Field(..., description="UUID of the paragraph from frontend")
    text_content: str = Field(..., description="Text content of the paragraph")
    base_offset: int = Field(..., description="Starting character position in full document")


class ParagraphAnalysisRequest(BaseModel):
    """Schema for requesting analysis of paragraphs."""
    document_id: UUID = Field(..., description="ID of the document being analyzed")
    paragraphs: List[ParagraphToAnalyze] = Field(..., description="List of paragraphs to analyze")


class Suggestion(BaseModel):
    """Schema for a writing suggestion."""
    suggestion_id: str = Field(..., description="Unique identifier for this suggestion")
    rule_id: str = Field(..., description="Machine-readable rule identifier")
    category: str = Field(..., description="Category: spelling, grammar, or style")
    original_text: str = Field(..., description="Original text that needs improvement")
    suggestion_text: str = Field(..., description="Suggested replacement text")
    message: str = Field(..., description="Human-readable explanation")
    global_start: int = Field(..., description="Start position in full document")
    global_end: int = Field(..., description="End position in full document")
    dismissal_identifier: str = Field(..., description="Identifier for dismissal tracking")


class SuggestionAnalysisResponse(BaseModel):
    """Schema for suggestion analysis response."""
    suggestions: List[Suggestion] = Field(..., description="List of suggestions")
    total_paragraphs_processed: int = Field(..., description="Number of paragraphs processed")
    errors: List[str] = Field(default_factory=list, description="List of processing errors")


class DismissSuggestionRequest(BaseModel):
    """Schema for dismissing a suggestion."""
    document_id: UUID = Field(..., description="ID of the document")
    original_text: str = Field(..., description="Original text of the suggestion")
    rule_id: str = Field(..., description="Rule ID of the suggestion")


class DismissSuggestionResponse(BaseModel):
    """Schema for dismiss suggestion response."""
    success: bool = Field(..., description="Whether dismissal was successful")
    dismissal_identifier: str = Field(..., description="The dismissal identifier created")


class ClearDismissedResponse(BaseModel):
    """Schema for clear dismissed suggestions response."""
    success: bool = Field(..., description="Whether clearing was successful")
    cleared_count: int = Field(..., description="Number of dismissed suggestions cleared")
    message: str = Field(..., description="Success message")