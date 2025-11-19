
import sqlalchemy
from sqlalchemy import create_engine, text
import os

# Database URL
DATABASE_URL = "sqlite:////home/vstaln/hackathon/backend/users.db"

def add_column_if_not_exists(engine, table_name, column_name, column_type):
    with engine.connect() as conn:
        # Check if column exists
        result = conn.execute(text(f"PRAGMA table_info({table_name})"))
        columns = [row.name for row in result]
        
        if column_name not in columns:
            print(f"Adding '{column_name}' column to '{table_name}' table...")
            try:
                conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"))
                print(f"Successfully added '{column_name}' to '{table_name}'.")
            except Exception as e:
                print(f"Error adding column: {e}")
        else:
            print(f"Column '{column_name}' already exists in '{table_name}'.")

def main():
    if not os.path.exists("/home/vstaln/hackathon/backend/users.db"):
        print("Database file not found at /home/vstaln/hackathon/backend/users.db")
        return

    engine = create_engine(DATABASE_URL)

    # Add color to calendar_events
    add_column_if_not_exists(engine, "calendar_events", "color", "VARCHAR")

    # Add color to reminders
    add_column_if_not_exists(engine, "reminders", "color", "VARCHAR")

    # Add color to plans
    add_column_if_not_exists(engine, "plans", "color", "VARCHAR")

if __name__ == "__main__":
    main()
