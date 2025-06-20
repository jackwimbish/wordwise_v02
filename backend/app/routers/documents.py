# /backend/app/routers/documents.py

from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from ..database import get_db_session
from ..auth import get_current_user
from ..models import Document, Profile
from ..schemas import (
    DocumentCreate,
    DocumentUpdate,
    DocumentResponse,
    DocumentListItem,
    DocumentListResponse
)

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
    
    # Convert to list items
    document_items = [
        DocumentListItem(
            id=doc.id,
            title=doc.title,
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
    
    # Update fields that were provided
    update_data = document_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(document, field, value)
    
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