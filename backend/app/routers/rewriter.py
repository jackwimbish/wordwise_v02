# /backend/app/routers/rewriter.py

import os
import asyncio
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import sentry_sdk
from openai import AsyncOpenAI
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..database import get_db_session
from ..auth import get_current_user_profile
from ..models import Profile, Document
from ..schemas import (
    LengthRewriteRequest,
    LengthRewriteResponse,
    RetryRewriteRequest,
    RetryRewriteResponse,
    ParagraphRewrite
)

# Initialize the rate limiter
limiter = Limiter(key_func=get_remote_address)

# Sentry SDK Compatibility Layer (reused from suggestions.py)
def set_span_attribute(span, key: str, value):
    """
    Compatibility function to set span attributes across different Sentry SDK versions.
    """
    if hasattr(span, 'set_attribute'):
        span.set_attribute(key, value)
    elif hasattr(span, 'set_tag'):
        span.set_tag(key, value)
    elif hasattr(span, 'set_data'):
        span.set_data(key, value)
    else:
        print(f"Warning: Unable to set span attribute {key}={value}, no compatible method found")

router = APIRouter(prefix="/rewrite", tags=["Length Rewriter"])

# OpenAI client configuration
openai_client = AsyncOpenAI(
    api_key=os.getenv("LLM_API_KEY"),
    timeout=15.0,  # Longer timeout for rewriting tasks
    max_retries=2
)

# Configuration constants
OPENAI_MODEL = "gpt-4.1-nano-2025-04-14"
MAX_PARAGRAPH_LENGTH = 5000  # Longer limit for rewriting
MIN_PARAGRAPH_LENGTH = 10    # Skip very short paragraphs


def count_words(text: str) -> int:
    """Count words in text."""
    return len(text.split())


def count_characters(text: str) -> int:
    """Count characters in text (normalized whitespace like frontend)."""
    # Normalize whitespace for character counting (same as PageCount component)
    clean_text = ' '.join(text.split())  # Replace all whitespace sequences with single spaces
    return len(clean_text)


def get_text_length(text: str, unit: str) -> int:
    """Get text length based on unit."""
    if unit.lower() == "words":
        return count_words(text)
    elif unit.lower() == "characters":
        return count_characters(text)
    else:
        raise ValueError(f"Invalid unit: {unit}. Must be 'words' or 'characters'")


def determine_mode(current_length: int, target_length: int) -> str:
    """Determine rewrite mode based on current vs target length."""
    if current_length > target_length:
        return "shorten"
    elif current_length < target_length:
        return "lengthen"
    else:  # current_length == target_length
        return "shorten"  # Default to shorten and process anyway


def validate_target_length(target_length: int, unit: str, text: str) -> None:
    """Validate target length and raise HTTPException if invalid."""
    # Basic validation for invalid values
    if target_length <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target length must be greater than 0"
        )
    
    # Set reasonable limits
    MAX_REASONABLE_LENGTH = {
        "words": 50000,      # ~100 page document
        "characters": 300000  # ~60,000 words worth
    }
    
    MIN_REASONABLE_LENGTH = {
        "words": 5,       # Need some content to work with
        "characters": 20   # Minimum viable sentence
    }
    
    if target_length > MAX_REASONABLE_LENGTH[unit.lower()]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Target length too large. Maximum is {MAX_REASONABLE_LENGTH[unit.lower()]} {unit}"
        )
    
    if target_length < MIN_REASONABLE_LENGTH[unit.lower()]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Target length too small. Minimum is {MIN_REASONABLE_LENGTH[unit.lower()]} {unit}"
        )
    
    # Validate text is not empty
    if not text or not text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please write some content before using length tools"
        )
    
    # Validate text is long enough to be meaningful
    current_length = get_text_length(text, unit)
    if current_length < MIN_REASONABLE_LENGTH[unit.lower()]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document too short to rewrite. Write at least {MIN_REASONABLE_LENGTH[unit.lower()]} {unit} first"
        )


def split_into_paragraphs(text: str) -> List[str]:
    """Split text into paragraphs, filtering out empty ones."""
    paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
    return paragraphs


def create_rewrite_prompt(paragraph: str, target_length: int, unit: str, mode: str) -> str:
    """Create a prompt for rewriting a paragraph."""
    current_length = get_text_length(paragraph, unit)
    
    if mode.lower() == "shorten":
        return f"""You are a precise text editor. Your task is to shorten the following paragraph. 

The original length is {current_length} {unit}. The target length is approximately {target_length} {unit}. 

Preserve the core meaning, tone, and key details. Do not add any new information or commentary. Focus on removing redundancy, simplifying complex sentences, and using more concise language.

Original Paragraph: "{paragraph}"

Return only the rewritten paragraph, no additional text or explanation."""
    
    elif mode.lower() == "lengthen":
        return f"""You are an eloquent text editor. Your task is to expand the following paragraph.

The original length is {current_length} {unit}. The target length is approximately {target_length} {unit}.

Elaborate on the existing points with more descriptive detail, examples, or clarification. Do not introduce new topics or change the core meaning. Add depth and richness while maintaining the original tone and style.

Original Paragraph: "{paragraph}"

Return only the rewritten paragraph, no additional text or explanation."""
    
    else:
        raise ValueError(f"Invalid mode: {mode}. Must be 'shorten' or 'lengthen'")


