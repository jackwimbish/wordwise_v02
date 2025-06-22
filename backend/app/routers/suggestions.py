import os
import uuid
import asyncio
import json
from typing import List, Dict, Set, Tuple
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
import sentry_sdk
from openai import AsyncOpenAI

from ..database import get_db_session
from ..auth import get_current_user_profile, create_rate_limit_dependency
from ..models import Profile, Document, DismissedSuggestion
from ..schemas import (
    ParagraphAnalysisRequest,
    SuggestionAnalysisResponse,
    DismissSuggestionRequest,
    DismissSuggestionResponse,
    ClearDismissedResponse,
    Suggestion
)

# Create rate limit dependencies for different endpoints
suggestions_rate_limit = create_rate_limit_dependency(300)  # 300 requests per hour for suggestions

# Sentry SDK Compatibility Layer
def set_span_attribute(span, key: str, value):
    """
    Compatibility function to set span attributes across different Sentry SDK versions.
    
    Newer versions (OpenTelemetry-compatible): span.set_attribute(key, value)
    Older versions: span.set_tag(key, value) or span.set_data(key, value)
    """
    # Try the newer OpenTelemetry-compatible method first
    if hasattr(span, 'set_attribute'):
        span.set_attribute(key, value)
    # Fallback to older Sentry SDK methods
    elif hasattr(span, 'set_tag'):
        span.set_tag(key, value)
    elif hasattr(span, 'set_data'):
        span.set_data(key, value)
    # Final fallback - just log for debugging
    else:
        print(f"Warning: Unable to set span attribute {key}={value}, no compatible method found")

router = APIRouter(prefix="/suggestions", tags=["Suggestions"])

# OpenAI client configuration
openai_client = AsyncOpenAI(
    api_key=os.getenv("LLM_API_KEY"),
    timeout=10.0,
    max_retries=2
)

# Configuration constants
MAX_PARAGRAPHS_PER_REQUEST = 10
MAX_PARAGRAPH_LENGTH = 2000
OPENAI_MODEL = "gpt-4.1-nano-2025-04-14"

# System prompt for the LLM
SYSTEM_PROMPT = """You are an expert writing assistant that analyzes text for spelling, grammar, and style improvements. 

For each piece of text, identify specific issues and provide suggestions. Return your response as a JSON array where each suggestion object has these exact fields:

{
    "rule_id": "category:specific_rule_name",
    "category": "spelling|grammar|style", 
    "original_text": "exact text that needs changing",
    "suggestion_text": "replacement text",
    "message": "clear explanation of the issue"
}

Rules:
- rule_id format: "category:specific_rule" (e.g., "grammar:subject_verb_agreement", "spelling:misspelled_word", "style:passive_voice")
- original_text must be the EXACT text from the input that needs changing (case-sensitive, including punctuation)
- Only suggest changes that genuinely improve the text
- Focus on clear, actionable improvements
- Return empty array [] if no suggestions are needed

Example response:
[
    {
        "rule_id": "grammar:its_vs_its",
        "category": "grammar",
        "original_text": "Its",
        "suggestion_text": "It's",
        "message": "Use 'It's' (contraction) instead of 'Its' (possessive) here"
    }
]"""


async def get_dismissed_suggestions(
    db: AsyncSession, 
    profile_id: uuid.UUID, 
    document_id: uuid.UUID
) -> Set[str]:
    """Fetch all dismissed suggestion identifiers for a user's document."""
    result = await db.execute(
        select(DismissedSuggestion.dismissal_identifier)
        .where(
            DismissedSuggestion.profile_id == profile_id,
            DismissedSuggestion.document_id == document_id
        )
    )
    return set(row[0] for row in result.fetchall())


async def analyze_paragraph_with_llm(paragraph_text: str) -> List[Dict]:
    """Analyze a single paragraph with OpenAI and return suggestions."""
    try:
        with sentry_sdk.start_span(
            op="llm.openai_request",
            description=f"Analyze paragraph ({len(paragraph_text)} chars)"
        ) as span:
            set_span_attribute(span, "paragraph_length", len(paragraph_text))
            
            response = await openai_client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": paragraph_text}
                ],
                temperature=0.1,
                max_tokens=1000
            )
            
            content = response.choices[0].message.content
            set_span_attribute(span, "response_length", len(content) if content else 0)
            
            # Parse JSON response
            try:
                suggestions = json.loads(content) if content else []
                set_span_attribute(span, "suggestions_count", len(suggestions))
                return suggestions
            except json.JSONDecodeError as e:
                sentry_sdk.capture_exception(e)
                set_span_attribute(span, "json_parse_error", str(e))
                return []
                
    except Exception as e:
        sentry_sdk.capture_exception(e)
        return []


def create_dismissal_identifier(original_text: str, rule_id: str) -> str:
    """Create a stable identifier for suggestion dismissal."""
    return f"{original_text}|{rule_id}"


