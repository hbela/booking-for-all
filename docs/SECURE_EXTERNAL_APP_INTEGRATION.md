# Secure External App Integration Guide

## Security Issue Fixed

**Problem**: The original `test-external-app.html` had a serious security vulnerability where the API key was hardcoded and exposed in the browser, making it easily stealable.

**Solution**: Created a secure PHP proxy (`connect.php`) that handles API keys server-side and supports multiple organizations.

## Architecture Overview

```
External HTML App → PHP Proxy (connect.php) → Express API → Database
```

### Security Benefits

1. **API Keys Never Exposed**: API keys are stored server-side in the PHP proxy
2. **Organization Isolation**: Each organization has its own API key
3. **Centralized Management**: Single PHP file handles multiple organizations
4. **No Client-Side Secrets**: Only organization identifiers are exposed to browsers

## File Structure

```
├── connect.php                    # Secure PHP proxy (handles multiple orgs)
├── test-external-app.html         # Updated external app (uses proxy)
├── wellness_external.html         # Wellness Center specific app
├── medicare_external.html         # MediCare specific app
└── docs/SECURE_EXTERNAL_APP_INTEGRATION.md
```

## How It Works

### 1. PHP Proxy (`connect.php`)

The proxy handles multiple organizations and their API keys:

```php
$ORGANIZATION_API_KEYS = [
    "wellness" => [
        "api_key" => "YOUR_WELLNESS_API_KEY",
        "name" => "Wellness Center",
        "organization_id" => "org_wellness_001"
    ],
    "medical" => [
        "api_key" => "YOUR_MEDICAL_API_KEY", 
        "name" => "Medical Clinic",
        "organization_id" => "org_medical_001"
    ]
];
```

**Organization Identification Methods:**
- URL parameter: `connect.php?org=wellness`
- POST data: `org=wellness`
- Custom header: `X-Organization-ID: wellness`

### 2. External HTML Apps

Each organization can have its own HTML file:

- `test-external-app.html` - Generic external app
- `wellness_external.html` - Wellness Center specific app
- `medicare_external.html` - MediCare specific app
- `medical_external.html` - Medical Clinic specific app (create as needed)

**Key Changes:**
- Removed hardcoded API keys
- Added organization identifier (safe to expose)
- Updated to use PHP proxy

```javascript
// Before (INSECURE)
const API_KEY = "68bfa972bb73a57c8932d75b29ebf0fa:...";

// After (SECURE)
const ORGANIZATION_ID = "wellness"; // Safe to expose
```

## Setup Instructions

### 1. Configure PHP Proxy

`connect.php` now automatically loads organizations from environment variables. No code changes needed!

Simply add environment variables to your `.env` file in the following format:

```env
# For each organization, add these variables:
WELLNESS_API_KEY=your_actual_wellness_api_key_here
WELLNESS_NAME=Wellness Center
WELLNESS_ORG_ID=8f79bdba-7095-4a47-90c7-a2e839cc413b

MEDICAL_API_KEY=your_actual_medical_api_key_here
MEDICAL_NAME=Medical Clinic
MEDICAL_ORG_ID=another-organization-id-here

FITNESS_API_KEY=your_actual_fitness_api_key_here
FITNESS_NAME=Fitness Center
FITNESS_ORG_ID=yet-another-org-id
```

The format is: `{SLUG}_API_KEY`, `{SLUG}_NAME`, and `{SLUG}_ORG_ID`

### 2. Create Organization-Specific HTML Files

For each organization, create a dedicated HTML file:

```html
<!-- medical_external.html -->
<script>
  const ORGANIZATION_ID = "medical"; // Change this per organization
  
  async function connectToOrganization() {
    const response = await fetch(`connect.php?org=${ORGANIZATION_ID}`);
    // ... rest of the code
  }
</script>
```

### 3. Generate API Keys

Use your admin panel to generate API keys for each organization:

1. Go to `/admin/api-keys`
2. Generate new API key for each organization
3. Update the `connect.php` file with the actual API keys

## Production Considerations

### 1. Environment Variables

`connect.php` automatically uses environment variables! Just configure your `.env` file:

