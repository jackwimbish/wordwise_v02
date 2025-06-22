# Rate Limiting Implementation

This document describes the per-user, database-backed rate limiting system implemented for LLM API routes.

## Overview

The rate limiting system protects expensive LLM API calls by enforcing per-user hourly limits stored in the database. This approach provides persistent rate limiting that survives server restarts and scales across multiple server instances.

## Database Schema Changes

Added two columns to the `profiles` table:

- `api_call_count` (Integer, NOT NULL, default=0): Tracks the current number of API calls within the rate limit window
- `rate_limit_reset_at` (Timestamp, nullable): When the current rate limit window expires

## Implementation Details

### Core Rate Limiting Function

**Location**: `backend/app/auth.py`

- `check_rate_limit(requests_per_hour, current_profile, db)`: Main rate limiting logic
- `create_rate_limit_dependency(requests_per_hour)`: Factory function for creating FastAPI dependencies

### Rate Limiting Logic

1. **Window Reset Check**: If `rate_limit_reset_at` is None or in the past:
   - Reset `api_call_count` to 1
   - Set `rate_limit_reset_at` to current time + 1 hour
   
2. **Rate Limit Check**: If within window:
   - Check if `api_call_count >= limit`
   - If exceeded: Raise HTTP 429 with retry-after header
   - If under limit: Increment `api_call_count`

3. **Database Updates**: All counter updates are committed to the database immediately

### Protected Routes

#### Suggestions Router (`/suggestions`)
- **Endpoint**: `POST /suggestions/analyze`
- **Rate Limit**: 300 requests per hour per user
- **Purpose**: Grammar/spelling/style suggestions

#### Rewriter Router (`/rewrite`)
- **Endpoint**: `POST /rewrite/length`
- **Rate Limit**: 300 requests per hour per user
- **Purpose**: Document length rewriting

- **Endpoint**: `POST /rewrite/retry`
- **Rate Limit**: 300 requests per hour per user
- **Purpose**: Retry paragraph rewriting

## Route-Specific Limits

The system supports different rate limits for different endpoints:

```python
# Create specific rate limit dependencies
suggestions_rate_limit = create_rate_limit_dependency(300)  # 300/hour
length_rewrite_rate_limit = create_rate_limit_dependency(300)   # 300/hour  
retry_rewrite_rate_limit = create_rate_limit_dependency(300)   # 300/hour

# Apply to routes
@router.post("/analyze")
async def analyze_paragraphs(
    current_profile: Profile = Depends(suggestions_rate_limit),
    # ... other dependencies
):
```

## Error Response Format

When rate limit is exceeded, the API returns:

```json
{
  "detail": {
    "error": "Rate limit exceeded",
    "message": "You have exceeded the rate limit of 300 requests per hour for this feature.",
    "current_usage": 300,
    "limit": 300,
    "reset_in_seconds": 1800
  }
}
```

**HTTP Status**: 429 Too Many Requests
**Headers**: `Retry-After: 1800` (seconds until reset)

## Database Migration

Applied migration: `2025_06_22_1226_add_rate_limiting_columns_to_profiles.py`

The migration safely adds the new columns to existing data by:
1. Adding `api_call_count` as nullable
2. Setting default value of 0 for existing rows
3. Making the column NOT NULL
4. Adding `rate_limit_reset_at` as nullable

## Benefits

1. **Persistent**: Rate limits survive server restarts
2. **Scalable**: Works across multiple server instances sharing the same database
3. **Per-User**: Each user has their own independent rate limit
4. **Route-Specific**: Different limits for different types of operations
5. **User-Friendly**: Clear error messages with reset timing
6. **Database-Backed**: No need for external services like Redis

## Removed Dependencies

- Removed `slowapi` and `slowapi.util` imports
- Removed IP-based rate limiting (replaced with user-based)
- Removed `limiter.limit()` decorators from routes

## Testing

A test script is available at `backend/test_rate_limiting.py` to verify the rate limiting logic without making actual API calls.

## Future Enhancements

- Admin override capabilities (add `rate_limit_exempt` boolean to Profile)
- Different limits based on user tiers/subscriptions
- Rate limit analytics and monitoring
- Configurable rate limit windows (currently fixed at 1 hour) 