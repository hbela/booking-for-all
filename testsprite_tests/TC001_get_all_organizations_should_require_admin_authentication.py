import requests
from auth_helper import get_admin_session, BASE_URL

ADMIN_ORGS_ENDPOINT = f"{BASE_URL}/api/admin/organizations"


def test_get_all_organizations_requires_admin_authentication():
    timeout = 30

    # Unauthenticated request - expect 401 or 403
    try:
        unauth_resp = requests.get(ADMIN_ORGS_ENDPOINT, timeout=timeout)
        assert unauth_resp.status_code in (401, 403), f"Expected 401 or 403 for unauthenticated request, got {unauth_resp.status_code}"
    except requests.RequestException as e:
        assert False, f"Unauthenticated request failed: {e}"

    # Authenticated request with valid admin session - expect 200 and valid data
    admin_session = get_admin_session()
    try:
        orgs_resp = admin_session.get(ADMIN_ORGS_ENDPOINT)
        assert orgs_resp.status_code == 200, f"Expected 200 for authenticated request, got {orgs_resp.status_code}: {orgs_resp.text}"
        orgs_json = orgs_resp.json()
        assert isinstance(orgs_json, list), "Response is not a list"

        # Validate fields in each organization object if any returned
        for org in orgs_json:
            assert isinstance(org, dict), "Organization item is not an object"
            for field in ['id', 'name', 'slug', 'enabled', 'createdAt']:
                assert field in org, f"Missing field '{field}' in organization item"
            assert isinstance(org['id'], str), "'id' is not a string"
            assert isinstance(org['name'], str), "'name' is not a string"
            assert isinstance(org['slug'], str), "'slug' is not a string"
            assert isinstance(org['enabled'], bool), "'enabled' is not a boolean"
            assert isinstance(org['createdAt'], str), "'createdAt' is not a string"
    finally:
        admin_session.session.close()


test_get_all_organizations_requires_admin_authentication()
