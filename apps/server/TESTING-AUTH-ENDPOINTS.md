# Testing Better-Auth API Endpoints

This guide explains how to test the authentication endpoints for your standalone React Native app.

## Available Test Methods

There are two ways to test the authentication endpoints:

### 1. Using Vitest (Recommended for Development)

This runs the comprehensive test suite using Vitest.

```bash
# From the apps/server directory
npm test auth-endpoints

# Or run all tests
npm test
```

### 2. Using Standalone Script (Quick Testing)

This runs a Node.js script directly without the test framework.

```bash
# From the apps/server directory
# Test against local server (default)
node test-auth-endpoints.js

# Test against specific server URL
node test-auth-endpoints.js http://localhost:3000
node test-auth-endpoints.js https://2c70c7c57e60.ngrok-free.app
```

## Prerequisites

1. **Start the server** before running tests:
   ```bash
   # From apps/server directory
   npm run dev
   ```

2. Make sure your `.env` file is configured with:
   - `DATABASE_URL`
   - `BETTER_AUTH_SECRET`
   - `BETTER_AUTH_URL` (the base URL where your server is accessible)

## Test Coverage

The tests verify the following endpoints according to the guidelines:

### ✅ POST /api/auth/sign-up
- ✅ Successful user registration
- ✅ Rejects duplicate email
- ✅ Rejects invalid email format
- ✅ Rejects short passwords (< 8 characters)

### ✅ POST /api/auth/sign-in
- ✅ Successful login with correct credentials
- ✅ Rejects incorrect password
- ✅ Rejects non-existent email

### ✅ GET /api/auth/session
- ✅ Returns session with Bearer token
- ✅ Returns session with cookie
- ✅ Rejects invalid token (401)
- ✅ Rejects unauthenticated requests (401)

### ✅ POST /api/auth/sign-out
- ✅ Successful logout with Bearer token
- ✅ Successful logout with cookie
- ✅ Invalidates session after logout

### ✅ Alternative Endpoint Names
- ✅ `/api/auth/signup` (alternative to sign-up)
- ✅ `/api/auth/signin` (alternative to sign-in)
- ✅ `/api/auth/signout` (alternative to sign-out)

## Expected Response Formats

All endpoints should return responses matching the format specified in `docs/BETTER-AUTH-REMOTE-SERVER.md`:

### Success Response (200)
```json
{
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "name": "John Doe",
      "emailVerified": false,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "session": {
      "id": "session_id",
      "userId": "user_id",
      "expiresAt": "2024-01-31T00:00:00.000Z",
      "token": "session_token_here",
      "ipAddress": null,
      "userAgent": null
    }
  }
}
```

### Error Response (400/401/409)
```json
{
  "error": {
    "message": "Human-readable error message",
    "code": "ERROR_CODE"
  }
}
```

## Testing with cURL

You can also test manually using cURL:

```bash
# Sign Up
curl -X POST http://localhost:3000/api/auth/sign-up \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testPassword123","name":"Test User"}'

# Sign In
curl -X POST http://localhost:3000/api/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testPassword123"}'

# Get Session (replace TOKEN with actual token from sign-in response)
curl -X GET http://localhost:3000/api/auth/session \
  -H "Authorization: Bearer TOKEN"

# Sign Out
curl -X POST http://localhost:3000/api/auth/sign-out \
  -H "Authorization: Bearer TOKEN"
```

## Troubleshooting

### Tests fail with connection error
- Make sure the server is running on the specified port
- Check that `BETTER_AUTH_URL` matches your server URL
- Verify firewall/network settings allow connections

### Tests fail with 500 errors
- Check server logs for detailed error messages
- Verify database is accessible and migrations are run
- Ensure `BETTER_AUTH_SECRET` is set in environment

### Tests fail with CORS errors
- CORS is configured to allow all origins in development
- For production, ensure your React Native app's origin is allowed

## Integration with React Native App

Once tests pass, your standalone React Native app can use these endpoints:

```javascript
// Example: Sign Up
const response = await fetch('YOUR_SERVER_URL/api/auth/sign-up', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'securePassword123',
    name: 'John Doe'
  })
});

const { data } = await response.json();
const { user, session } = data;
// Store session.token securely (e.g., SecureStore/Keychain)

// Example: Authenticated Request
const sessionResponse = await fetch('YOUR_SERVER_URL/api/auth/session', {
  headers: {
    'Authorization': `Bearer ${session.token}`
  }
});
```

