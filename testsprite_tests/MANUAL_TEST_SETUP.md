# Manual Test Setup Guide

## ✅ Setup Complete!

All test files have been restored and updated to use `auth_helper.py` for Better Auth session authentication.

## Quick Start

### Run All Tests

```bash
cd testsprite_tests
py run_tests.py
```

### Run Individual Tests

```bash
cd testsprite_tests
py TC001_get_all_organizations_should_require_admin_authentication.py
```

## Test Files Status

All 8 test files have been updated:

1. ✅ `TC001_get_all_organizations_should_require_admin_authentication.py`
2. ✅ `TC002_create_organization_should_validate_unique_name_slug_and_owner_email.py`
3. ✅ `TC003_create_organization_should_generate_temp_password_and_send_email.py`
4. ✅ `TC004_create_user_should_enforce_unique_email_and_role_mapping.py`
5. ✅ `TC005_create_user_should_generate_temp_password_and_require_password_change.py`
6. ✅ `TC006_get_all_api_keys_should_require_admin_authentication.py`
7. ✅ `TC007_generate_api_key_should_create_key_with_optional_expiration.py`
8. ✅ `TC008_delete_api_key_should_soft_delete_and_disable_key.py`

## Authentication

All tests use `auth_helper.py` which:
- ✅ Uses `requests.Session()` for cookie management
- ✅ Authenticates via Better Auth sign-in endpoint
- ✅ Automatically includes session cookies in requests
- ✅ No bearer tokens - session-based authentication only

## Current Issue

⚠️ **Cookie Domain Mismatch**: The Better Auth cookie is being set for `localhost.local/` domain, but requests are going to `localhost`. This may cause authentication issues.

**Symptoms:**
- Cookie is set: `better-auth.session_token=...`
- Cookie domain: `localhost.local`
- Requests to: `localhost:3000`
- Result: 401 Unauthorized

**Possible Solutions:**
1. Check Better Auth cookie configuration
2. Ensure cookie domain matches request domain
3. Use `localhost.local` instead of `localhost` in requests (if configured)
4. Check if Better Auth is setting cookies with correct domain/path

## Testing Authentication

Test authentication separately:

```bash
cd testsprite_tests
py -c "from auth_helper import get_admin_session; session = get_admin_session(); print('Cookies:', session.session.cookies); resp = session.get('http://localhost:3000/api/admin/organizations'); print('Status:', resp.status_code)"
```

## Documentation

- **`README_MANUAL_TESTS.md`**: Full documentation for running tests
- **`auth_helper.py`**: Authentication helper module
- **`run_tests.py`**: Test runner script

## Next Steps

1. **Debug Cookie Domain**: Investigate why cookies are set for `localhost.local` instead of `localhost`
2. **Check Better Auth Config**: Verify cookie domain/path settings in Better Auth configuration
3. **Test Authentication**: Verify authentication works with correct domain
4. **Run Tests**: Execute all tests once authentication is fixed

## Files Created/Updated

✅ `testsprite_tests/auth_helper.py` - Authentication helper  
✅ `testsprite_tests/TC001_*.py` through `TC008_*.py` - All test files  
✅ `testsprite_tests/run_tests.py` - Test runner  
✅ `testsprite_tests/README_MANUAL_TESTS.md` - Documentation  
✅ `testsprite_tests/MANUAL_TEST_SETUP.md` - This file  

