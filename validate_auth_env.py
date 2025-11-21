#!/usr/bin/env python3
"""
Comprehensive environment and Supabase configuration validator
"""
import os
import sys
import json
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

try:
    from supabase import create_client, Client
    import requests
except ImportError:
    print("❌ Missing dependencies. Installing...")
    os.system("pip install supabase requests -q")
    from supabase import create_client, Client
    import requests

def check_env_var(name, required=True, prefix=""):
    """Check if environment variable exists and return its value"""
    value = os.getenv(name)
    if value:
        # Mask sensitive values
        if "KEY" in name or "SECRET" in name or "PASSWORD" in name:
            display_value = value[:10] + "..." if len(value) > 10 else "***"
        else:
            display_value = value
        print(f"  ✅ {name} = {display_value}")
        return value
    else:
        if required:
            print(f"  ❌ {name} is MISSING (required)")
        else:
            print(f"  ⚠️  {name} is not set (optional)")
        return None

def validate_url(url, name):
    """Validate that a URL is accessible"""
    try:
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            print(f"  ✅ {name} is accessible ({url})")
            return True
        else:
            print(f"  ⚠️  {name} returned status {response.status_code} ({url})")
            return False
    except Exception as e:
        print(f"  ❌ {name} is not accessible: {e}")
        return False

def main():
    print("=" * 60)
    print("GRAY AUTHENTICATION ENVIRONMENT VALIDATOR")
    print("=" * 60)
    print()

    # Check Supabase configuration
    print("📦 SUPABASE CONFIGURATION")
    print("-" * 60)
    supabase_url = check_env_var("NEXT_PUBLIC_SUPABASE_URL")
    supabase_anon_key = check_env_var("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    print()

    # Check application URLs
    print("🌐 APPLICATION URLS")
    print("-" * 60)
    site_url = check_env_var("NEXT_PUBLIC_SITE_URL")
    api_url = check_env_var("NEXT_PUBLIC_API_URL", required=False)
    print()

    # Check environment mode
    print("⚙️  ENVIRONMENT MODE")
    print("-" * 60)
    node_env = check_env_var("NODE_ENV", required=False)
    environment = check_env_var("ENVIRONMENT", required=False)
    print()

    # Check OAuth configuration
    print("🔐 OAUTH CONFIGURATION")
    print("-" * 60)
    google_client_id = check_env_var("GOOGLE_CLIENT_ID", required=False)
    google_client_secret = check_env_var("GOOGLE_CLIENT_SECRET", required=False)
    google_redirect = check_env_var("GOOGLE_REDIRECT_URI", required=False)
    print()

    # Validate Supabase connection
    print("🔌 SUPABASE CONNECTION TEST")
    print("-" * 60)
    if supabase_url and supabase_anon_key:
        try:
            supabase: Client = create_client(supabase_url, supabase_anon_key)
            print("  ✅ Supabase client created successfully")
            
            # Test auth endpoint
            try:
                response = supabase.auth.get_session()
                print("  ✅ Supabase auth endpoint is accessible")
            except Exception as e:
                print(f"  ⚠️  Auth endpoint test: {e}")
            
        except Exception as e:
            print(f"  ❌ Failed to create Supabase client: {e}")
    else:
        print("  ❌ Cannot test Supabase connection - missing credentials")
    print()

    # Check local server
    print("🖥️  LOCAL SERVER STATUS")
    print("-" * 60)
    if site_url:
        validate_url(site_url, "Site URL")
        validate_url(f"{site_url}/login", "Login page")
        validate_url(f"{site_url}/callback", "Callback page")
    print()

    # Configuration recommendations
    print("💡 CONFIGURATION RECOMMENDATIONS")
    print("-" * 60)
    
    issues = []
    
    if not supabase_url or not supabase_anon_key:
        issues.append("Missing Supabase credentials")
    
    if site_url and "localhost:3000" in site_url:
        issues.append("Site URL is set to port 3000, but server might be on 3001")
    
    if google_redirect and "gray.alignment.id" in google_redirect and site_url and "localhost" in site_url:
        issues.append("Google redirect URI is production but site URL is localhost")
    
    if not issues:
        print("  ✅ No issues detected in environment configuration")
    else:
        for issue in issues:
            print(f"  ⚠️  {issue}")
    
    print()
    print("=" * 60)
    print("NEXT STEPS:")
    print("=" * 60)
    print("1. Verify Supabase dashboard settings:")
    print(f"   - Site URL: {site_url or 'NOT SET'}")
    print(f"   - Redirect URLs should include: {site_url}/callback" if site_url else "   - Set NEXT_PUBLIC_SITE_URL first")
    print()
    print("2. Test login at: " + (f"{site_url}/login" if site_url else "Set NEXT_PUBLIC_SITE_URL first"))
    print()
    print("3. Check browser console for errors (F12 → Console)")
    print()

if __name__ == "__main__":
    main()
