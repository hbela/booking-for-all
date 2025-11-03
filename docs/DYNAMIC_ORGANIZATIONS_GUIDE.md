# Dynamic Organization Loading Guide

## Overview

The `connect.php` PHP proxy now supports **dynamic organization loading** from environment variables. This means you can add new organizations without modifying any code - just add the appropriate environment variables!

## How It Works

Previously, organizations were hardcoded in `connect.php`:
```php
// OLD WAY (required code changes)
$ORGANIZATION_API_KEYS["wellness"] = [...];
$ORGANIZATION_API_KEYS["medical"] = [...];
$ORGANIZATION_API_KEYS["fitness"] = [...];
```

Now, `connect.php` automatically discovers and loads organizations from environment variables matching the pattern:
- `{SLUG}_API_KEY` - The API key for the organization
- `{SLUG}_NAME` - Display name for the organization
- `{SLUG}_ORG_ID` - Organization ID from the database

```php
// NEW WAY (automatic discovery)
// Just add environment variables, no code changes needed!
```

## Environment Variable Format

For each organization, add three environment variables:

```env
# Pattern
{SLUG}_API_KEY=your_api_key
{SLUG}_NAME=Display Name
{SLUG}_ORG_ID=organization-id

# Example: Wellness Center
WELLNESS_API_KEY=0f55219535594f6b8be71094e5026e1c
WELLNESS_NAME=Wellness Center
WELLNESS_ORG_ID=8f79bdba-7095-4a47-90c7-a2e839cc413b

# Example: Spa Center (new!)
SPA_API_KEY=abc123xyz789
SPA_NAME=Spa Center
SPA_ORG_ID=spa-center-org-id
```

### Slug Naming Rules

The `slug` must:
1. Be uppercase (environment variables are case-sensitive)
2. Use underscores `_` instead of spaces
3. Be alphanumeric with underscores only
4. Match the organization identifier used in the URL

Examples:
- ✅ `WELLNESS_CENTER` → `wellness_center` (used as `?org=wellness_center`)
- ✅ `SPA` → `spa` (used as `?org=spa`)
- ✅ `MEDICAL_CLINIC` → `medical_clinic` (used as `?org=medical_clinic`)
- ❌ `Wellness Center` (use underscores)
- ❌ `wellness-center` (use underscores, not hyphens)

## Getting Started

### 1. Copy the Example File

```bash
cp connect.env.example .env
```

### 2. Get Organization Details

For each organization you want to configure, you need:
1. **API Key**: Generate in `/admin/api-keys` panel
2. **Organization ID**: Get from the database or organization admin panel
3. **Display Name**: The friendly name for the organization

### 3. Add to .env File

Add the variables for each organization:

```env
# Existing organizations
WELLNESS_API_KEY=your_wellness_api_key
WELLNESS_NAME=Wellness Center
WELLNESS_ORG_ID=wellness-org-id

MEDICAL_API_KEY=your_medical_api_key
MEDICAL_NAME=Medical Clinic
MEDICAL_ORG_ID=medical-org-id

# New organization
YOGA_STUDIO_API_KEY=your_yoga_api_key
YOGA_STUDIO_NAME=Yoga Studio
YOGA_STUDIO_ORG_ID=yoga-studio-org-id
```

### 4. Test the Configuration

Test that your organization loads correctly:

```bash
curl "http://localhost:8000/connect.php?org=yoga_studio"
```

Expected response:
```json
{
  "success": true,
  "organizationId": "yoga-studio-org-id",
  "organizationName": "Yoga Studio",
  "organization": "yoga_studio",
  "redirectUrl": "http://localhost:3001/login?org=yoga-studio-org-id"
}
```

## Adding New Organizations

### Step-by-Step Process

1. **Create Organization in Database**
   - Use your admin panel or create it programmatically
   - Note the organization ID

2. **Generate API Key**
   - Go to `/admin/api-keys`
   - Create new API key for the organization
   - Copy the generated key

3. **Add Environment Variables**
   - Open `.env` file
   - Add three variables for the new organization:
     ```env
     {SLUG}_API_KEY=generated_key
     {SLUG}_NAME=Display Name
     {SLUG}_ORG_ID=organization_id
     ```

4. **Restart PHP Server** (if needed)
   - Environment variables are loaded at runtime
   - May need to restart for changes to take effect

