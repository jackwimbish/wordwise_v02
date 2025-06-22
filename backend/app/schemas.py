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


# === Length Rewriter Schemas ===

class LengthRewriteRequest(BaseModel):
    """Schema for requesting document length rewriting."""
    document_id: UUID = Field(..., description="ID of the document to rewrite")
    full_text: str = Field(..., description="The entire document content")
    target_length: int = Field(..., gt=0, description="Target length (must be positive)")
    unit: str = Field(..., description="Unit of measurement: 'words' or 'characters'")
    mode: Optional[str] = Field(None, description="Rewrite mode: 'shorten' or 'lengthen' (auto-determined if not provided)")

    model_config = {
        "json_schema_extra": {
            "examples": [{
                "document_id": "550e8400-e29b-41d4-a716-446655440000",
                "full_text": "This is a sample document with multiple paragraphs. Each paragraph will be analyzed for potential rewriting.",
                "target_length": 500,
                "unit": "words",
                "mode": "shorten"
            }]
        }
    }


class ParagraphRewrite(BaseModel):
    """Schema for a single paragraph rewrite suggestion."""
    paragraph_id: int = Field(..., description="Index of the paragraph in the document")
    original_text: str = Field(..., description="Original paragraph text")
    rewritten_text: str = Field(..., description="AI-rewritten paragraph text")
    original_length: int = Field(..., description="Length of original text")
    rewritten_length: int = Field(..., description="Length of rewritten text")


class LengthRewriteResponse(BaseModel):
    """Schema for length rewrite response."""
    document_id: UUID = Field(..., description="ID of the document")
    original_length: int = Field(..., description="Original document length")
    target_length: int = Field(..., description="Target length requested")
    unit: str = Field(..., description="Unit of measurement used")
    mode: str = Field(..., description="Rewrite mode used")
    paragraph_rewrites: List[ParagraphRewrite] = Field(..., description="List of paragraph rewrites")
    total_paragraphs: int = Field(..., description="Total number of paragraphs processed")

    model_config = {
        "json_schema_extra": {
            "examples": [{
                "document_id": "550e8400-e29b-41d4-a716-446655440000",
                "original_length": 850,
                "target_length": 500,
                "unit": "words",
                "mode": "shorten",
                "paragraph_rewrites": [
                    {
                        "paragraph_id": 0,
                        "original_text": "This is the first paragraph with many words...",
                        "rewritten_text": "This is the concise first paragraph...",
                        "original_length": 45,
                        "rewritten_length": 32
                    }
                ],
                "total_paragraphs": 3
            }]
        }
    }


class RetryRewriteRequest(BaseModel):
    """Schema for retrying a paragraph rewrite."""
    original_paragraph: str = Field(..., description="The original paragraph text")
    previous_suggestion: str = Field(..., description="The previous rewrite suggestion to avoid")
    target_length: int = Field(..., gt=0, description="Target length for the paragraph")
    unit: str = Field(..., description="Unit of measurement: 'words' or 'characters'")
    mode: Optional[str] = Field(None, description="Rewrite mode: 'shorten' or 'lengthen' (auto-determined if not provided)")

    model_config = {
        "json_schema_extra": {
            "examples": [{
                "original_paragraph": "This is a paragraph that needs to be rewritten with different approach.",
                "previous_suggestion": "This paragraph needs rewriting differently.",
                "target_length": 60,
                "unit": "words",
                "mode": "shorten"
            }]
        }
    }


class RetryRewriteResponse(BaseModel):
    """Schema for retry rewrite response."""
    rewritten_text: str = Field(..., description="New rewritten version of the paragraph")
    original_length: int = Field(..., description="Length of original text")
    rewritten_length: int = Field(..., description="Length of new rewritten text")

    model_config = {
        "json_schema_extra": {
            "examples": [{
                "rewritten_text": "This paragraph has been rewritten with a fresh approach.",
                "original_length": 85,
                "rewritten_length": 58
            }]
        }
    }


# === Document Version History Schemas ===

class DocumentVersionResponse(BaseModel):
    """Schema for returning document version data."""
    id: UUID
    document_id: UUID
    content: str
    saved_at: datetime

    class Config:
        from_attributes = True


class DocumentVersionListResponse(BaseModel):
    """Schema for document version list response."""
    versions: List[DocumentVersionResponse]
    total: int


class RestoreVersionRequest(BaseModel):
    """Schema for restoring a document version."""
    version_id: UUID = Field(..., description="ID of the version to restore")


class RestoreVersionResponse(BaseModel):
    """Schema for restore version response."""
    success: bool = Field(..., description="Whether restore was successful")
    message: str = Field(..., description="Success or error message")
    document: DocumentResponse = Field(..., description="Updated document data")