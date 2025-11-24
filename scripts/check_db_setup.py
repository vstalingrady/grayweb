#!/usr/bin/env python3
"""
Check Dual Database Setup
==========================
Verifies your dual database configuration is working correctly.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")


def check_env_vars():
    """Check if required environment variables are set."""
    print("🔍 Checking environment variables...")
    print()
    
    checks = {
        "SUPABASE_URL": os.getenv("SUPABASE_URL"),
        "SUPABASE_DB_PASSWORD": os.getenv("SUPABASE_DB_PASSWORD"),
        "REMOTE_DATABASE_URL": os.getenv("REMOTE_DATABASE_URL"),
        "LOCAL_DATABASE_URL": os.getenv("LOCAL_DATABASE_URL", "sqlite:///./backend/users.db"),
    }
    
    for key, value in checks.items():
        if value:
            masked = value[:20] + "..." if len(value) > 20 else value
            if "password" in key.lower() or "DATABASE_URL" in key:
                masked = "***" + value[-10:] if len(value) > 10 else "***"
            print(f"  ✅ {key}: {masked}")
        else:
            print(f"  ⚠️  {key}: Not set")
    
    print()
    
    # Determine mode
    has_remote = bool(checks["REMOTE_DATABASE_URL"] or (checks["SUPABASE_URL"] and checks["SUPABASE_DB_PASSWORD"]))
    has_local = bool(checks["LOCAL_DATABASE_URL"])
    
    if has_remote and has_local:
        print("📊 Mode: DUAL DATABASE (Remote + Local)")
        print("   ✓ User auth → Supabase (backed up)")
        print("   ✓ Chat data → SQLite (fast)")
        return "dual"
    elif has_local:
        print("📊 Mode: LOCAL ONLY (SQLite)")
        print("   ⚠️  All data stored locally (no remote backup)")
        return "local"
    else:
        print("❌ Mode: INVALID (No database configured)")
        return "invalid"


def check_local_db():
    """Check if local database file exists."""
    print()
    print("🔍 Checking local database...")
    print()
    
    local_url = os.getenv("LOCAL_DATABASE_URL", "sqlite:///./backend/users.db")
    
    if local_url.startswith("sqlite:///"):
        db_path = local_url.replace("sqlite:///", "")
        if db_path.startswith("./"):
            db_path = ROOT_DIR / db_path[2:]
        else:
            db_path = Path(db_path)
        
        if db_path.exists():
            size_mb = db_path.stat().st_size / (1024 * 1024)
            print(f"  ✅ Database file exists: {db_path}")
            print(f"  📦 Size: {size_mb:.2f} MB")
        else:
            print(f"  ⚠️  Database file not found: {db_path}")
            print(f"     (Will be created on first run)")
    else:
        print(f"  ℹ️  Using PostgreSQL for local DB")
    
    print()


def check_remote_connection():
    """Check if we can connect to remote database."""
    print()
    print("🔍 Checking remote database connection...")
    print()
    
    remote_url = os.getenv("REMOTE_DATABASE_URL")
    
    if not remote_url:
        supabase_url = os.getenv("SUPABASE_URL", "")
        db_password = os.getenv("SUPABASE_DB_PASSWORD", "")
        
        if not supabase_url or not db_password:
            print("  ⚠️  Remote database not configured")
            print("     Set REMOTE_DATABASE_URL or SUPABASE_URL + SUPABASE_DB_PASSWORD")
            return False
        
        # Construct URL
        project_ref = supabase_url.replace("https://", "").replace(".supabase.co", "")
        remote_url = f"postgresql://postgres.{project_ref}:{db_password}@aws-0-us-west-1.pooler.supabase.com:6543/postgres"
    
    # Try to connect
    try:
        import asyncpg
        import asyncio
        
        async def test_connection():
            try:
                conn = await asyncpg.connect(remote_url, timeout=5)
                await conn.close()
                return True
            except Exception as e:
                print(f"  ❌ Connection failed: {e}")
                return False
        
        result = asyncio.run(test_connection())
        
        if result:
            print("  ✅ Remote database connection successful!")
            return True
        else:
            return False
            
    except ImportError:
        print("  ⚠️  asyncpg not installed (needed for remote DB)")
        print("     Install with: pip install asyncpg")
        return False
    except Exception as e:
        print(f"  ❌ Error testing connection: {e}")
        return False


def main():
    """Main entry point."""
    print("=" * 60)
    print("Dual Database Configuration Check")
    print("=" * 60)
    print()
    
    mode = check_env_vars()
    check_local_db()
    
    if mode == "dual":
        remote_ok = check_remote_connection()
        print()
        print("=" * 60)
        if remote_ok:
            print("✅ DUAL DATABASE SETUP COMPLETE!")
            print()
            print("Your configuration:")
            print("  • User accounts → Supabase (backed up)")
            print("  • Chat & data → SQLite (fast)")
            print()
            print("Next: Restart your backend to use dual database mode")
        else:
            print("⚠️  DUAL DATABASE PARTIALLY CONFIGURED")
            print()
            print("Local database is ready, but remote connection failed.")
            print("Check your SUPABASE_DB_PASSWORD and try again.")
        print("=" * 60)
    
    elif mode == "local":
        print()
        print("=" * 60)
        print("ℹ️  LOCAL-ONLY MODE")
        print()
        print("All data stored locally in SQLite.")
        print()
        print("To enable dual database:")
        print("  1. Add SUPABASE_DB_PASSWORD to .env")
        print("  2. Run: python scripts/apply_remote_migration.py")
        print("  3. Restart backend")
        print("=" * 60)
    
    else:
        print()
        print("=" * 60)
        print("❌ INVALID CONFIGURATION")
        print()
        print("No database configured. Check your .env file.")
        print("=" * 60)
        sys.exit(1)


if __name__ == "__main__":
    main()
