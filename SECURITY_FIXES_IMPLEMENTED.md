# Security Fixes Implemented - Critical Items

This document outlines the critical security fixes that have been implemented for the `wellness_external.html` endpoint and related infrastructure.

## ✅ Completed Fixes

### 1. CORS Restrictions (CRITICAL)
**Status**: ✅ Implemented

**Changes Made**:
- Modified `connect.php` to restrict CORS to specific allowed origins
- Added `ALLOWED_CORS_ORIGINS` environment variable support
- Origin validation before processing requests
- Returns 403 Forbidden for disallowed origins

**Configuration**:
- Set `ALLOWED_CORS_ORIGINS` in `.env` file (comma-separated list)
- Default: `http://localhost:3001,http://localhost:5173` (development only)

**Before**:
```php
header("Access-Control-Allow-Origin: *"); // Allows any origin
```

**After**:
```php
// Validates origin against whitelist
if (in_array($requestOrigin, $allowedOriginsArray)) {
    header("Access-Control-Allow-Origin: " . $requestOrigin);
} else {
    http_response_code(403);
    exit;
}
```

---

### 2. API Keys Moved to Environment Variables (CRITICAL)
**Status**: ✅ Implemented

**Changes Made**:
- Removed hardcoded API keys from `connect.php`
- Implemented `.env` file loading function
- API keys now loaded from environment variables

**Environment Variables Required**:
- `WELLNESS_API_KEY` - Wellness Center API key
- `MEDICAL_API_KEY` - Medical Clinic API key (optional)
- `FITNESS_API_KEY` - Fitness Center API key (optional)
- Additional org-specific variables for names and IDs

**Setup**:
1. Copy `.env.php.example` to `.env` in the same directory as `connect.php`
2. Fill in your actual API keys
3. **NEVER commit `.env` to version control**

**Before**:
```php
$ORGANIZATION_API_KEYS = [
    "wellness" => [
        "api_key" => "0f55219535594f6b8be71094e5026e1c", // Hardcoded!
        ...
    ]
];
```

**After**:
```php
$wellnessApiKey = getenv('WELLNESS_API_KEY');
if ($wellnessApiKey) {
    $ORGANIZATION_API_KEYS["wellness"] = [
        "api_key" => $wellnessApiKey, // From environment
        ...
    ];
}
```

---

### 3. Debug Information Removed (CRITICAL)
**Status**: ✅ Implemented

**Changes Made**:
- Removed debug logging from production responses
- Removed organization enumeration from error messages
- Removed sensitive details from API error responses
- Added `PHP_ENV` environment variable to control debug mode

**Production Behavior**:
- Generic error messages only: "Invalid or missing organization identifier"
- No list of available organizations
- No API response details in errors
- Debug logging only when `PHP_ENV=development`

**Before**:
```php
error_log("PHP Debug - Available organizations: " . implode(', ', array_keys($ORGANIZATION_API_KEYS)));
echo json_encode([
    "debug" => [
        "organizationId" => $organizationId,
        "available_organizations" => array_keys($ORGANIZATION_API_KEYS) // Exposes orgs!
    ]
]);
```

**After**:
```php
// Only log in development
if (getenv('PHP_ENV') === 'development') {
    error_log("PHP Debug - Organization ID: " . ($organizationId ?? 'null'));
}

echo json_encode([
    "success" => false,
    "message" => "Invalid or missing organization identifier" // Generic message
]);
```

---

### 4. Rate Limiting Added (CRITICAL)
**Status**: ✅ Implemented

**Changes Made**:
- Added `@fastify/rate-limit` to Fastify external routes
- Per-route rate limiting configuration
- Stricter limits for `/api/external/verify` endpoint
- Rate limiting by IP address and API key combination

**Configuration**:
- Default: 5 requests per minute for `/verify` endpoint
- Default: 20 requests per minute for `/validate-session` endpoint
- Configurable via environment variables

**Environment Variables**:
- `RATE_LIMIT_VERIFY_MAX` - Max requests for verify (default: 5)
- `RATE_LIMIT_VERIFY_WINDOW` - Time window (default: "1 minute")
- `RATE_LIMIT_VALIDATE_MAX` - Max requests for validate (default: 20)
- `RATE_LIMIT_VALIDATE_WINDOW` - Time window (default: "1 minute")

