#!/usr/bin/env python3
"""
Apply personalization columns migration to the database
"""
import os
import sys
import asyncio
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

try:
    import asyncpg
except ImportError:
    print("Installing asyncpg...")
    os.system("pip install asyncpg -q")
    import asyncpg

async def apply_migration():
    # Get database URL from environment
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("❌ DATABASE_URL not set in environment")
        return False
    
    print("🔄 Connecting to database...")
    
    try:
        conn = await asyncpg.connect(database_url)
        print("✅ Connected to database")
        
        # Read migration file
        migration_file = Path(__file__).parent / 'supabase' / 'migrations' / '20251121000003_add_last_six_hour_reset.sql'
        
        if not migration_file.exists():
            print(f"❌ Migration file not found: {migration_file}")
            return False
        
        migration_sql = migration_file.read_text()
        print(f"📄 Loaded migration: {migration_file.name}")
        
        # Apply migration
        print("🔨 Applying migration...")
        await conn.execute(migration_sql)
        print("✅ Migration applied successfully!")
        
        # Verify columns exist
        print("\n🔍 Verifying columns...")
        result = await conn.fetch("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            AND column_name LIKE 'personalization_%'
            ORDER BY column_name
        """)
        
        if result:
            print("✅ Personalization columns added:")
            for row in result:
                print(f"   - {row['column_name']}")
        else:
            print("⚠️  No personalization columns found")
        
        await conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Error applying migration: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(apply_migration())
    sys.exit(0 if success else 1)
