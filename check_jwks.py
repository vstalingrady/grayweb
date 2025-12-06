import urllib.request
import json
import ssl

url = "https://uxdcobkmacieegddygyr.supabase.co/auth/v1/.well-known/jwks.json"
print(f"Fetching JWKS from: {url}")

try:
    # Use unverified context to avoid SSL cert issues in some minimal environments, 
    # though usually typically fine.
    context = ssl.create_default_context()
    with urllib.request.urlopen(url, context=context, timeout=10) as response:
        content = response.read().decode("utf-8")
        data = json.loads(content)
        
        print("\n--- JWKS KEYS ---")
        if "keys" in data:
            for key in data["keys"]:
                print(f"kid: {key.get('kid')}")
                print(f"alg: {key.get('alg')}")
                print("-" * 20)
                
            # Check for the specific kid from the error
            target_kid = "zqi//cdXwhS/uQpe"
            found = any(k.get("kid") == target_kid for k in data["keys"])
            print(f"\nTarget kid '{target_kid}' found: {found}")
        else:
            print("No 'keys' field in response.")
            print(json.dumps(data, indent=2))
            
except Exception as e:
    print(f"Error fetching JWKS: {e}")