**Implementation**:
```typescript
await app.register(rateLimit, {
  global: false, // Per-route configuration
  keyGenerator: (req) => {
    const apiKey = req.headers['x-api-key'] as string;
    const ip = req.ip || 'unknown';
    return apiKey ? `${ip}:${apiKey}` : ip;
  },
});

app.get('/verify', {
  config: {
    rateLimit: {
      max: 5,
      timeWindow: '1 minute',
    }
  }
}, ...);
```

**Response on Rate Limit Exceeded**:
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again after X seconds.",
  "retryAfter": X
}
```

---

### 5. Input Validation and Sanitization (BONUS)
**Status**: ✅ Implemented

**Changes Made**:
- Added input sanitization for organization IDs
- Regex validation: only alphanumeric, underscore, and hyphen allowed
- Prevents injection attacks and malformed input

**Before**:
```php
$organizationId = $_GET['org']; // Direct use, no validation
```

**After**:
```php
$organizationId = filter_var(trim($_GET['org']), FILTER_SANITIZE_STRING);
if (!preg_match('/^[a-z0-9_-]+$/i', $organizationId)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Invalid format"]);
    exit;
}
```

---

## 📋 Configuration Files

### `.env.php.example`
Template file showing all required environment variables. Copy to `.env` and fill in values.

### Updated Files
1. `connect.php` - All security fixes applied
2. `apps/server/src/features/external/routes.ts` - Rate limiting added

---

## 🔧 Setup Instructions

### 1. PHP Configuration (.env file)
```bash
# In the directory containing connect.php
cp .env.php.example .env
# Edit .env and add your actual API keys
```

### 2. Server Configuration (Optional)
Add to `apps/server/.env` for rate limiting customization:
```env
RATE_LIMIT_VERIFY_MAX=5
RATE_LIMIT_VERIFY_WINDOW=1 minute
RATE_LIMIT_VALIDATE_MAX=20
RATE_LIMIT_VALIDATE_WINDOW=1 minute
```

### 3. Verify Setup
1. Ensure `.env` file exists (not committed to git)
2. Test CORS restrictions from allowed origins
3. Test rate limiting by making multiple rapid requests
4. Verify debug info is not exposed in production

---

## 🧪 Testing

### Test CORS Restrictions
```bash
# Should work (if origin is in ALLOWED_CORS_ORIGINS)
curl -H "Origin: http://localhost:3001" http://localhost:8000/connect.php?org=wellness

# Should fail (403)
curl -H "Origin: http://evil-site.com" http://localhost:8000/connect.php?org=wellness
```

### Test Rate Limiting
```bash
# Make 6 requests rapidly - 6th should fail with 429
for i in {1..6}; do
  curl http://localhost:3000/api/external/verify \
    -H "X-API-Key: your_key_here"
done
```

### Test Input Validation
```bash
# Should fail (400) - invalid characters
curl http://localhost:8000/connect.php?org="<script>alert('xss')</script>"
```

---

## 📝 Notes

1. **Development vs Production**:
   - Set `PHP_ENV=production` in production
   - Use `PHP_ENV=development` only in local development
   - This controls debug logging visibility

2. **Environment Variables**:
   - PHP `.env` file is separate from Node.js `.env`
   - Both serve different purposes
   - Keep both secure and never commit them

3. **Rate Limiting**:
   - Currently uses in-memory storage
   - For multi-instance deployments, consider Redis backend
   - Adjust limits based on your traffic patterns

4. **CORS Origins**:
   - Update `ALLOWED_CORS_ORIGINS` for each environment
   - Use HTTPS origins in production
   - Never use wildcard (`*`) in production

---

## ✅ Security Checklist

- [x] CORS restricted to specific origins
- [x] API keys moved to environment variables
- [x] Debug information removed from production
- [x] Rate limiting implemented
- [x] Input validation added
- [x] Error messages sanitized
- [ ] HTTPS enforced (to be implemented)
- [ ] CSRF protection (future enhancement)
- [ ] Authentication added (future enhancement)

---

## 🚀 Next Steps (Future Enhancements)

1. **HTTPS Enforcement**: Redirect HTTP to HTTPS in production
2. **CSRF Protection**: Add CSRF tokens to requests
3. **Authentication**: Require user authentication before connecting
4. **Request Logging**: Add audit trail for security monitoring
5. **Redis Rate Limiting**: Use Redis for distributed rate limiting

---

**Last Updated**: After implementing critical security fixes
**Status**: ✅ Critical security vulnerabilities addressed

