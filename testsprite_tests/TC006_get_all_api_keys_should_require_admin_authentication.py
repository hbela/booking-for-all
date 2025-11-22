import requests
from auth_helper import get_admin_session, BASE_URL

def test_get_all_api_keys_requires_admin_authentication():
    api_keys_url = f"{BASE_URL}/api/admin/api-keys"

    # 1. Test without authentication - expect 401 or 403
    try:
        resp_unauth = requests.get(api_keys_url, timeout=30)
        assert resp_unauth.status_code in (401, 403), f"Unauthenticated request returned {resp_unauth.status_code}, expected 401 or 403"
    except requests.RequestException as e:
        assert False, f"Request failed without authentication: {e}"

    # 2. Test with authentication - use auth_helper
    admin_session = get_admin_session()
    try:
        auth_get_resp = admin_session.get(api_keys_url)
        assert auth_get_resp.status_code == 200, f"Authenticated request failed with status code {auth_get_resp.status_code}: {auth_get_resp.text}"
        api_keys = auth_get_resp.json()
        assert isinstance(api_keys, list), "Response JSON is not a list"
        for key in api_keys:
            assert "id" in key, "Missing 'id' in API key item"
            assert "name" in key, "Missing 'name' in API key item"
            assert "prefix" in key, "Missing 'prefix' in API key item"
            assert "user" in key and isinstance(key["user"], dict), "Missing or invalid 'user' in API key item"
    except requests.RequestException as e:
        assert False, f"Request failed during authenticated API keys fetch: {e}"
    finally:
        admin_session.session.close()

test_get_all_api_keys_requires_admin_authentication()
