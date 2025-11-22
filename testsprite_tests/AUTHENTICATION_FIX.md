# Authentication Fix - Manual Tests

## ✅ Fix Applied

I've updated the Better Auth configuration to allow insecure cookies in development mode.

### Change Made

**File:** `packages/auth/src/index.ts`

**Before:**
```typescript
defaultCookieAttributes: {
  sameSite: "none",
  secure: true,  // Required HTTPS - blocks HTTP cookies!
  httpOnly: true,
},
```

**After:**
```typescript
defaultCookieAttributes: {
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  secure: process.env.NODE_ENV === "production", // Allow insecure cookies in development
  httpOnly: true,
},
```

### What This Fixes

1. **Development Mode**: Cookies will work over HTTP (localhost:3000)
2. **Production Mode**: Cookies still require HTTPS for security
3. **SameSite**: Set to "lax" in development (allows localhost), "none" in production

## 🧪 Testing Authentication

### 1. Start the Server

Make sure your server is running:
```bash
# In your project root
npm run dev
# or whatever command starts your server
```

### 2. Test Authentication

Run the debug script:
```bash
cd testsprite_tests
py debug_auth.py
```

Or test manually:
```bash
cd testsprite_tests
py -c "from auth_helper import get_admin_session; session = get_admin_session(); print('✅ Auth successful!'); resp = session.get('http://localhost:3000/api/admin/organizations'); print(f'Status: {resp.status_code}')"
```

### 3. Run Tests

Once authentication works, run all tests:
```bash
cd testsprite_tests
py run_tests.py
```

## 📋 Expected Results

After the fix, you should see:

1. **Authentication succeeds** (200 status)
2. **Cookies are set** in the session
3. **Cookies are sent** with subsequent requests
4. **API requests succeed** (200 status) instead of 401

## 🔍 Debugging

If you still have issues:

### Check Server is Running
```bash
curl http://localhost:3000
# or
py -c "import requests; print(requests.get('http://localhost:3000').status_code)"
```

### Check Cookie Settings
Run the debug script to see:
- What cookies are being set
- Cookie domain/path
- Cookie attributes (secure, httpOnly, etc.)

### Check Better Auth Response
The debug script will show:
- Sign-in response status
- Set-Cookie headers
- Response body

## 📝 Notes

- **Development Only**: The insecure cookie setting only applies when `NODE_ENV !== "production"`
- **Production Safety**: Production will still require HTTPS and secure cookies
- **Server Restart**: You may need to restart your server after this change
- **Environment Variable**: Make sure `NODE_ENV` is not set to "production" during development

## ✅ Next Steps

1. **Restart your server** to apply the configuration change
2. **Run the debug script** to verify authentication works
3. **Run all tests** once authentication is confirmed
4. **Report any issues** if tests still fail

## 🎯 Success Criteria

Authentication is working when:
- ✅ Sign-in returns 200
- ✅ Cookies are present in session
- ✅ API request to `/api/admin/organizations` returns 200 (not 401)
- ✅ Tests pass without authentication errors