def find_text_positions(paragraph_text: str, original_text: str) -> List[Tuple[int, int]]:
    """
    Find all occurrences of original_text in paragraph_text and return their positions.
    Returns a list of (start, end) tuples.
    """
    positions = []
    start = 0
    
    while True:
        pos = paragraph_text.find(original_text, start)
        if pos == -1:
            break
        positions.append((pos, pos + len(original_text)))
        start = pos + 1  # Move past this occurrence to find overlapping matches
    
    return positions


def select_best_position(positions: List[Tuple[int, int]], used_positions: set) -> Tuple[int, int] | None:
    """
    Select the best position from available positions, avoiding already used positions.
    Returns the first unused position, or None if all are used.
    """
    for start, end in positions:
        # Check if this position overlaps with any used position
        is_overlapping = any(
            not (end <= used_start or start >= used_end)
            for used_start, used_end in used_positions
        )
        if not is_overlapping:
            return (start, end)
    
    return None


@router.post("/analyze", response_model=SuggestionAnalysisResponse)
async def analyze_paragraphs(
    request_data: ParagraphAnalysisRequest,
    current_profile: Profile = Depends(suggestions_rate_limit),  # Use our custom rate limiter
    db: AsyncSession = Depends(get_db_session)
):
    """
    Analyze paragraphs for spelling, grammar, and style suggestions.
    Rate limited to 300 requests per hour per user.
    """
    # Validate request limits
    if len(request_data.paragraphs) > MAX_PARAGRAPHS_PER_REQUEST:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Too many paragraphs. Maximum {MAX_PARAGRAPHS_PER_REQUEST} allowed."
        )
    
    # Validate paragraph lengths
    for paragraph in request_data.paragraphs:
        if len(paragraph.text_content) > MAX_PARAGRAPH_LENGTH:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Paragraph too long. Maximum {MAX_PARAGRAPH_LENGTH} characters allowed."
            )
    
    # Verify document ownership
    document_result = await db.execute(
        select(Document).where(
            Document.id == request_data.document_id,
            Document.profile_id == current_profile.id
        )
    )
    document = document_result.scalar_one_or_none()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or access denied"
        )
    
    with sentry_sdk.start_span(
        op="suggestions.analyze_paragraphs",
        description=f"Analyze {len(request_data.paragraphs)} paragraphs"
    ) as span:
        set_span_attribute(span, "document_id", str(request_data.document_id))
        set_span_attribute(span, "paragraphs_count", len(request_data.paragraphs))
        
        # Get dismissed suggestions for filtering
        dismissed_identifiers = await get_dismissed_suggestions(
            db, current_profile.id, request_data.document_id
        )
        set_span_attribute(span, "dismissed_count", len(dismissed_identifiers))
        
        # Process paragraphs concurrently
        tasks = []
        for paragraph in request_data.paragraphs:
            if paragraph.text_content.strip():  # Skip empty paragraphs
                tasks.append(analyze_paragraph_with_llm(paragraph.text_content))
        
        # Execute all LLM requests concurrently
        llm_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results and create suggestions
        all_suggestions = []
        errors = []
        processed_count = 0
        
        non_empty_paragraphs = [p for p in request_data.paragraphs if p.text_content.strip()]
        
        for i, (paragraph, llm_result) in enumerate(zip(non_empty_paragraphs, llm_results)):
            processed_count += 1
            
            if isinstance(llm_result, Exception):
                errors.append(f"Failed to analyze paragraph {paragraph.paragraph_id}: {str(llm_result)}")
                continue
            
            # Track used positions within this paragraph to avoid overlaps
            used_positions = set()
            
            # Convert LLM suggestions to our format
            for suggestion_data in llm_result:
                try:
                    # Validate required fields
                    required_fields = ["rule_id", "category", "original_text", "suggestion_text", "message"]
                    missing_fields = [field for field in required_fields if field not in suggestion_data]
                    if missing_fields:
                        errors.append(f"Missing fields {missing_fields} in suggestion for paragraph {paragraph.paragraph_id}")
                        continue
                    
                    # Find all possible positions for this text
                    positions = find_text_positions(paragraph.text_content, suggestion_data["original_text"])
                    
                    if not positions:
                        # This can happen when LLM suggests text that doesn't exactly match paragraph content
                        # This is normal and not a user-facing error
                        print(f"DEBUG: Could not find text '{suggestion_data['original_text']}' in paragraph {paragraph.paragraph_id}")
                        continue
                    
                    # Select the best available position
                    selected_position = select_best_position(positions, used_positions)
                    
                    if not selected_position:
                        # This is a normal occurrence when multiple suggestions target the same text
                        # Log it for debugging but don't show it to the user as an error
                        print(f"DEBUG: All positions for text '{suggestion_data['original_text']}' are already used in paragraph {paragraph.paragraph_id}")
                        continue
                    
                    relative_start, relative_end = selected_position
                    used_positions.add(selected_position)
                    
                    # Calculate global positions
                    global_start = paragraph.base_offset + relative_start
                    global_end = paragraph.base_offset + relative_end
                    
                    # Create dismissal identifier
                    dismissal_id = create_dismissal_identifier(
                        suggestion_data["original_text"],
                        suggestion_data["rule_id"]
                    )
                    
                    # Skip if this suggestion was dismissed
                    if dismissal_id in dismissed_identifiers:
                        continue
                    
                    suggestion = Suggestion(
                        suggestion_id=str(uuid.uuid4()),
                        rule_id=suggestion_data["rule_id"],
                        category=suggestion_data["category"],
                        original_text=suggestion_data["original_text"],
                        suggestion_text=suggestion_data["suggestion_text"],
                        message=suggestion_data["message"],
                        global_start=global_start,
                        global_end=global_end,
                        dismissal_identifier=dismissal_id
                    )
                    all_suggestions.append(suggestion)
                    
                except (KeyError, ValueError) as e:
                    errors.append(f"Invalid suggestion format in paragraph {paragraph.paragraph_id}: {str(e)}")
        
        set_span_attribute(span, "suggestions_generated", len(all_suggestions))
        set_span_attribute(span, "errors_count", len(errors))
        
        return SuggestionAnalysisResponse(
            suggestions=all_suggestions,
            total_paragraphs_processed=processed_count,
            errors=errors
        )


