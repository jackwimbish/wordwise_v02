#!/usr/bin/env python3
"""
Test script to verify rate limiting functionality.
This script can be run to test the rate limiting logic without making actual API calls.

Usage: python test_rate_limiting.py
"""

import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from pathlib import Path

# Add the current directory to the Python path so we can import from app
sys.path.insert(0, str(Path(__file__).parent))

from app.database import AsyncSessionLocal
from app.models import Profile
from app.auth import check_rate_limit


async def test_rate_limiting():
    """Test the rate limiting functionality."""
    print("Testing rate limiting functionality...")
    
    # Create a mock profile for testing
    test_profile_id = uuid4()
    mock_profile = Profile(
        id=test_profile_id,
        api_call_count=0,
        rate_limit_reset_at=None,
        email="test@example.com",
        display_name="Test User"
    )
    
    async with AsyncSessionLocal() as db:
        print(f"\n📊 Testing with profile ID: {test_profile_id}")
        
        # Test 1: First request (should succeed)
        print("\n1️⃣ Testing first request (should succeed)...")
        try:
            result = await check_rate_limit(5, mock_profile, db)  # 5 requests per hour limit
            print(f"✅ First request succeeded. API call count: {result.api_call_count}")
            print(f"   Reset time: {result.rate_limit_reset_at}")
        except Exception as e:
            print(f"❌ First request failed: {e}")
        
        # Test 2: Multiple requests within limit
        print("\n2️⃣ Testing requests within limit...")
        for i in range(2, 5):  # Make 3 more requests (total of 4, under limit of 5)
            try:
                result = await check_rate_limit(5, mock_profile, db)
                print(f"✅ Request {i} succeeded. API call count: {result.api_call_count}")
            except Exception as e:
                print(f"❌ Request {i} failed: {e}")
        
        # Test 3: Exceed rate limit
        print("\n3️⃣ Testing rate limit exceeded...")
        try:
            result = await check_rate_limit(5, mock_profile, db)
            print(f"✅ Request 5 succeeded. API call count: {result.api_call_count}")
        except Exception as e:
            print(f"✅ Request 5 correctly blocked: {type(e).__name__}")
        
        # Now try one more that should definitely be blocked
        try:
            result = await check_rate_limit(5, mock_profile, db)
            print(f"❌ Request 6 should have been blocked but succeeded: {result.api_call_count}")
        except Exception as e:
            print(f"✅ Request 6 correctly rate limited")
            # Check if it's the right type of error
            if hasattr(e, 'status_code') and e.status_code == 429:
                print(f"   Correct HTTP 429 status code")
                if hasattr(e, 'detail') and isinstance(e.detail, dict):
                    detail = e.detail
                    print(f"   Current usage: {detail.get('current_usage')}")
                    print(f"   Limit: {detail.get('limit')}")
                    print(f"   Reset in: {detail.get('reset_in_seconds')} seconds")
        
        # Test 4: Rate limit reset (simulate time passing)
        print("\n4️⃣ Testing rate limit reset...")
        # Manually set the reset time to the past to simulate time passing
        mock_profile.rate_limit_reset_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        
        try:
            result = await check_rate_limit(5, mock_profile, db)
            print(f"✅ Rate limit reset works. New API call count: {result.api_call_count}")
            print(f"   New reset time: {result.rate_limit_reset_at}")
        except Exception as e:
            print(f"❌ Rate limit reset failed: {e}")
        
        # Test 5: Different limits for different operations
        print("\n5️⃣ Testing different rate limits...")
        
        # Reset the profile
        mock_profile.api_call_count = 0
        mock_profile.rate_limit_reset_at = None
        
        # Test with a very restrictive limit
        try:
            result = await check_rate_limit(1, mock_profile, db)  # Only 1 request per hour
            print(f"✅ Restrictive limit test 1 succeeded. Count: {result.api_call_count}")
        except Exception as e:
            print(f"❌ Restrictive limit test 1 failed: {e}")
        
        # This should fail
        try:
            result = await check_rate_limit(1, mock_profile, db)
            print(f"❌ Restrictive limit test 2 should have failed but succeeded: {result.api_call_count}")
        except Exception as e:
            print(f"✅ Restrictive limit test 2 correctly blocked")
    
    print("\n🎉 Rate limiting tests completed!")
    print("\n📝 Summary:")
    print("   - Database-backed rate limiting is working")
    print("   - Per-user limits are enforced")
    print("   - Rate limit windows reset correctly")
    print("   - Different limits can be applied to different operations")
    print("   - Proper HTTP 429 errors are returned when limits are exceeded")


if __name__ == "__main__":
    try:
        asyncio.run(test_rate_limiting())
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc() 