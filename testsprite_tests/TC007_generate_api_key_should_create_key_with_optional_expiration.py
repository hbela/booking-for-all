import requests
import uuid
from auth_helper import get_admin_session, BASE_URL

def test_generate_api_key_should_create_key_with_optional_expiration():
    # Get authenticated admin session using auth_helper
    admin_session = get_admin_session()

    # Step 1: Get organizations to acquire a valid organizationId
    orgs_resp = admin_session.get(f"{BASE_URL}/api/admin/organizations")
    assert orgs_resp.status_code == 200, f"Failed to get organizations: {orgs_resp.text}"
    organizations = orgs_resp.json()
    assert isinstance(organizations, list) and len(organizations) > 0, "No organizations found to generate API key"

    organization_id = organizations[0].get("id")
    assert organization_id and isinstance(organization_id, str), "Invalid organization ID obtained"

    api_key_id = None

    # Prepare API key generation payload with optional expiresInDays
    api_key_name = f"test-key-{uuid.uuid4()}"

    payload = {
        "organizationId": organization_id,
        "name": api_key_name,
        "expiresInDays": 7  # Optional expiration, testing with 7 days
    }

    try:
        # Generate API key
        gen_resp = admin_session.post(
            f"{BASE_URL}/api/admin/api-keys/generate",
            json=payload
        )
        assert gen_resp.status_code == 200, f"API key generation failed: {gen_resp.text}"
        json_data = gen_resp.json()
        assert "id" in json_data and isinstance(json_data["id"], str), "API key id missing or invalid in response"
        assert "key" in json_data and isinstance(json_data["key"], str) and len(json_data["key"]) > 0, "API key string missing or invalid"

        api_key_id = json_data["id"]

    finally:
        # Cleanup: revoke/delete the API key after test if it was created
        if api_key_id:
            del_resp = admin_session.delete(
                f"{BASE_URL}/api/admin/api-keys/{api_key_id}"
            )
            # For cleanup we tolerate 200 or 404 (if already deleted)
            assert del_resp.status_code in (200, 404), f"Failed to revoke API key: {del_resp.text}"

test_generate_api_key_should_create_key_with_optional_expiration()
