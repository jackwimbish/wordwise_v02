# /backend/app/auth.py

import os
from typing import Optional
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
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