def create_retry_prompt(original: str, previous: str, target_length: int, unit: str, mode: str) -> str:
    """Create a prompt for retrying a paragraph rewrite with a different approach."""
    current_length = get_text_length(original, unit)
    action = "shorten" if mode.lower() == "shorten" else "expand"
    
    return f"""You are a skilled text editor. Rewrite the following paragraph to {action} it to approximately {target_length} {unit}.

The original length is {current_length} {unit}. Provide a new version that is substantially different from the previous suggestion while maintaining the same core meaning and tone.

Original Paragraph: "{original}"

Previous Suggestion (avoid this approach): "{previous}"

Create a fresh rewrite that takes a different stylistic or structural approach. Return only the rewritten paragraph, no additional text or explanation."""


async def rewrite_paragraph_with_llm(paragraph: str, target_length: int, unit: str, mode: str) -> str:
    """Rewrite a single paragraph using OpenAI."""
    try:
        with sentry_sdk.start_span(
            op="llm.rewrite_paragraph",
            description=f"Rewrite paragraph ({len(paragraph)} chars, {mode} to {target_length} {unit})"
        ) as span:
            set_span_attribute(span, "paragraph_length", len(paragraph))
            set_span_attribute(span, "target_length", target_length)
            set_span_attribute(span, "unit", unit)
            set_span_attribute(span, "mode", mode)
            
            prompt = create_rewrite_prompt(paragraph, target_length, unit, mode)
            
            response = await openai_client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,  # Some creativity but mostly consistent
                max_tokens=2000
            )
            
            rewritten = response.choices[0].message.content
            if not rewritten:
                set_span_attribute(span, "error", "Empty response from LLM")
                return paragraph  # Return original if no response
            
            rewritten = rewritten.strip()
            set_span_attribute(span, "rewritten_length", len(rewritten))
            return rewritten
            
    except Exception as e:
        sentry_sdk.capture_exception(e)
        return paragraph  # Return original paragraph on error


async def retry_paragraph_rewrite(original: str, previous: str, target_length: int, unit: str, mode: str) -> str:
    """Retry rewriting a paragraph with a different approach."""
    try:
        with sentry_sdk.start_span(
            op="llm.retry_rewrite",
            description=f"Retry paragraph rewrite ({len(original)} chars)"
        ) as span:
            set_span_attribute(span, "original_length", len(original))
            set_span_attribute(span, "target_length", target_length)
            set_span_attribute(span, "unit", unit)
            set_span_attribute(span, "mode", mode)
            
            prompt = create_retry_prompt(original, previous, target_length, unit, mode)
            
            response = await openai_client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[
                    {"role": "user", "content": prompt}
                ],
                temperature=0.5,  # Higher creativity for different approach
                max_tokens=2000
            )
            
            rewritten = response.choices[0].message.content
            if not rewritten:
                set_span_attribute(span, "error", "Empty response from LLM")
                return original  # Return original if no response
            
            rewritten = rewritten.strip()
            set_span_attribute(span, "rewritten_length", len(rewritten))
            return rewritten
            
    except Exception as e:
        sentry_sdk.capture_exception(e)
        return original  # Return original paragraph on error


def calculate_paragraph_target_length(
    paragraph: str, 
    original_doc_length: int, 
    target_doc_length: int, 
    unit: str
) -> int:
    """Calculate target length for a specific paragraph based on document-level target."""
    paragraph_length = get_text_length(paragraph, unit)
    
    # Calculate the proportion this paragraph represents in the original document
    proportion = paragraph_length / original_doc_length if original_doc_length > 0 else 0
    
    # Apply the same proportion to the target length
    target_paragraph_length = int(target_doc_length * proportion)
    
    # Ensure minimum reasonable length
    min_length = 5 if unit.lower() == "words" else 20
    return max(target_paragraph_length, min_length)


