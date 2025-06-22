# /backend/app/auth.py

import os
from typing import Optional
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from uuid import UUID
from jose import jwt, JWTError

from .database import get_db_session
from .models import Profile

# Security scheme for extracting Bearer tokens
security = HTTPBearer()

# Supabase JWT settings
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

if not SUPABASE_URL or not SUPABASE_JWT_SECRET:
    raise ValueError("SUPABASE_URL and SUPABASE_JWT_SECRET environment variables must be set")


async def verify_jwt_token(token: str) -> dict:
    """
    Verify a Supabase JWT token and return the payload.
    
    Args:
        token: The JWT token to verify
        
    Returns:
        dict: The decoded JWT payload
        
    Raises:
        HTTPException: If token is invalid or expired
    """
    try:
        # Decode the JWT token using the Supabase secret
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated"
        )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> UUID:
    """
    Extract and validate the current user's ID from the JWT token.
    
    Args:
        credentials: The HTTP authorization credentials containing the Bearer token
        
    Returns:
        UUID: The authenticated user's profile ID
        
    Raises:
        HTTPException: If token is invalid or user not found
    """
    # Verify the JWT token
    payload = await verify_jwt_token(credentials.credentials)
    
    # Extract the user ID from the 'sub' claim
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing user ID",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        user_id = UUID(user_id_str)
        return user_id
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID format",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user_profile(
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session)
) -> Profile:
    """
    Get the current user's profile from the database.
    
    Args:
        user_id: The authenticated user's ID
        db: Database session
        
    Returns:
        Profile: The user's profile object
        
    Raises:
        HTTPException: If profile not found
    """
    result = await db.execute(
        select(Profile).where(Profile.id == user_id)
    )
    profile = result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found"
        )
    
    return profile


# Convenience dependency that just returns the user ID
# Use this when you only need the user ID and not the full profile
get_current_user = get_current_user_id 


async def check_rate_limit(
    requests_per_hour: int = 100,
    current_profile: Profile = Depends(get_current_user_profile),
    db: AsyncSession = Depends(get_db_session)
) -> Profile:
    """
    Check and enforce per-user rate limits for LLM API calls.
    
    Args:
        requests_per_hour: Maximum requests allowed per hour for this route
        current_profile: The authenticated user's profile
        db: Database session
        
    Returns:
        Profile: The user's profile (for use in the protected route)
        
    Raises:
        HTTPException: 429 if rate limit exceeded
    """
    current_time = datetime.now(timezone.utc)
    
    # Check if we need to reset the rate limit window
    if (current_profile.rate_limit_reset_at is None or 
        current_time >= current_profile.rate_limit_reset_at):
        
        # Reset the rate limit window
        new_reset_time = current_time + timedelta(hours=1)
        
        # Update the profile with reset values
        await db.execute(
            update(Profile)
            .where(Profile.id == current_profile.id)
            .values(
                api_call_count=1,
                rate_limit_reset_at=new_reset_time
            )
        )
        await db.commit()
        
        # Update the current profile object for return
        current_profile.api_call_count = 1
        current_profile.rate_limit_reset_at = new_reset_time
        
    else:
        # Check if user has exceeded the rate limit
        if current_profile.api_call_count >= requests_per_hour:
            # Calculate seconds until reset
            seconds_until_reset = int((current_profile.rate_limit_reset_at - current_time).total_seconds())
            
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "error": "Rate limit exceeded",
                    "message": f"You have exceeded the rate limit of {requests_per_hour} requests per hour for this feature.",
                    "current_usage": current_profile.api_call_count,
                    "limit": requests_per_hour,
                    "reset_in_seconds": seconds_until_reset
                },
                headers={"Retry-After": str(seconds_until_reset)}
            )
        
        # Increment the API call count
        await db.execute(
            update(Profile)
            .where(Profile.id == current_profile.id)
            .values(api_call_count=current_profile.api_call_count + 1)
        )
        await db.commit()
        
        # Update the current profile object for return
        current_profile.api_call_count += 1
    
    return current_profile


def create_rate_limit_dependency(requests_per_hour: int):
    """
    Factory function to create rate limit dependencies with specific limits.
    
    Args:
        requests_per_hour: Maximum requests allowed per hour
        
    Returns:
        A FastAPI dependency function
    """
    async def rate_limit_dependency(
        current_profile: Profile = Depends(get_current_user_profile),
        db: AsyncSession = Depends(get_db_session)
    ) -> Profile:
        return await check_rate_limit(requests_per_hour, current_profile, db)
    
    return rate_limit_dependency 