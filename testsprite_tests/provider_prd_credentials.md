# Provider Routes - Test Credentials

## Primary Test User (Provider Role)

**User:** Jones Doe  
**Email:** `elysprovider1@gmail.com`  
**Password:** `bel2000BELLE$`  
**Role:** `PROVIDER`

### Access Level

✅ **Can Test:**
- GET `/api/providers` - List providers (any authenticated user)
- GET `/api/providers/:id` - Get provider by ID (any authenticated user)

❌ **Cannot Test (Requires OWNER role):**
- POST `/api/providers/create-user` - Create provider with user account
- POST `/api/providers` - Create provider record
- DELETE `/api/providers/:id` - Delete provider

## Notes

- The provider user (`elysprovider1@gmail.com`) has PROVIDER role
- GET endpoints work with any authenticated user (including PROVIDER role)
- POST/DELETE endpoints require OWNER role (`requireOwnerHook`)
- To test POST/DELETE endpoints, you need a user with OWNER role who is also a member of an organization

## Alternative Credentials for Full Testing

If you need to test POST/DELETE endpoints, use a user with OWNER role:
- **Email:** (admin user or owner user)
- **Password:** (corresponding password)
- **Role:** `OWNER`

The admin user (`hajzerbela@gmail.com`) has ADMIN role, not OWNER role, so they also cannot test POST/DELETE provider endpoints unless they also have OWNER role in the organization.

