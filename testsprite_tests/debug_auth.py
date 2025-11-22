"""Debug script to test Better Auth authentication and cookie handling."""

import requests
from auth_helper import BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD

print("=" * 70)
print("Better Auth Authentication Debug")
print("=" * 70)

session = requests.Session()

# Step 1: Authenticate
print("\n1. Authenticating...")
sign_in_url = f"{BASE_URL}/api/auth/sign-in/email"
auth_payload = {
    "email": ADMIN_EMAIL,
    "password": ADMIN_PASSWORD
}

try:
    auth_resp = session.post(
        sign_in_url,
        json=auth_payload,
        timeout=30,
        allow_redirects=True
    )
    
    print(f"   Status Code: {auth_resp.status_code}")
    print(f"   Response Headers:")
    for key, value in auth_resp.headers.items():
        if 'set-cookie' in key.lower() or 'cookie' in key.lower():
            print(f"     {key}: {value[:100]}...")
    
    print(f"\n   Response Body (first 200 chars):")
    print(f"     {auth_resp.text[:200]}")
    
    # Step 2: Check cookies
    print("\n2. Cookies in session:")
    if session.cookies:
        for cookie in session.cookies:
            print(f"   Cookie: {cookie.name}")
            print(f"     Value: {cookie.value[:50]}...")
            print(f"     Domain: {cookie.domain}")
            print(f"     Path: {cookie.path}")
            print(f"     Secure: {cookie.secure}")
            print(f"     Expires: {cookie.expires}")
            
            # Check HttpOnly
            http_only = getattr(cookie, '_rest', {}).get('HttpOnly', False)
            print(f"     HttpOnly: {http_only}")
    else:
        print("   No cookies found!")
    
    # Step 3: Try authenticated request
    print("\n3. Making authenticated request...")
    orgs_url = f"{BASE_URL}/api/admin/organizations"
    
    # Show what cookies will be sent
    print(f"   Request URL: {orgs_url}")
    print(f"   Cookies to send: {session.cookies.get_dict()}")
    
    # Make request
    orgs_resp = session.get(orgs_url, timeout=30)
    
    print(f"   Status Code: {orgs_resp.status_code}")
    print(f"   Response: {orgs_resp.text[:200]}")
    
    # Step 4: Check if cookies are being sent
    print("\n4. Request headers (checking cookies):")
    # We can't see the actual request headers easily, but we can verify
    # by checking if the request was successful
    
    if orgs_resp.status_code == 200:
        print("   ✅ Authentication successful!")
    else:
        print(f"   ❌ Authentication failed: {orgs_resp.status_code}")
        print("   Possible issues:")
        print("     - Cookie domain mismatch")
        print("     - Secure cookie on HTTP (requires HTTPS)")
        print("     - Cookie not being sent")
        
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 70)

