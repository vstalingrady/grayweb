import os
import shutil
from pathlib import Path

# Config
SOURCE_DIR = Path("/home/vstaln/gray/docs/paddle-api")
DEST_DIR = Path("/home/vstaln/gray/docs/paddle-essentials")

# Define patterns/files we definitely want to keep
KEEP_PATTERNS = [
    # Setup
    "authentication",
    "api-keys",
    "paddle-ids",
    
    # Core Resources - API
    "subscriptions",
    "transactions",
    "products",
    "prices",
    "customers",
    
    # Webhooks
    "webhooks-overview",
    "signature-verification",
    "respond-to-webhooks",
    "subscription-created",
    "subscription-updated",
    "subscription-canceled",
    "subscription-activated",
    "transaction-completed",
    "transaction-paid",
    
    # Frontend
    "paddlejs",
    "checkout"
]

def clean_docs():
    if not SOURCE_DIR.exists():
        print(f"Source directory {SOURCE_DIR} does not exist.")
        return

    # Create dest dir
    if DEST_DIR.exists():
        shutil.rmtree(DEST_DIR)
    DEST_DIR.mkdir(parents=True)

    print(f"Scanning {SOURCE_DIR}...")
    
    count = 0
    # Walk through all files
    for root, dirs, files in os.walk(SOURCE_DIR):
        for file in files:
            if not file.endswith(".md") or file == "INDEX.md":
                continue
                
            file_path = Path(root) / file
            
            # Check if file matches any of our essential patterns
            is_essential = False
            for pattern in KEEP_PATTERNS:
                if pattern in file.lower():
                    is_essential = True
                    break
            
            # Skip specific error files (too noisy)
            if "errors-" in file and "overview" not in file:
                is_essential = False
            
            if is_essential:
                # Determine category based on original path
                category = "misc"
                path_str = str(file_path)
                
                if "webhooks" in path_str and "api-reference" not in path_str:
                    category = "webhooks"
                elif "api-reference" in path_str:
                    category = "api"
                elif "paddlejs" in path_str:
                    category = "frontend"
                elif "concepts" in path_str:
                    category = "concepts"
                elif "errors" in path_str:
                    category = "references" # For error overview
                
                # Create category dir in dest
                cat_dir = DEST_DIR / category
                cat_dir.mkdir(exist_ok=True)
                
                shutil.copy2(file_path, cat_dir / file)
                print(f"Kept: {category}/{file}")
                count += 1

    print(f"\nMoved {count} essential files to {DEST_DIR}")

if __name__ == "__main__":
    clean_docs()