5. **Test**
   - Use curl or browser to test: `connect.php?org={slug}`
   - Create an external HTML file if needed

## Examples

### Example 1: Wellness Center (Existing)

```env
WELLNESS_API_KEY=0f55219535594f6b8be71094e5026e1c
WELLNESS_NAME=Wellness Center
WELLNESS_ORG_ID=8f79bdba-7095-4a47-90c7-a2e839cc413b
```

URL: `connect.php?org=wellness`

### Example 2: Adding a New Yoga Studio

```env
YOGA_STUDIO_API_KEY=abc123def456ghi789
YOGA_STUDIO_NAME=Yoga Studio & Wellness
YOGA_STUDIO_ORG_ID=yoga-studio-org-001
```

URL: `connect.php?org=yoga_studio`

### Example 3: Adding Multiple Locations

```env
# Main location
MEDICAL_CLINIC_API_KEY=medical_main_key
MEDICAL_CLINIC_NAME=Medical Clinic Downtown
MEDICAL_CLINIC_ORG_ID=medical-downtown

# Branch location
MEDICAL_BRANCH_API_KEY=medical_branch_key
MEDICAL_BRANCH_NAME=Medical Clinic Uptown
MEDICAL_BRANCH_ORG_ID=medical-uptown
```

## Troubleshooting

### Issue: "Invalid organization identifier"

**Cause**: Organization slug not found in environment variables

**Solution**: 
- Check `.env` file exists and is in the same directory as `connect.php`
- Verify variable names match the pattern: `{SLUG}_API_KEY`
- Ensure slug matches exactly (case-sensitive)

```bash
# Debug: List loaded organizations
grep _API_KEY .env
```

### Issue: "Verification failed"

**Causes**:
- API key is incorrect
- Organization ID doesn't match database
- Backend API is not running

**Solution**:
1. Verify API key in `/admin/api-keys`
2. Check organization ID matches database
3. Ensure backend is running on `VERIFY_URL`

### Issue: Organization not loading

**Cause**: Environment variables not being read

**Solution**:
1. Check `.env` file is in correct location
2. Verify file permissions
3. Restart PHP server
4. Check for syntax errors in `.env` file

## Development vs Production

### Development

```env
PHP_ENV=development

# All organizations MUST be configured in .env file
# No hardcoded fallback values
# Allows localhost origins for easier local testing
```

### Production

```env
PHP_ENV=production

# All organizations MUST be in .env file
# NO fallback values
# Strict CORS validation
# Use production API URLs
```

## Security Considerations

1. **Never commit `.env` file** to version control
2. **Use strong API keys** generated by your system
3. **Rotate keys periodically** for security
4. **Restrict CORS origins** in production
5. **Use HTTPS** for all API calls in production

## Configuration Requirements

The system requires all organizations to be configured via environment variables:
- No hardcoded values are used
- All organizations must be in `.env` file
- Existing `.env` files continue to work
- Clear error messages if organization not configured

## Benefits

✅ **No Code Changes**: Add organizations by modifying `.env` file
✅ **Zero Downtime**: No server restart needed (usually)
✅ **Flexible**: Add unlimited organizations
✅ **Type-Safe**: Clear naming conventions
✅ **Secure**: All keys in environment variables
✅ **Scalable**: Easy to manage multiple organizations

## Configuration Example

All organizations must be configured in the `.env` file. Here's an example:

```env
# Wellness Center organization
WELLNESS_API_KEY=0f55219535594f6b8be71094e5026e1c
WELLNESS_NAME=Wellness Center
WELLNESS_ORG_ID=8f79bdba-7095-4a47-90c7-a2e839cc413b

# MediCare organization
MEDICARE_API_KEY=c2dd1b9e11224274b3c7ce6a0297c5db
MEDICARE_NAME=MediCare
MEDICARE_ORG_ID=1bb85245-76d9-41e9-b86a-dec74b5d0528
```

**Important**: If an organization is not configured in the `.env` file, it will not be available and requests for that organization will fail with an error message.

## Further Reading

- [Secure External App Integration Guide](./SECURE_EXTERNAL_APP_INTEGRATION.md)
- [Security Fixes Implemented](../SECURITY_FIXES_IMPLEMENTED.md)
- `connect.env.example` - Example configuration file

