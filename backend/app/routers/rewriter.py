# /backend/app/routers/rewriter.py

import os
import asyncio
import re
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import sentry_sdk
from openai import AsyncOpenAI
from bs4 import BeautifulSoup

from ..database import get_db_session
from ..auth import get_current_user_profile, create_rate_limit_dependency
from ..models import Profile, Document
from ..schemas import (
    LengthRewriteRequest,
    LengthRewriteResponse,
    RetryRewriteRequest,
    RetryRewriteResponse,
    ParagraphRewrite
)

# Create rate limit dependencies for different endpoints
length_rewrite_rate_limit = create_rate_limit_dependency(300)  # 300 requests per hour for length rewriting
retry_rewrite_rate_limit = create_rate_limit_dependency(300)  # 300 requests per hour for retries

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


def validate_target_length(target_length: int, unit: str, content: str) -> None:
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
    
    # Validate content is not empty
    if not content or not content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please write some content before using length tools"
        )
    
    # Extract text from content (handle both HTML and plain text)
    text_content = extract_text_from_html(content) if ('<' in content and '>' in content) else content
    
    # Validate text is long enough to be meaningful
    current_length = get_text_length(text_content, unit)
    if current_length < MIN_REASONABLE_LENGTH[unit.lower()]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document too short to rewrite. Write at least {MIN_REASONABLE_LENGTH[unit.lower()]} {unit} first"
        )


def extract_text_from_html(html: str) -> str:
    """Extract plain text from HTML content."""
    soup = BeautifulSoup(html, 'html.parser')
    return soup.get_text()


def split_into_paragraphs(content: str) -> List[dict]:
    """
    Split content into paragraphs, preserving HTML structure.
    Returns list of dicts with 'html' and 'text' keys.
    """
    # Check if content is HTML (contains HTML tags)
    if '<' in content and '>' in content:
        # Parse HTML content
        soup = BeautifulSoup(content, 'html.parser')
        paragraphs = []
        
        # Extract all block-level elements that represent paragraphs
        for element in soup.find_all(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote']):
            html_content = str(element)
            text_content = element.get_text().strip()
            
            if text_content:  # Only include non-empty paragraphs
                paragraphs.append({
                    'html': html_content,
                    'text': text_content
                })
        
        # If no block elements found, treat the whole content as one paragraph
        if not paragraphs:
            text_content = soup.get_text().strip()
            if text_content:
                paragraphs.append({
                    'html': f'<p>{content}</p>',
                    'text': text_content
                })
        
        return paragraphs
    else:
        # Plain text content - split on double newlines
        text_paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]
        return [
            {
                'html': f'<p>{p}</p>',
                'text': p
            }
            for p in text_paragraphs
        ]


def create_rewrite_prompt(paragraph_html: str, paragraph_text: str, target_length: int, unit: str, mode: str) -> str:
    """Create a prompt for rewriting a paragraph while preserving HTML formatting."""
    current_length = get_text_length(paragraph_text, unit)
    
    base_instructions = f"""You are a precise text editor. Your task is to rewrite the following content while preserving all HTML formatting.

IMPORTANT: You must maintain the exact HTML structure and tags. Only change the text content within the tags.

The original length is {current_length} {unit}. The target length is approximately {target_length} {unit}."""
    
    if mode.lower() == "shorten":
        specific_instructions = """
Your goal is to shorten the content. Preserve the core meaning, tone, and key details. Do not add any new information or commentary. Focus on removing redundancy, simplifying complex sentences, and using more concise language."""
    
    elif mode.lower() == "lengthen":
        specific_instructions = """
Your goal is to expand the content. Elaborate on the existing points with more descriptive detail, examples, or clarification. Do not introduce new topics or change the core meaning. Add depth and richness while maintaining the original tone and style."""
    
    else:
        raise ValueError(f"Invalid mode: {mode}. Must be 'shorten' or 'lengthen'")
    
    return f"""{base_instructions}

{specific_instructions}

Original Content: {paragraph_html}

Return only the rewritten content with preserved HTML formatting, no additional text or explanation."""


