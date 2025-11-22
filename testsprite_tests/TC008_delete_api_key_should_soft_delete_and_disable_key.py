import requests
import uuid
from auth_helper import get_admin_session, BASE_URL

def test_TC008_delete_api_key_should_soft_delete_and_disable_key():
    admin_api_base = f"{BASE_URL}/api/admin"

    # Get authenticated admin session using auth_helper
    admin_session = get_admin_session()

    key_id = None
    organization_id = None

    try:
        # Get organizations to find an organizationId for API key generation
        orgs_resp = admin_session.get(f"{admin_api_base}/organizations")
        assert orgs_resp.status_code == 200, f"Failed to get organizations: {orgs_resp.text}"
        orgs = orgs_resp.json()
        assert isinstance(orgs, list) and len(orgs) > 0, "No organizations available to create API key"
        organization_id = orgs[0].get("id")
        assert organization_id and isinstance(organization_id, str), "Invalid organization ID"

        # Generate an API key for deletion test
        gen_payload = {
            "organizationId": organization_id,
            "name": f"test-delete-key-{uuid.uuid4()}"
        }
        gen_resp = admin_session.post(f"{admin_api_base}/api-keys/generate", json=gen_payload)
        assert gen_resp.status_code == 200, f"Failed to generate API key: {gen_resp.text}"
        gen_data = gen_resp.json()
        key_id = gen_data.get("id")
        assert key_id and isinstance(key_id, str), "API key ID missing in generate response"

        # Delete (soft-delete) the API key
        del_resp = admin_session.delete(f"{admin_api_base}/api-keys/{key_id}")
        assert del_resp.status_code == 200, f"Failed to delete API key: {del_resp.text}"
        del_json = del_resp.json()
        assert isinstance(del_json, dict), "Delete response is not a JSON object"
        assert del_json.get("success") is True, "Delete success flag is not True"

        # Verify the API key is disabled by fetching all API keys and checking the enabled flag
        keys_resp = admin_session.get(f"{admin_api_base}/api-keys")
        assert keys_resp.status_code == 200, f"Failed to get API keys: {keys_resp.text}"
        keys_list = keys_resp.json()
        assert isinstance(keys_list, list), "API keys response is not a list"

        # Find the deleted key and check enabled is False
        matching_keys = [k for k in keys_list if k.get("id") == key_id]
        assert len(matching_keys) == 1, "Deleted API key not found in API keys list"
        assert matching_keys[0].get("enabled") is False, "API key not soft deleted (enabled still True)"

    finally:
        # Clean up - attempt to delete the API key if still enabled or present
        if key_id is not None:
            try:
                keys_resp = admin_session.get(f"{admin_api_base}/api-keys")
                if keys_resp.status_code == 200:
                    keys_list = keys_resp.json()
                    matching_keys = [k for k in keys_list if k.get("id") == key_id]
                    if matching_keys and matching_keys[0].get("enabled") is True:
                        admin_session.delete(f"{admin_api_base}/api-keys/{key_id}")
            except Exception:
                pass

test_TC008_delete_api_key_should_soft_delete_and_disable_key()
