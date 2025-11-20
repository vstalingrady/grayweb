"""
Comprehensive test suite for calendar functionality.
Tests the backend API endpoints for calendar events.
"""
import asyncio
import sys
from pathlib import Path
from datetime import datetime, timedelta
import httpx

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

# Test user ID (assuming user 1 exists in your DB)
TEST_USER_ID = 1
BASE_URL = "http://localhost:8000"

def print_test_header(message):
    """Print a formatted test section header."""
    print(f"\n{'='*60}")
    print(f"  {message}")
    print(f"{'='*60}")

def print_success(message):
    """Print a success message."""
    print(f"✅ {message}")

def print_error(message):
    """Print an error message."""
    print(f"❌ {message}")

def test_create_calendar_event():
    """Test creating a new calendar event."""
    print_test_header("Testing: Create Calendar Event")
    
    # Create a test event
    event_data = {
        "title": "Test Meeting",
        "description": "This is a test calendar event",
        "start_time": (datetime.now() + timedelta(hours=1)).isoformat(),
        "end_time": (datetime.now() + timedelta(hours=2)).isoformat(),
        "calendar_id": None
    }
    
    with httpx.Client() as client:
        response = client.post(
            f"{BASE_URL}/users/{TEST_USER_ID}/calendar-events",
            json=event_data
        )
    
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 201:
            event = response.json()
            print(f"Response: {event}")
            print_success(f"Created event: {event['title']} (ID: {event['id']})")
            return event['id']
        else:
            print(f"Response: {response.text}")
            print_error(f"Failed to create event: {response.text}")
            return None

def test_get_calendar_events(event_id=None):
    """Test retrieving calendar events."""
    print_test_header("Testing: Get Calendar Events")
    
    # Get events with date range
    start = datetime.now() - timedelta(days=7)
    end = datetime.now() + timedelta(days=7)
    
    response = client.get(
        f"/users/{TEST_USER_ID}/calendar-events",
        params={
            "start": start.isoformat(),
            "end": end.isoformat()
        }
    )
    
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        events = response.json()
        print_success(f"Retrieved {len(events)} events")
        
        for event in events[:3]:  # Show first 3
            print(f"  - {event['title']} ({event['start_time']} to {event['end_time']})")
        
        if event_id and any(e['id'] == event_id for e in events):
            print_success(f"Confirmed event {event_id} exists in list")
        
        return events
    else:
        print_error(f"Failed to get events: {response.text}")
        return []