@router.post("/dismiss", response_model=DismissSuggestionResponse)
async def dismiss_suggestion(
    request: DismissSuggestionRequest,
    current_profile: Profile = Depends(get_current_user_profile),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Dismiss a specific suggestion so it won't appear again.
    """
    # Verify document ownership
    document_result = await db.execute(
        select(Document).where(
            Document.id == request.document_id,
            Document.profile_id == current_profile.id
        )
    )
    document = document_result.scalar_one_or_none()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or access denied"
        )
    
    # Create dismissal identifier
    dismissal_identifier = create_dismissal_identifier(
        request.original_text,
        request.rule_id
    )
    
    with sentry_sdk.start_span(
        op="suggestions.dismiss_suggestion",
        description="Dismiss suggestion"
    ) as span:
        set_span_attribute(span, "document_id", str(request.document_id))
        set_span_attribute(span, "rule_id", request.rule_id)
        
        # Create dismissal record
        dismissal = DismissedSuggestion(
            profile_id=current_profile.id,
            document_id=request.document_id,
            dismissal_identifier=dismissal_identifier
        )
        
        try:
            db.add(dismissal)
            await db.commit()
            
            return DismissSuggestionResponse(
                success=True,
                dismissal_identifier=dismissal_identifier
            )
            
        except Exception as e:
            await db.rollback()
            # This might be a duplicate dismissal, which is fine
            if "unique constraint" in str(e).lower():
                return DismissSuggestionResponse(
                    success=True,
                    dismissal_identifier=dismissal_identifier
                )
            else:
                sentry_sdk.capture_exception(e)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to dismiss suggestion"
                )


@router.delete("/dismissed/{document_id}", response_model=ClearDismissedResponse)
async def clear_dismissed_suggestions(
    document_id: uuid.UUID,
    current_profile: Profile = Depends(get_current_user_profile),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Clear all dismissed suggestions for a document, allowing them to appear again.
    """
    # Verify document ownership
    document_result = await db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.profile_id == current_profile.id
        )
    )
    document = document_result.scalar_one_or_none()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or access denied"
        )
    
    with sentry_sdk.start_span(
        op="suggestions.clear_dismissed",
        description="Clear dismissed suggestions"
    ) as span:
        set_span_attribute(span, "document_id", str(document_id))
        
        try:
            # Count dismissed suggestions before deletion
            count_result = await db.execute(
                select(func.count(DismissedSuggestion.id)).where(
                    DismissedSuggestion.profile_id == current_profile.id,
                    DismissedSuggestion.document_id == document_id
                )
            )
            cleared_count = count_result.scalar() or 0
            
            # Delete all dismissed suggestions for this document
            await db.execute(
                delete(DismissedSuggestion).where(
                    DismissedSuggestion.profile_id == current_profile.id,
                    DismissedSuggestion.document_id == document_id
                )
            )
            
            await db.commit()
            
            set_span_attribute(span, "cleared_count", cleared_count)
            
            return ClearDismissedResponse(
                success=True,
                cleared_count=cleared_count,
                message=f"Successfully cleared {cleared_count} dismissed suggestions"
            )
            
        except Exception as e:
            await db.rollback()
            sentry_sdk.capture_exception(e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to clear dismissed suggestions"
            ) 