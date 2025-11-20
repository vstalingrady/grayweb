import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client
import logging

# Setup basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

def run_migration():
    load_dotenv("backend/.env")
    
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY")
    
    if not url or not key:
        logger.error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found. Cannot run migration.")
        return

    try:
        supabase: Client = create_client(url, key)
        
        with open("backend/migrations/add_auth_user_id.sql", "r") as f:
            sql_statements = f.read().split(';')
            
        for statement in sql_statements:
            statement = statement.strip()
            if not statement:
                continue
                
            logger.info(f"Executing SQL: {statement[:50]}...")
            
            # Using database.rpc won't work for raw SQL usually unless there's a helper function.
            # But we might have a 'exec_sql' function or similar if this project is set up that way.
            # However, Supabase-py doesn't expose raw SQL execution directly on the client unless enabled via RPC.
            
            # PLAN B: Use psycopg2 or similar if DATABASE_URL is available.
            pass

    except Exception as e:
        logger.error(f"Error preparing migration: {e}")

    # Plan B: Use sqlalchemy/databases if DATABASE_URL is postgres
    db_url = os.getenv("DATABASE_URL")
    if db_url and "postgresql" in db_url:
        try:
            import sqlalchemy
            engine = sqlalchemy.create_engine(db_url)
            with engine.connect() as connection:
                with open("backend/migrations/add_auth_user_id.sql", "r") as f:
                    # Execute the whole script or split it?
                    # SQLAlchemy execute() usually takes one statement.
                    sql = f.read()
                    connection.execute(sqlalchemy.text(sql))
                    connection.commit()
            logger.info("Migration executed successfully via SQLAlchemy.")
        except Exception as e:
            logger.error(f"SQLAlchemy migration failed: {e}")
    else:
        logger.warning("DATABASE_URL is not a postgres URL or not found. Skipping direct DB migration.")
        logger.info("Please run 'backend/migrations/add_auth_user_id.sql' in your Supabase SQL Editor.")

if __name__ == "__main__":
    run_migration()
