import requests
from urllib.parse import urljoin

BASE_URL = "http://localhost:3000/features/admin"
AUTH_URL = "http://localhost:3000/api/auth/sign-in/email"
PROVIDERS_LIST_PATH = "/api/providers"
PROVIDER_BY_ID_PATH = "/api/providers/"

EMAIL = "elysprovider1@gmail.com"
PASSWORD = "bel2000BELLE$"
TIMEOUT = 30

def test_get_providers_with_filters_and_by_id():
    session = requests.Session()
    # Authenticate via session-based login to get auth cookies
    auth_resp = session.post(
        AUTH_URL,
        json={"email": EMAIL, "password": PASSWORD},
        timeout=TIMEOUT,
    )
    assert auth_resp.status_code == 200, f"Authentication failed: {auth_resp.text}"

    # Extract userId from provider record to use as filter
    # Get provider info by filtering /api/providers?userId=<userId>
    # First get all providers without filters to find provider for this user
    providers_resp = session.get(
        urljoin("http://localhost:3000", PROVIDERS_LIST_PATH),
        timeout=TIMEOUT,
        params={"userId": None}
    )
    assert providers_resp.status_code == 200, f"Failed to retrieve providers list: {providers_resp.text}"
    providers_data = providers_resp.json()
    assert isinstance(providers_data, list), "Providers list is not an array"

    # Find provider matching authenticated user email
    provider = None
    for p in providers_data:
        user_obj = p.get("user", {})
        if user_obj.get("email") == EMAIL:
            provider = p
            break
    assert provider is not None, "Authenticated user's provider record not found"
    user_id = provider.get("userId")
    provider_id = provider.get("id")
    assert user_id, "Provider userId missing"
    assert provider_id, "Provider id missing"

    # Test retrieving provider list with userId filter
    filtered_resp = session.get(
        urljoin("http://localhost:3000", PROVIDERS_LIST_PATH),
        params={"userId": user_id},
        timeout=TIMEOUT,
    )
    assert filtered_resp.status_code == 200, f"Failed filtered providers retrieval: {filtered_resp.text}"
    filtered_list = filtered_resp.json()
    assert isinstance(filtered_list, list), "Filtered providers response is not a list"
    # Verify returned providers all have that userId
    for prov in filtered_list:
        assert prov.get("userId") == user_id, f"Returned provider with wrong userId: {prov}"

    # Test retrieving specific provider by valid ID
    provider_by_id_resp = session.get(
        urljoin("http://localhost:3000", PROVIDER_BY_ID_PATH + provider_id),
        timeout=TIMEOUT,
    )
    assert provider_by_id_resp.status_code == 200, f"Failed retrieving provider by ID: {provider_by_id_resp.text}"
    provider_by_id_data = provider_by_id_resp.json()
    assert provider_by_id_data.get("id") == provider_id, "Returned provider ID mismatch"
    assert provider_by_id_data.get("userId") == user_id, "Returned provider userId mismatch"
    user_data = provider_by_id_data.get("user", {})
    assert user_data.get("email") == EMAIL, "Returned provider user email mismatch"

    # Test retrieving provider by non-existing ID returns 404
    fake_provider_id = "nonexistentproviderid1234567890"
    not_found_resp = session.get(
        urljoin("http://localhost:3000", PROVIDER_BY_ID_PATH + fake_provider_id),
        timeout=TIMEOUT,
    )
    assert not_found_resp.status_code == 404, f"Expected 404 for non-existing provider ID, got {not_found_resp.status_code}"
    json_not_found = not_found_resp.json()
    # Check error message presence
    error_msg = json_not_found.get("error")
    assert error_msg is not None, "Error message missing in 404 response for provider not found"

test_get_providers_with_filters_and_by_id()