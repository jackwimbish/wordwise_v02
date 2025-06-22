# /backend/app/routers/documents.py

from typing import List
from uuid import UUID
import re
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from ..database import get_db_session
from ..auth import get_current_user
from ..models import Document, Profile, DocumentVersion
from ..schemas import (
    DocumentCreate,
    DocumentUpdate,
    DocumentResponse,
    DocumentListItem,
    DocumentListResponse,
    DocumentVersionResponse,
    DocumentVersionListResponse,
    RestoreVersionRequest,
    RestoreVersionResponse
)


def create_content_preview(content: str, max_length: int = 100) -> str:
    """
    Create a preview of the document content by taking the first sentence or ~100 characters.
    Strips HTML tags and cleans up whitespace.
    """
    if not content:
        return ""
    
    # Remove HTML tags (TipTap editor content might contain HTML)
    clean_content = re.sub(r'<[^>]+>', '', content)
    
    # Clean up multiple whitespaces and newlines
    clean_content = re.sub(r'\s+', ' ', clean_content).strip()
    
    if len(clean_content) <= max_length:
        return clean_content
    
    # Try to find the first sentence boundary within the limit
    sentence_end_match = re.search(r'[.!?]\s+', clean_content[:max_length + 20])
    if sentence_end_match and sentence_end_match.start() < max_length:
        return clean_content[:sentence_end_match.start() + 1]
    
    # If no sentence boundary found, truncate at word boundary
    truncated = clean_content[:max_length]
    last_space = truncated.rfind(' ')
    if last_space > max_length * 0.8:  # If we can find a space reasonably close to the end
        return truncated[:last_space] + "..."
    
    return truncated + "..."

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("/", response_model=DocumentListResponse)
async def list_documents(
    current_user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Get all documents for the authenticated user.
    Returns a list with minimal document information for performance.
    """
    # Get documents for the current user
    result = await db.execute(
        select(Document)
        .where(Document.profile_id == current_user_id)
        .order_by(Document.updated_at.desc())
    )
    documents = result.scalars().all()
    
    # Convert to list items with content preview
    document_items = [
        DocumentListItem(
            id=doc.id,
            title=doc.title,
            content_preview=create_content_preview(doc.content or ""),
            created_at=doc.created_at,
            updated_at=doc.updated_at
        )
        for doc in documents
    ]
    
    return DocumentListResponse(
        documents=document_items,
        total=len(document_items)
    )


@router.post("/", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def create_document(
    document_data: DocumentCreate,
    current_user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Create a new document for the authenticated user.
    """
    # Create new document
    new_document = Document(
        profile_id=current_user_id,
        title=document_data.title,
        content=document_data.content
    )
    
    db.add(new_document)
    await db.commit()
    await db.refresh(new_document)
    
    return DocumentResponse.model_validate(new_document)


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: UUID,
    current_user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Get a specific document by ID.
    Only returns documents owned by the authenticated user.
    """
    result = await db.execute(
        select(Document)
        .where(
            Document.id == document_id,
            Document.profile_id == current_user_id
        )
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    return DocumentResponse.model_validate(document)


@router.put("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: UUID,
    document_data: DocumentUpdate,
    current_user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Update a specific document by ID.
    Only allows updating documents owned by the authenticated user.
    Automatically creates a version history entry before updating.
    """
    # Get the document
    result = await db.execute(
        select(Document)
        .where(
            Document.id == document_id,
            Document.profile_id == current_user_id
        )
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Archive the current version before updating
    if document.content is not None:  # Only create version if there's existing content
        version = DocumentVersion(
            document_id=document.id,
            content=document.content
        )
        db.add(version)
    
    # Update fields that were provided
    update_data = document_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(document, field, value)
    
    # Commit both the version and the document update atomically
    await db.commit()
    await db.refresh(document)
    
    return DocumentResponse.model_validate(document)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: UUID,
    current_user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Delete a specific document by ID.
    Only allows deleting documents owned by the authenticated user.
    """
    # Get the document
    result = await db.execute(
        select(Document)
        .where(
            Document.id == document_id,
            Document.profile_id == current_user_id
        )
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    await db.delete(document)
    await db.commit()
    
    # Return 204 No Content (no response body for successful deletion)


# === Version History Endpoints ===

@router.get("/{document_id}/versions", response_model=DocumentVersionListResponse)
async def list_document_versions(
    document_id: UUID,
    current_user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Get all versions of a specific document.
    Only returns versions for documents owned by the authenticated user.
    """
    # First verify the user owns this document
    document_result = await db.execute(
        select(Document.id)
        .where(
            Document.id == document_id,
            Document.profile_id == current_user_id
        )
    )
    document = document_result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Get all versions for this document
    versions_result = await db.execute(
        select(DocumentVersion)
        .where(DocumentVersion.document_id == document_id)
        .order_by(DocumentVersion.saved_at.desc())
    )
    versions = versions_result.scalars().all()
    
    # Convert to response format
    version_responses = [
        DocumentVersionResponse.model_validate(version)
        for version in versions
    ]
    
    return DocumentVersionListResponse(
        versions=version_responses,
        total=len(version_responses)
    )


@router.get("/{document_id}/versions/{version_id}", response_model=DocumentVersionResponse)
async def get_document_version(
    document_id: UUID,
    version_id: UUID,
    current_user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Get a specific version of a document.
    Only returns versions for documents owned by the authenticated user.
    """
    # First verify the user owns this document
    document_result = await db.execute(
        select(Document.id)
        .where(
            Document.id == document_id,
            Document.profile_id == current_user_id
        )
    )
    document = document_result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Get the specific version
    version_result = await db.execute(
        select(DocumentVersion)
        .where(
            DocumentVersion.id == version_id,
            DocumentVersion.document_id == document_id
        )
    )
    version = version_result.scalar_one_or_none()
    
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Version not found"
        )
    
    return DocumentVersionResponse.model_validate(version)


@router.post("/{document_id}/versions/{version_id}/restore", response_model=RestoreVersionResponse)
async def restore_document_version(
    document_id: UUID,
    version_id: UUID,
    current_user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Restore a document to a specific version.
    This creates a new version with the current content before restoring.
    """
    # First verify the user owns this document
    document_result = await db.execute(
        select(Document)
        .where(
            Document.id == document_id,
            Document.profile_id == current_user_id
        )
    )
    document = document_result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Get the version to restore
    version_result = await db.execute(
        select(DocumentVersion)
        .where(
            DocumentVersion.id == version_id,
            DocumentVersion.document_id == document_id
        )
    )
    version = version_result.scalar_one_or_none()
    
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Version not found"
        )
    
    # Create a version with the current content before restoring
    if document.content is not None:
        current_version = DocumentVersion(
            document_id=document.id,
            content=document.content
        )
        db.add(current_version)
    
    # Restore the document to the version content
    document.content = version.content
    
    # Commit both operations atomically
    await db.commit()
    await db.refresh(document)
    
    return RestoreVersionResponse(
        success=True,
        message=f"Document restored to version from {version.saved_at}",
        document=DocumentResponse.model_validate(document)
    ) 