def create_retry_prompt(original_html: str, original_text: str, previous: str, target_length: int, unit: str, mode: str) -> str:
    """Create a prompt for retrying a paragraph rewrite with a different approach."""
    current_length = get_text_length(original_text, unit)
    action = "shorten" if mode.lower() == "shorten" else "expand"
    
    return f"""You are a skilled text editor. Rewrite the following content to {action} it to approximately {target_length} {unit}.

IMPORTANT: You must maintain the exact HTML structure and tags. Only change the text content within the tags.

The original length is {current_length} {unit}. Provide a new version that is substantially different from the previous suggestion while maintaining the same core meaning and tone.

Original Content: {original_html}

Previous Suggestion (avoid this approach): "{previous}"

Create a fresh rewrite that takes a different stylistic or structural approach. Return only the rewritten content with preserved HTML formatting, no additional text or explanation."""


async def rewrite_paragraph_with_llm(paragraph_html: str, paragraph_text: str, target_length: int, unit: str, mode: str) -> str:
    """Rewrite a single paragraph using OpenAI while preserving HTML formatting."""
    try:
        with sentry_sdk.start_span(
            op="llm.rewrite_paragraph",
            description=f"Rewrite paragraph ({len(paragraph_text)} chars, {mode} to {target_length} {unit})"
        ) as span:
            set_span_attribute(span, "paragraph_length", len(paragraph_text))
            set_span_attribute(span, "target_length", target_length)
            set_span_attribute(span, "unit", unit)
            set_span_attribute(span, "mode", mode)
            
            prompt = create_rewrite_prompt(paragraph_html, paragraph_text, target_length, unit, mode)
            
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
                return paragraph_html  # Return original if no response
            
            rewritten = rewritten.strip()
            set_span_attribute(span, "rewritten_length", len(rewritten))
            return rewritten
            
    except Exception as e:
        sentry_sdk.capture_exception(e)
        return paragraph_html  # Return original paragraph on error


async def retry_paragraph_rewrite(original_html: str, original_text: str, previous: str, target_length: int, unit: str, mode: str) -> str:
    """Retry rewriting a paragraph with a different approach while preserving HTML formatting."""
    try:
        with sentry_sdk.start_span(
            op="llm.retry_rewrite",
            description=f"Retry paragraph rewrite ({len(original_text)} chars)"
        ) as span:
            set_span_attribute(span, "original_length", len(original_text))
            set_span_attribute(span, "target_length", target_length)
            set_span_attribute(span, "unit", unit)
            set_span_attribute(span, "mode", mode)
            
            prompt = create_retry_prompt(original_html, original_text, previous, target_length, unit, mode)
            
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
                return original_html  # Return original if no response
            
            rewritten = rewritten.strip()
            set_span_attribute(span, "rewritten_length", len(rewritten))
            return rewritten
            
    except Exception as e:
        sentry_sdk.capture_exception(e)
        return original_html  # Return original paragraph on error


def calculate_paragraph_target_length(
    paragraph_text: str, 
    original_doc_length: int, 
    target_doc_length: int, 
    unit: str
) -> int:
    """Calculate target length for a specific paragraph based on document-level target."""
    paragraph_length = get_text_length(paragraph_text, unit)
    
    # Calculate the proportion this paragraph represents in the original document
    proportion = paragraph_length / original_doc_length if original_doc_length > 0 else 0
    
    # Apply the same proportion to the target length
    target_paragraph_length = int(target_doc_length * proportion)
    
    # Ensure minimum reasonable length
    min_length = 5 if unit.lower() == "words" else 20
    return max(target_paragraph_length, min_length)


