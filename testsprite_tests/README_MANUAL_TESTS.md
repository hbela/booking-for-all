# Manual Test Suite - Admin Routes

This directory contains manual test files for the admin routes that use Better Auth session-based authentication.

## Prerequisites

1. **Python 3.7+** installed
2. **requests library** installed: `pip install requests`
3. **Server running** at `http://localhost:3000`
4. **Admin user exists** in database with credentials:
   - Email: `hajzerbela@gmail.com`
   - Password: `bel2000BELLE$`

## Setup

### Install Dependencies

```bash
pip install requests
```

Or if using a virtual environment:

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install requests
```

## Running Tests

### Option 1: Run All Tests (Recommended)

Use the test runner script:

```bash
cd testsprite_tests
python run_tests.py
```

Or on Windows:
```bash
cd testsprite_tests
py run_tests.py
```

### Option 2: Run Individual Tests

Run any test file directly:

```bash
cd testsprite_tests
python TC001_get_all_organizations_should_require_admin_authentication.py
```

## Test Files

1. **TC001**: Get all organizations - requires admin authentication
2. **TC002**: Create organization - validates unique name, slug, and owner email
3. **TC003**: Create organization - generates temp password and sends email
4. **TC004**: Create user - enforces unique email and role mapping
5. **TC005**: Create user - generates temp password and requires password change
6. **TC006**: Get all API keys - requires admin authentication
7. **TC007**: Generate API key - creates key with optional expiration
8. **TC008**: Delete API key - soft deletes and disables key

## Authentication

All tests use the `auth_helper.py` module which:
- Authenticates with Better Auth using session cookies (not bearer tokens)
- Manages session cookies automatically via `requests.Session()`
- Provides a simple `get_admin_session()` function for authenticated requests

### Example Usage

```python
from auth_helper import get_admin_session, BASE_URL

# Get authenticated session
admin_session = get_admin_session()

# Make authenticated requests
response = admin_session.get(f"{BASE_URL}/api/admin/organizations")
response = admin_session.post(f"{BASE_URL}/api/admin/organizations/create", json={...})
```

## Troubleshooting

### Authentication Failures

If tests fail with 401 Unauthorized:
1. Verify the server is running at `http://localhost:3000`
2. Check that admin user exists in database
3. Verify credentials in `auth_helper.py` are correct
4. Check Better Auth configuration for cookie settings

### Import Errors

If you get `ModuleNotFoundError: No module named 'auth_helper'`:
- Make sure you're running tests from the `testsprite_tests` directory
- Or run with: `python -m testsprite_tests.TC001_...` from project root

### Server Connection Errors

If tests can't connect to server:
- Verify server is running: `curl http://localhost:3000`
- Check for firewall or proxy issues
- Verify the BASE_URL in `auth_helper.py` matches your server URL

## Test Results

Tests will output:
- ✅ PASSED: Test completed successfully
- ❌ FAILED: Test failed (check output for details)
- ⏱️ TIMEOUT: Test exceeded time limit

## Notes

- Tests may create test data (organizations, users, API keys)
- Some tests clean up after themselves, but not all
- Test data uses unique identifiers (UUIDs) to avoid conflicts
- Tests are designed to be idempotent when possible

