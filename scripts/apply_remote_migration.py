#!/usr/bin/env python3
"""
Apply Remote Database Migration
================================
Sets up the remote Supabase tables for the dual database architecture.
"""

import os
import asyncio
from pathlib import Path
from dotenv import load_dotenv

# Load environment
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")


async def apply_remote_migration():
    """Apply the remote database migration to Supabase."""
    
    # Try to import asyncpg for PostgreSQL
    try:
        import asyncpg
    except ImportError:
        print("❌ asyncpg not installed. Install with: pip install asyncpg")
        return False
    
    # Get remote database URL
    remote_url = os.getenv("REMOTE_DATABASE_URL")
    
    if not remote_url:
        # Try to construct from Supabase credentials
        supabase_url = os.getenv("SUPABASE_URL", "")
        db_password = os.getenv("SUPABASE_DB_PASSWORD", "")
        
        if not supabase_url or not db_password:
            print("❌ REMOTE_DATABASE_URL not set and cannot auto-construct")
            print("   Set either:")
            print("   - REMOTE_DATABASE_URL=postgresql://...")
            print("   - SUPABASE_URL + SUPABASE_DB_PASSWORD")
            return False
        
        # Extract project ref
        project_ref = supabase_url.replace("https://", "").replace(".supabase.co", "")
        remote_url = f"postgresql://postgres:{db_password}@db.{project_ref}.supabase.co:5432/postgres"
    
    print(f"🔗 Connecting to remote database...")
    
    try:
        conn = await asyncpg.connect(remote_url)
        print("✅ Connected successfully!")
        
        # Read migration file
        migration_file = ROOT_DIR / "supabase" / "migrations" / "create_remote_tables.sql"
        
        if not migration_file.exists():
            print(f"❌ Migration file not found: {migration_file}")
            await conn.close()
            return False
        
        print(f"📄 Reading migration: {migration_file.name}")
        migration_sql = migration_file.read_text()
        
        # Execute migration
        print("🚀 Applying migration...")
        await conn.execute(migration_sql)
        
        print("✅ Migration applied successfully!")
        
        # Verify tables were created
        tables_query = """
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('users', 'user_streaks', 'proactivity_push_subscriptions', 'google_calendar_credentials')
            ORDER BY table_name;
        """
        
        tables = await conn.fetch(tables_query)
        
        if tables:
            print(f"\n📊 Created {len(tables)} remote tables:")
            for table in tables:
                print(f"   ✓ {table['table_name']}")
        else:
            print("⚠️  No tables found - migration may have failed")
        
        await conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Error applying migration: {e}")
        return False


async def main():
    """Main entry point."""
    print("=" * 60)
    print("Remote Database Migration")
    print("=" * 60)
    print()
    
    success = await apply_remote_migration()
    
    print()
    if success:
        print("🎉 Remote database setup complete!")
        print()
        print("Next steps:")
        print("1. Update your .env with REMOTE_DATABASE_URL")
        print("2. Restart your backend server")
        print("3. User auth data will now be stored remotely")
    else:
        print("❌ Migration failed. Check the errors above.")
    print()


if __name__ == "__main__":
    asyncio.run(main())