@router.post("/length", response_model=LengthRewriteResponse)
async def rewrite_for_length(
    request_data: LengthRewriteRequest,
    current_profile: Profile = Depends(length_rewrite_rate_limit),  # Use our custom rate limiter
    db: AsyncSession = Depends(get_db_session)
):
    """
    Rewrite document paragraphs to meet target length requirements.
    Rate limited to 300 requests per hour per user.
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
    
    # Extract text content for length calculation
    text_content = extract_text_from_html(request_data.full_text) if ('<' in request_data.full_text and '>' in request_data.full_text) else request_data.full_text
    
    # Calculate current document length
    original_length = get_text_length(text_content, request_data.unit)
    target_length = request_data.target_length
    
    # Determine mode automatically if not provided
    mode = request_data.mode if request_data.mode else determine_mode(original_length, target_length)
    
    # Split into paragraphs (returns list of dicts with 'html' and 'text' keys)
    paragraphs = split_into_paragraphs(request_data.full_text)
    
    if not paragraphs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No paragraphs found in document"
        )
    
    # Filter paragraphs that are too short or too long (check text length)
    processable_paragraphs = []
    for i, paragraph in enumerate(paragraphs):
        text_length = len(paragraph['text'])
        if MIN_PARAGRAPH_LENGTH <= text_length <= MAX_PARAGRAPH_LENGTH:
            processable_paragraphs.append((i, paragraph))
    
    if not processable_paragraphs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No paragraphs suitable for rewriting found"
        )
    
    # Create rewrite tasks for concurrent processing
    async def rewrite_single_paragraph(paragraph_data):
        paragraph_id, paragraph = paragraph_data
        paragraph_html = paragraph['html']
        paragraph_text = paragraph['text']
        
        # Calculate target length for this specific paragraph
        paragraph_target = calculate_paragraph_target_length(
            paragraph_text, original_length, target_length, request_data.unit
        )
        
        rewritten_html = await rewrite_paragraph_with_llm(
            paragraph_html, paragraph_text, paragraph_target, request_data.unit, mode
        )
        
        # Extract text from rewritten HTML for length calculation
        rewritten_text = extract_text_from_html(rewritten_html) if ('<' in rewritten_html and '>' in rewritten_html) else rewritten_html
        
        return ParagraphRewrite(
            paragraph_id=paragraph_id,
            original_text=paragraph_html,  # Store HTML to preserve formatting
            rewritten_text=rewritten_html,  # Store HTML to preserve formatting
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
async def retry_rewrite(
    request_data: RetryRewriteRequest,
    current_profile: Profile = Depends(retry_rewrite_rate_limit)  # Use our custom rate limiter
):
    """
    Retry rewriting a paragraph with a different approach.
    Rate limited to 300 requests per hour per user.
    """
    # Validate request parameters
    if request_data.unit.lower() not in ["words", "characters"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unit must be 'words' or 'characters'"
        )
    
    # Extract text content from HTML if needed
    original_text = extract_text_from_html(request_data.original_paragraph) if ('<' in request_data.original_paragraph and '>' in request_data.original_paragraph) else request_data.original_paragraph
    
    # Determine mode automatically if not provided
    current_length = get_text_length(original_text, request_data.unit)
    mode = request_data.mode if request_data.mode else determine_mode(current_length, request_data.target_length)
    
    # Validate paragraph length (check text content)
    if len(original_text) > MAX_PARAGRAPH_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Paragraph too long (max {MAX_PARAGRAPH_LENGTH} characters)"
        )
    
    if len(original_text) < MIN_PARAGRAPH_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Paragraph too short (min {MIN_PARAGRAPH_LENGTH} characters)"
        )
    
    # Perform the retry rewrite (pass both HTML and text)
    rewritten_html = await retry_paragraph_rewrite(
        request_data.original_paragraph,  # HTML version
        original_text,  # Text version
        request_data.previous_suggestion,
        request_data.target_length,
        request_data.unit,
        mode
    )
    
    # Extract text from rewritten HTML for length calculation
    rewritten_text = extract_text_from_html(rewritten_html) if ('<' in rewritten_html and '>' in rewritten_html) else rewritten_html
    
    return RetryRewriteResponse(
        rewritten_text=rewritten_html,  # Return HTML to preserve formatting
        original_length=get_text_length(original_text, request_data.unit),
        rewritten_length=get_text_length(rewritten_text, request_data.unit)
    ) 