```env
# Production environment variables
PHP_ENV=production
VERIFY_URL=https://your-api-domain.com/api/external/verify
FRONTEND_REDIRECT=https://your-frontend-domain.com/login
ALLOWED_CORS_ORIGINS=https://your-allowed-domain.com

# Organization configurations (automatically loaded)
WELLNESS_API_KEY=your_production_api_key
WELLNESS_NAME=Wellness Center
WELLNESS_ORG_ID=production-organization-id

MEDICAL_API_KEY=another_production_api_key
MEDICAL_NAME=Medical Clinic
MEDICAL_ORG_ID=another-production-org-id
```

The proxy automatically discovers and loads all organizations from environment variables matching the `{SLUG}_API_KEY` pattern.

### 2. Database Storage

For better security, store API keys in the database:

```php
// connect.php (Database version)
$organizationId = $_GET['org'];
$apiKeyRecord = $pdo->prepare("SELECT * FROM api_keys WHERE organization_id = ?");
$apiKeyRecord->execute([$organizationId]);
$apiKey = $apiKeyRecord->fetch()['key'];
```

### 3. HTTPS Only

Ensure all communications use HTTPS in production.

### 4. CORS Configuration

Update CORS headers for production:

```php
header("Access-Control-Allow-Origin: https://yourdomain.com");
```

## Testing

### 1. Test Organization Connection

```bash
# Test wellness organization
curl "http://localhost/connect.php?org=wellness"

# Test medical organization  
curl "http://localhost/connect.php?org=medical"
```

### 2. Test HTML Apps

1. Open `test-external-app.html` in browser
2. Click "Connect to Organization"
3. Verify redirect to booking system

### 3. Test Error Handling

```bash
# Test invalid organization
curl "http://localhost/connect.php?org=invalid"
```

## Security Checklist

- [x] API keys removed from client-side code
- [x] PHP proxy handles API key management
- [x] Organization identifiers are safe to expose
- [x] Error handling prevents information leakage
- [x] CORS headers configured appropriately
- [x] HTTPS enforced in production
- [x] API keys stored securely (environment variables or database)

## Adding New Organizations

Now you can add new organizations **dynamically** without modifying code:

1. **Generate API Key**: Use admin panel (`/admin/api-keys`) to create API key for new organization
2. **Add Environment Variables**: Add the following to your `.env` file (replace `{slug}` with your organization slug):
   ```env
   {SLUG}_API_KEY=generated_api_key_here
   {SLUG}_NAME=Display Name Here
   {SLUG}_ORG_ID=organization-id-from-database
   ```
   Example for a "Spa Center":
   ```env
   SPA_API_KEY=abc123xyz789
   SPA_NAME=Spa Center
   SPA_ORG_ID=spa-center-org-id
   ```
3. **Create HTML App**: Create organization-specific HTML file (optional but recommended)
4. **Test Integration**: Verify the new organization works by calling `connect.php?org={slug}`

**No code changes required!** `connect.php` automatically discovers and loads all organizations from environment variables.

## Troubleshooting

### Common Issues

1. **"Invalid organization identifier"**
   - Check organization slug in HTML file matches environment variable naming
   - Verify environment variables exist in `.env` file: `{SLUG}_API_KEY`, `{SLUG}_NAME`, `{SLUG}_ORG_ID`

2. **"Verification failed"**
   - Check API key is correct in `.env` file
   - Verify Express API is running and accessible
   - Check API key is active in database (via `/admin/api-keys`)
   - Ensure organization ID from `.env` matches the one in database

3. **CORS errors**
   - Update CORS headers in `connect.php`
   - Ensure proper domain configuration

### Debug Mode

Add debug logging to `connect.php`:

```php
error_log("Organization: " . $organizationId);
error_log("API Key: " . substr($apiKey, 0, 10) . "...");
error_log("Response: " . $response);
```

## Migration from Insecure Version

If you have existing external apps with hardcoded API keys:

1. **Backup existing files**
2. **Update HTML files** to use organization identifiers
3. **Configure PHP proxy** with organization API keys
4. **Test thoroughly** before deploying
5. **Remove old API keys** from client-side code

This secure architecture ensures that API keys are never exposed to browsers while supporting multiple organizations through a single, maintainable PHP proxy.