@router.post("/length", response_model=LengthRewriteResponse)
@limiter.limit("100/hour")
async def rewrite_for_length(
    request: Request,
    request_data: LengthRewriteRequest,
    current_profile: Profile = Depends(get_current_user_profile),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Rewrite document paragraphs to meet target length requirements.
    Rate limited to 100 requests per hour.
    """
    # Validate request parameters
    if request_data.unit.lower() not in ["words", "characters"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unit must be 'words' or 'characters'"
        )
    
    # Validate target length and text content
    validate_target_length(request_data.target_length, request_data.unit, request_data.full_text)
    
    # Verify document ownership
    result = await db.execute(
        select(Document).where(
            Document.id == request_data.document_id,
            Document.profile_id == current_profile.id
        )
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or access denied"
        )
    
    # Calculate current document length
    original_length = get_text_length(request_data.full_text, request_data.unit)
    target_length = request_data.target_length
    
    # Determine mode automatically if not provided
    mode = request_data.mode if request_data.mode else determine_mode(original_length, target_length)
    
    # Split into paragraphs
    paragraphs = split_into_paragraphs(request_data.full_text)
    
    if not paragraphs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No paragraphs found in document"
        )
    
    # Filter paragraphs that are too short or too long
    processable_paragraphs = []
    for i, paragraph in enumerate(paragraphs):
        if MIN_PARAGRAPH_LENGTH <= len(paragraph) <= MAX_PARAGRAPH_LENGTH:
            processable_paragraphs.append((i, paragraph))
    
    if not processable_paragraphs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No paragraphs suitable for rewriting found"
        )
    
    # Create rewrite tasks for concurrent processing
    async def rewrite_single_paragraph(paragraph_data):
        paragraph_id, paragraph_text = paragraph_data
        
        # Calculate target length for this specific paragraph
        paragraph_target = calculate_paragraph_target_length(
            paragraph_text, original_length, target_length, request_data.unit
        )
        
        rewritten_text = await rewrite_paragraph_with_llm(
            paragraph_text, paragraph_target, request_data.unit, mode
        )
        
        return ParagraphRewrite(
            paragraph_id=paragraph_id,
            original_text=paragraph_text,
            rewritten_text=rewritten_text,
            original_length=get_text_length(paragraph_text, request_data.unit),
            rewritten_length=get_text_length(rewritten_text, request_data.unit)
        )
    
    # Execute rewrites concurrently
    with sentry_sdk.start_span(
        op="rewrite.process_document",
        description=f"Process {len(processable_paragraphs)} paragraphs"
    ) as span:
        set_span_attribute(span, "document_id", str(request_data.document_id))
        set_span_attribute(span, "paragraph_count", len(processable_paragraphs))
        set_span_attribute(span, "original_length", original_length)
        set_span_attribute(span, "target_length", target_length)
        
        paragraph_rewrites = await asyncio.gather(
            *[rewrite_single_paragraph(p) for p in processable_paragraphs],
            return_exceptions=True
        )
    
    # Filter out any exceptions and convert to proper objects
    successful_rewrites = []
    for rewrite in paragraph_rewrites:
        if isinstance(rewrite, ParagraphRewrite):
            successful_rewrites.append(rewrite)
        else:
            # Log the exception but continue
            if isinstance(rewrite, Exception):
                sentry_sdk.capture_exception(rewrite)
    
    return LengthRewriteResponse(
        document_id=request_data.document_id,
        original_length=original_length,
        target_length=target_length,
        unit=request_data.unit,
        mode=mode,
        paragraph_rewrites=successful_rewrites,
        total_paragraphs=len(paragraphs)
    )


@router.post("/retry", response_model=RetryRewriteResponse)
@limiter.limit("200/hour")
async def retry_rewrite(
    request: Request,
    request_data: RetryRewriteRequest,
    current_profile: Profile = Depends(get_current_user_profile)
):
    """
    Retry rewriting a paragraph with a different approach.
    Rate limited to 200 requests per hour.
    """
    # Validate request parameters
    if request_data.unit.lower() not in ["words", "characters"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unit must be 'words' or 'characters'"
        )
    
    # Determine mode automatically if not provided
    current_length = get_text_length(request_data.original_paragraph, request_data.unit)
    mode = request_data.mode if request_data.mode else determine_mode(current_length, request_data.target_length)
    
    # Validate paragraph length
    if len(request_data.original_paragraph) > MAX_PARAGRAPH_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Paragraph too long (max {MAX_PARAGRAPH_LENGTH} characters)"
        )
    
    if len(request_data.original_paragraph) < MIN_PARAGRAPH_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Paragraph too short (min {MIN_PARAGRAPH_LENGTH} characters)"
        )
    
    # Perform the retry rewrite
    rewritten_text = await retry_paragraph_rewrite(
        request_data.original_paragraph,
        request_data.previous_suggestion,
        request_data.target_length,
        request_data.unit,
        mode
    )
    
    return RetryRewriteResponse(
        rewritten_text=rewritten_text,
        original_length=get_text_length(request_data.original_paragraph, request_data.unit),
        rewritten_length=get_text_length(rewritten_text, request_data.unit)
    ) 