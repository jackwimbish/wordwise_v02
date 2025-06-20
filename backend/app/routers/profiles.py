from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db_session
from ..auth import get_current_user_profile
from ..models import Profile
from ..schemas import ProfileResponse

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("/me", response_model=ProfileResponse)
async def get_current_profile(
    current_profile: Profile = Depends(get_current_user_profile)
):
    """
    Get the current user's profile information.
    """
    return ProfileResponse.model_validate(current_profile) 