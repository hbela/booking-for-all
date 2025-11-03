# Organization Creation Workflow Checklist

## MediCare Organization - Complete Setup Verification

### ✅ Completed Steps

1. **Organization Created in Admin Panel**
   - Name: MediCare
   - Slug: medicare
   - Organization ID: `1bb85245-76d9-41e9-b86a-dec74b5d0528`

2. **Owner Account Created**
   - Email: hausermaximilien@gmail.com
   - Role: OWNER
   - Temporary password sent

3. **External HTML Website Created**
   - File: `medicare_external.html`
   - Organization ID: `medicare`
   - URL: `http://localhost:8000/medicare_external.html`

4. **API Key Generated**
   - API Key: `c2dd1b9e11224274b3c7ce6a0297c5db`

5. **Welcome Email Configuration**
   - Owner email points to: `http://localhost:8000/medicare_external.html`
   - Provider emails dynamically use organization slug

### ⚠️ CRITICAL: Two Environment Files Required

#### File 1: `apps/server/.env` (Node.js Server)
```env
# Server configuration
PORT=3000
DATABASE_URL="file:C:/sqlite/db/express.db"
AUTH_SECRET="your-super-secret-key-change-this-in-production"
CORS_ORIGIN="http://localhost:5173"

# Email configuration
RESEND_API_KEY="re_your_api_key_here"
RESEND_FROM_EMAIL="support@tanarock.hu"

# PHP server URL for external HTML pages
PHP_SERVER_URL="http://localhost:8000"
```

#### File 2: `.env` in project root (PHP Proxy)
```env
# PHP Proxy configuration
PHP_ENV=development
VERIFY_URL=http://localhost:3000/api/external/verify
FRONTEND_REDIRECT=http://localhost:3001/login
ALLOWED_CORS_ORIGINS=http://localhost:3001,http://localhost:5173

# Organization API Keys (for connect.php)
MEDICARE_API_KEY=c2dd1b9e11224274b3c7ce6a0297c5db
MEDICARE_NAME=MediCare
MEDICARE_ORG_ID=1bb85245-76d9-41e9-b86a-dec74b5d0528

# Other organizations
WELLNESS_API_KEY=0f55219535594f6b8be71094e5026e1c
WELLNESS_NAME=Wellness Center
WELLNESS_ORG_ID=8f79bdba-7095-4a47-90c7-a2e839cc413b
```

**IMPORTANT:** Your workflow summary mentioned "Populate the .env of the server". You need to populate **BOTH** `.env` files:

- ✅ `apps/server/.env` - Already included `PHP_SERVER_URL`
- ❌ **MISSING**: Project root `.env` - Needs MEDICARE_API_KEY, MEDICARE_NAME, MEDICARE_ORG_ID

### Testing the Workflow

1. **Test External HTML Page**
   ```bash
   curl "http://localhost:8000/medicare_external.html"
   ```

2. **Test PHP Proxy**
   ```bash
   curl "http://localhost:8000/connect.php?org=medicare"
   ```
   
   Expected response:
   ```json
   {
     "success": true,
     "organizationId": "1bb85245-76d9-41e9-b86a-dec74b5d0528",
     "organizationName": "MediCare",
     "organization": "medicare",
     "redirectUrl": "http://localhost:3001/login?org=1bb85245-76d9-41e9-b86a-dec74b5d0528"
   }
   ```

3. **Test Email Access**
   - Open email sent to hausermaximilien@gmail.com
   - Click "Access Your Organization Portal"
   - Should redirect to `http://localhost:8000/medicare_external.html`

### Summary

Your workflow is **ALMOST complete** but missing one critical step:

**MISSING:** Create `.env` file in project root with MediCare configuration for `connect.php`

**To Complete:**
1. Copy `connect.env.example` to `.env` in project root:
   ```bash
   copy connect.env.example .env
   ```
2. Add MediCare configuration to the `.env` file:
   ```env
   MEDICARE_API_KEY=c2dd1b9e11224274b3c7ce6a0297c5db
   MEDICARE_NAME=MediCare
   MEDICARE_ORG_ID=1bb85245-76d9-41e9-b86a-dec74b5d0528
   ```
3. Restart PHP server if it's running (so it reloads the `.env` file)

### Why Two .env Files?

- **`apps/server/.env`**: Configuration for Node.js/Express server (database, email, ports)
- **`.env` (root)**: Configuration for PHP proxy `connect.php` (organization API keys)

They serve different systems and cannot be combined!

