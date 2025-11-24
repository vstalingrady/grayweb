import requests
import json

API_URL = "http://localhost:8000"
EMAIL = "vstalingrady@gmail.com"

def test_user_flow():
    print(f"Fetching user: {EMAIL}")
    resp = requests.get(f"{API_URL}/users/email/{EMAIL}")
    
    if resp.status_code != 200:
        print(f"❌ Failed to fetch user: {resp.status_code} {resp.text}")
        return
        
    user = resp.json()
    print(f"✅ User found: {user['id']}")
    
    # Try update
    print("Testing update...")
    update_payload = {"full_name": user["full_name"]} # No change update
    resp = requests.put(f"{API_URL}/users/{user['id']}", json=update_payload)
    
    if resp.status_code != 200:
        print(f"❌ Update failed: {resp.status_code} {resp.text}")
    else:
        print("✅ Update successful")

if __name__ == "__main__":
    try:
        test_user_flow()
    except Exception as e:
        print(f"❌ Error: {e}")