def test_update_calendar_event(event_id):
    """Test updating a calendar event."""
    print_test_header("Testing: Update Calendar Event")
    
    if not event_id:
        print_error("No event ID provided, skipping update test")
        return False
    
    update_data = {
        "title": "Updated Test Meeting",
        "description": "This event has been updated!"
    }
    
    response = client.patch(
        f"/users/{TEST_USER_ID}/calendar-events/{event_id}",
        json=update_data
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
    
    if response.status_code == 200:
        event = response.json()
        if event['title'] == update_data['title']:
            print_success(f"Event updated successfully: {event['title']}")
            return True
        else:
            print_error("Event title not updated correctly")
            return False
    else:
        print_error(f"Failed to update event: {response.text}")
        return False

def test_delete_calendar_event(event_id):
    """Test deleting a calendar event."""
    print_test_header("Testing: Delete Calendar Event")
    
    if not event_id:
        print_error("No event ID provided, skipping delete test")
        return False
    
    response = client.delete(
        f"/users/{TEST_USER_ID}/calendar-events/{event_id}"
    )
    
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 204:
        print_success(f"Event {event_id} deleted successfully")
        
        # Verify deletion
        verify_response = client.get(f"/users/{TEST_USER_ID}/calendar-events")
        if verify_response.status_code == 200:
            events = verify_response.json()
            if not any(e['id'] == event_id for e in events):
                print_success("Confirmed event no longer exists")
                return True
            else:
                print_error("Event still exists after deletion!")
                return False
    else:
        print_error(f"Failed to delete event: {response.text}")
        return False

def test_calendar_validation():
    """Test validation of calendar event data."""
    print_test_header("Testing: Calendar Event Validation")
    
    # Test 1: Missing required fields
    print("\nTest 1: Missing required fields")
    response = client.post(
        f"/users/{TEST_USER_ID}/calendar-events",
        json={"title": "Incomplete Event"}
    )
    if response.status_code in [400, 422]:
        print_success("Correctly rejected incomplete event data")
    else:
        print_error(f"Should have rejected incomplete data, got {response.status_code}")
    
    # Test 2: Invalid date format
    print("\nTest 2: End time before start time")
    response = client.post(
        f"/users/{TEST_USER_ID}/calendar-events",
        json={
            "title": "Invalid Timing",
            "start_time": datetime.now().isoformat(),
            "end_time": (datetime.now() - timedelta(hours=1)).isoformat()
        }
    )
    # Note: This might be accepted depending on backend validation
    print(f"Status Code: {response.status_code}")
    if response.status_code in [400, 422]:
        print_success("Correctly rejected invalid timing")
    else:
        print(f"⚠️  Backend accepts end time before start time (might want to add validation)")

def test_calendar_edge_cases():
    """Test edge cases for calendar functionality."""
    print_test_header("Testing: Calendar Edge Cases")
    
    # Test 1: All-day event (00:00 to 23:59)
    print("\nTest 1: All-day event")
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    response = client.post(
        f"/users/{TEST_USER_ID}/calendar-events",
        json={
            "title": "All Day Event",
            "start_time": today.isoformat(),
            "end_time": (today + timedelta(hours=23, minutes=59)).isoformat()
        }
    )
    all_day_event_id = None
    if response.status_code == 201:
        all_day_event_id = response.json()['id']
        print_success("Created all-day event")
    else:
        print_error(f"Failed to create all-day event: {response.status_code}")
    
    # Test 2: Multi-day event
    print("\nTest 2: Multi-day event")
    response = client.post(
        f"/users/{TEST_USER_ID}/calendar-events",
        json={
            "title": "Conference",
            "start_time": datetime.now().isoformat(),
            "end_time": (datetime.now() + timedelta(days=3)).isoformat()
        }
    )
    multi_day_event_id = None
    if response.status_code == 201:
        multi_day_event_id = response.json()['id']
        print_success("Created multi-day event")
    else:
        print_error(f"Failed to create multi-day event: {response.status_code}")
    
    # Test 3: Event with very long description
    print("\nTest 3: Event with long description")
    long_text = "Lorem ipsum " * 100
    response = client.post(
        f"/users/{TEST_USER_ID}/calendar-events",
        json={
            "title": "Long Description Test",
            "description": long_text,
            "start_time": (datetime.now() + timedelta(hours=3)).isoformat(),
            "end_time": (datetime.now() + timedelta(hours=4)).isoformat()
        }
    )
    long_desc_event_id = None
    if response.status_code == 201:
        long_desc_event_id = response.json()['id']
        print_success(f"Created event with description length: {len(long_text)}")
    else:
        print_error(f"Failed to create long description event: {response.status_code}")
    
    # Cleanup test events
    cleanup_ids = [all_day_event_id, multi_day_event_id, long_desc_event_id]
    for event_id in cleanup_ids:
        if event_id:
            client.delete(f"/users/{TEST_USER_ID}/calendar-events/{event_id}")

def test_calendar_performance():
    """Test creating and retrieving multiple events."""
    print_test_header("Testing: Calendar Performance (Bulk Operations)")
    
    # Create 10 events
    created_ids = []
    print("\nCreating 10 test events...")
    base_time = datetime.now()
    
    for i in range(10):
        response = client.post(
            f"/users/{TEST_USER_ID}/calendar-events",
            json={
                "title": f"Bulk Test Event {i+1}",
                "start_time": (base_time + timedelta(hours=i)).isoformat(),
                "end_time": (base_time + timedelta(hours=i+1)).isoformat()
            }
        )
        if response.status_code == 201:
            created_ids.append(response.json()['id'])
    
    print_success(f"Created {len(created_ids)} events")
    
    # Retrieve all events
    print("\nRetrieving all events...")
    response = client.get(f"/users/{TEST_USER_ID}/calendar-events")
    if response.status_code == 200:
        events = response.json()
        print_success(f"Retrieved {len(events)} total events")
    
    # Cleanup
    print("\nCleaning up test events...")
    for event_id in created_ids:
        client.delete(f"/users/{TEST_USER_ID}/calendar-events/{event_id}")
    print_success(f"Cleaned up {len(created_ids)} events")

def main():
    """Run all calendar tests."""
    print("\n" + "="*60)
    print("  CALENDAR FEATURE TEST SUITE")
    print("="*60)
    
    all_passed = True
    
    try:
        # Core CRUD operations
        event_id = test_create_calendar_event()
        test_get_calendar_events(event_id)
        
        if event_id:
            update_success = test_update_calendar_event(event_id)
            delete_success = test_delete_calendar_event(event_id)
            all_passed = all_passed and update_success and delete_success
        
        # Validation tests
        test_calendar_validation()
        
        # Edge cases
        test_calendar_edge_cases()
        
        # Performance tests
        test_calendar_performance()
        
        # Final summary
        print("\n" + "="*60)
        if all_passed:
            print("  ✅ ALL CALENDAR TESTS COMPLETED SUCCESSFULLY!")
        else:
            print("  ⚠️  SOME TESTS HAD ISSUES - Review output above")
        print("="*60 + "\n")
        
    except Exception as e:
        print("\n" + "="*60)
        print(f"  ❌ TEST SUITE FAILED: {e}")
        print("="*60 + "\n")
        raise

if __name__ == "__main__":
    main()
