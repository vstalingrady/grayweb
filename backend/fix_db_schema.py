import asyncio
import asyncpg
import os

# Remote Supabase connection string constructed from env vars
# Project Ref: uxdcobkmacieegddygyr
# Password: theskyistumbling
# Host: aws-1-ap-south-1.pooler.supabase.com
# Port: 6543
DATABASE_URL = "postgresql://postgres.uxdcobkmacieegddygyr:theskyistumbling@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"

async def fix_schema():
    print(f"Connecting to {DATABASE_URL}...")
    try:
        # Set statement_cache_size=0 for Supabase pooler compatibility
        conn = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
    except Exception as e:
        print(f"Failed to connect: {e}")
        return

    try:
        # Check if columns exist
        print("Checking columns in 'users' table...")
        result = await conn.fetch("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name IN ('daily_gemini_pro_usage', 'last_daily_gemini_pro_reset');
        """)
        
        existing_columns = [r['column_name'] for r in result]
        print(f"Found columns: {existing_columns}")

        if 'daily_gemini_pro_usage' not in existing_columns:
            print("Adding 'daily_gemini_pro_usage' column...")
            await conn.execute("ALTER TABLE public.users ADD COLUMN IF NOT EXISTS daily_gemini_pro_usage INTEGER DEFAULT 0;")
            print("Added 'daily_gemini_pro_usage'.")
        else:
            print("'daily_gemini_pro_usage' already exists.")

        if 'last_daily_gemini_pro_reset' not in existing_columns:
            print("Adding 'last_daily_gemini_pro_reset' column...")
            await conn.execute("ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_daily_gemini_pro_reset TIMESTAMPTZ;")
            print("Added 'last_daily_gemini_pro_reset'.")
        else:
            print("'last_daily_gemini_pro_reset' already exists.")

        print("Schema fix completed.")

    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(fix_schema())
