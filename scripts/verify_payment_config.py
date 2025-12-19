#!/usr/bin/env python3
"""
Verification script to ensure payment configuration is correct.
Checks:
1. Default provider is 'midtrans'
2. 'dodo' is a supported provider
3. 'gumroad' is NOT a supported provider
"""

import sys
import os
from pathlib import Path

# Add repo root to path
repo_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(repo_root))

try:
    from backend.api.payments import _normalize_provider
    from fastapi import HTTPException
except ImportError as e:
    print(f"❌ Failed to import backend modules: {e}")
    sys.exit(1)

def verify_providers():
    print("🔍 Verifying Payment Providers...")
    
    # Check 1: Default Provider
    try:
        default = _normalize_provider(None)
        if default == "midtrans":
            print("✅ Default provider is 'midtrans'")
        else:
            print(f"❌ Default provider is '{default}' (Expected: 'midtrans')")
            return False
    except Exception as e:
         print(f"❌ Error checking default provider: {e}")
         return False

    # Check 2: Dodo Provider
    try:
        dodo = _normalize_provider("dodo")
        if dodo == "dodo":
            print("✅ 'dodo' provider is supported")
        else:
             print(f"❌ 'dodo' provider returned '{dodo}'")
             return False
    except Exception as e:
        print(f"❌ Error checking 'dodo' provider: {e}")
        return False
        
    # Check 3: Gumroad Provider (Should Fail)
    print("Testing 'gumroad' provider (expecting failure)...")
    try:
        _normalize_provider("gumroad")
        print("❌ 'gumroad' provider was accepted! (FAIL)")
        return False
    except HTTPException as e:
        print(f"✅ 'gumroad' provider correctly raised HTTPException: {e.detail}")
    except Exception as e:
        print(f"⚠️ 'gumroad' raised unexpected exception: {type(e).__name__}: {e}")
        # accepted as long as it failed
        
    return True

if __name__ == "__main__":
    if verify_providers():
        print("\n✨ Verification Successful: Payment configuration matches expectations.")
        sys.exit(0)
    else:
        print("\n❌ Verification Failed!")
        sys.exit(1)
