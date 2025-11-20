"""
Simple manual calendar test - checks if backend is running.
"""
import httpx
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"
TEST_USER_ID = 1

print("\n" + "="*60)
print("  CALENDAR API QUICK TEST")
print("="*60)

print("\n🔍 Checking if backend is running...")
try:
    with httpx.Client(timeout=5.0) as client:
        # Test 1: Check if API is up
        try:
            response = client.get(f"{BASE_URL}/health")
            print(f"✅ Backend is running (tried /health endpoint)")
        except:
            # Health endpoint might not exist, try another
            response = client.get(f"{BASE_URL}/")
            print(f"✅ Backend is running")
        
        # Test 2: Get existing calendar events
        print("\n📅 Testing: Get Calendar Events")
        response = client.get(f"{BASE_URL}/users/{TEST_USER_ID}/calendar-events")
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            events = response.json()
            print(f"   ✅ Retrieved {len(events)} existing events")
            if events:
                print(f"   Sample event: {events[0].get('title', 'No title')}")
        else:
            print(f"   ❌ Failed: {response.text[:200]}")
        
        # Test 3: Create a new event
        print("\n➕ Testing: Create Calendar Event")
        new_event = {
            "title": "Auto Test Event",
            "description": "Created by test script",
            "start_time": (datetime.now() + timedelta(hours=1)).isoformat(),
            "end_time": (datetime.now() + timedelta(hours=2)).isoformat(),
        }
        
        response = client.post(
            f"{BASE_URL}/users/{TEST_USER_ID}/calendar-events",
            json=new_event
        )
        print(f"   Status: {response.status_code}")
        
        created_event_id = None
        if response.status_code == 201:
            event = response.json()
            created_event_id = event.get('id')
            print(f"   ✅ Created event ID: {created_event_id}")
            print(f"   Title: {event.get('title')}")
        else:
            print(f"   ❌ Failed: {response.text[:200]}")
        
        # Test 4: Update the event (if created)
        if created_event_id:
            print(f"\n✏️  Testing: Update Event {created_event_id}")
            update_data = {
                "title": "UPDATED Auto Test Event",
                "description": "This event was updated"
            }
            
            response = client.patch(
                f"{BASE_URL}/users/{TEST_USER_ID}/calendar-events/{created_event_id}",
                json=update_data
            )
            print(f"   Status: {response.status_code}")
            
            if response.status_code == 200:
                updated = response.json()
                print(f"   ✅ Updated to: {updated.get('title')}")
            else:
                print(f"   ❌ Failed: {response.text[:200]}")
        
        # Test 5: Delete the event (cleanup)
        if created_event_id:
            print(f"\n🗑️  Testing: Delete Event {created_event_id}")
            response = client.delete(
                f"{BASE_URL}/users/{TEST_USER_ID}/calendar-events/{created_event_id}"
            )
            print(f"   Status: {response.status_code}")
            
            if response.status_code == 204:
                print(f"   ✅ Event deleted successfully")
            else:
                print(f"   ❌ Failed: {response.text[:200]}")
        
        print("\n" + "="*60)
        print("  ✅ CALENDAR API TEST COMPLETE")
        print("="*60 + "\n")

except httpx.ConnectError:
    print("\n❌ ERROR: Cannot connect to backend at " + BASE_URL)
    print("   Make sure the backend server is running!")
    print("   Run: cd backend && uvicorn main:app --reload")
    print("\n")
except Exception as e:
    print(f"\n❌ ERROR: {e}")
    print("\n")
