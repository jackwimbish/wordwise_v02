#!/usr/bin/env python3

import asyncio
import os
import sys
from uuid import uuid4
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# Add the app directory to the path so we can import our modules
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.database import get_db_session
from app.models import Profile

async def test_profile_creation():
    """Test that profiles can be created with proper api_call_count defaults."""
    
    # Get a database session
    async for db in get_db_session():
        try:
            # Test 1: Direct profile creation (simulating trigger)
            test_user_id = uuid4()
            test_email = f"test_{test_user_id}@example.com"
            
            print(f"Testing profile creation for user: {test_email}")
            
            # Simulate what the trigger does
            result = await db.execute(
                text("INSERT INTO profiles (id, email, api_call_count) VALUES (:id, :email, 0) RETURNING *"),
                {"id": test_user_id, "email": test_email}
            )
            
            created_profile = result.fetchone()
            print(f"✅ Profile created successfully:")
            print(f"   ID: {created_profile.id}")
            print(f"   Email: {created_profile.email}")
            print(f"   API Call Count: {created_profile.api_call_count}")
            
            # Test 2: Verify we can query the profile
            profile = await db.get(Profile, test_user_id)
            if profile:
                print(f"✅ Profile query successful:")
                print(f"   API Call Count: {profile.api_call_count}")
                print(f"   Rate Limit Reset: {profile.rate_limit_reset_at}")
            else:
                print("❌ Failed to query created profile")
                
            # Clean up
            await db.execute(
                text("DELETE FROM profiles WHERE id = :id"),
                {"id": test_user_id}
            )
            await db.commit()
            print("✅ Cleanup completed")
            
        except Exception as e:
            print(f"❌ Test failed with error: {e}")
            await db.rollback()
        finally:
            await db.close()
            break

if __name__ == "__main__":
    print("Testing user registration fix...")
    asyncio.run(test_profile_creation())
    print("Test completed!") 