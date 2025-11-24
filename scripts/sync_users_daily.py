#!/usr/bin/env python3
"""
Sync Local Users to Remote (Supabase)
======================================
Syncs user data from local SQLite to remote Supabase via REST API.
Runs daily to backup critical auth data.
"""

import os
import sys
import sqlite3
import asyncio
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

# Load environment
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

try:
    from supabase import create_client, Client
except ImportError:
    print("❌ supabase-py not installed. Install with: pip install supabase")
    sys.exit(1)


def get_local_users():
    """Get all users from local SQLite database."""
    local_db_url = os.getenv("LOCAL_DATABASE_URL", "sqlite:///./backend/users.db")
    db_path = local_db_url.replace("sqlite:///", "")
    
    if db_path.startswith("./"):
        db_path = ROOT_DIR / db_path[2:]
    else:
        db_path = Path(db_path)
    
    if not db_path.exists():
        print(f"❌ Local database not found: {db_path}")
        return []
    
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM users")
    users = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    return users


def sync_users_to_remote(users: list) -> tuple[int, int]:
    """Sync users to Supabase via REST API."""
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_key:
        print("❌ SUPABASE_URL or SUPABASE_KEY not set")
        return 0, 0
    
    supabase: Client = create_client(supabase_url, supabase_key)
    
    synced = 0
    errors = 0
    
    for user in users:
        try:
            # Check if user exists in remote
            result = supabase.table("users").select("id").eq("email", user["email"]).execute()
            
            # Prepare user data (remove local-only fields)
            user_data = {k: v for k, v in user.items() if k != "id"}
            
            if result.data:
                # Update existing user
                supabase.table("users").update(user_data).eq("email", user["email"]).execute()
                synced += 1
            else:
                # Insert new user
                supabase.table("users").insert(user_data).execute()
                synced += 1
                
        except Exception as e:
            print(f"  ⚠️  Failed to sync {user['email']}: {e}")
            errors += 1
    
    return synced, errors


def main():
    """Main entry point."""
    print("=" * 60)
    print("Daily User Sync: Local → Remote (Supabase)")
    print("=" * 60)
    print()
    
    print("📊 Fetching local users...")
    users = get_local_users()
    
    if not users:
        print("  ℹ️  No users found in local database")
        print()
        return
    
    print(f"  ✅ Found {len(users)} users")
    print()
    
    print("☁️  Syncing to Supabase...")
    synced, errors = sync_users_to_remote(users)
    
    print()
    print("=" * 60)
    print(f"✅ Sync complete!")
    print(f"  • Synced: {synced} users")
    if errors > 0:
        print(f"  • Errors: {errors} users")
    print(f"  • Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    print()


if __name__ == "__main__":
    main()
