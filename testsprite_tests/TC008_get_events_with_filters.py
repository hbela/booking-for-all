import requests
from urllib.parse import urljoin

BASE_URL = "http://localhost:3000/features/admin"
AUTH_URL = "http://localhost:3000/api/auth/sign-in/email"
EVENTS_URL = "http://localhost:3000/api/events"
PROVIDERS_URL = "http://localhost:3000/api/providers"

EMAIL = "elysprovider1@gmail.com"
PASSWORD = "bel2000BELLE$"

def test_get_events_with_filters():
    session = requests.Session()
    # Authenticate and obtain session cookies
    auth_response = session.post(
        AUTH_URL,
        json={"email": EMAIL, "password": PASSWORD},
        timeout=30
    )
    assert auth_response.status_code == 200, f"Auth failed: {auth_response.text}"

    # Get authenticated userId from providers endpoint by filtering with user email lookup
    providers_resp = session.get(PROVIDERS_URL, timeout=30)
    assert providers_resp.status_code == 200, f"Fetching providers failed: {providers_resp.text}"
    providers = providers_resp.json()
    user_id = None
    for p in providers:
        if 'user' in p and p['user'].get('email') == EMAIL:
            user_id = p.get('userId')
            provider_id = p.get('id')
            break
    assert user_id is not None, "Could not determine authenticated user's userId"
    assert provider_id is not None, "Could not determine authenticated user's providerId"

    # Prepare filter sets for testing
    filters_list = [
        {"providerId": provider_id},
    ]

    # Add departmentId and organizationId filters if available
    department_id = None
    organization_id = None
    for p in providers:
        if 'user' in p and p['user'].get('email') == EMAIL:
            department_id = p.get('departmentId')
            if 'department' in p and p['department']:
                org = p['department'].get('organization')
                if org and 'id' in org:
                    organization_id = org['id']
            break

    if department_id:
        filters_list.append({"departmentId": department_id})
    if organization_id:
        filters_list.append({"organizationId": organization_id})

    filters_list.append({"available": "true"})

    combined_filters = {"providerId": provider_id}
    if department_id:
        combined_filters["departmentId"] = department_id
    if organization_id:
        combined_filters["organizationId"] = organization_id
    combined_filters["available"] = "true"
    filters_list.append(combined_filters)

    # Send GET requests with each filter and validate
    for filters in filters_list:
        resp = session.get(EVENTS_URL, params=filters, timeout=30)
        assert resp.status_code == 200, f"GET /api/events failed with filters {filters}: {resp.text}"
        events = resp.json()
        assert isinstance(events, list), f"Response is not a list for filters {filters}"

        for event in events:
            assert 'id' in event and isinstance(event['id'], str)
            assert 'providerId' in event and isinstance(event['providerId'], str)
            assert 'start' in event and 'end' in event
            if 'providerId' in filters:
                assert event['providerId'] == filters['providerId'], f"Event providerId mismatch filter {filters}"
            if 'departmentId' in filters:
                dept_id = None
                if 'provider' in event and 'department' in event['provider']:
                    dept_id = event['provider']['department'].get('id')
                assert dept_id == filters['departmentId'], f"Event departmentId mismatch filter {filters}"
            if 'organizationId' in filters:
                org_id = None
                if 'provider' in event and 'department' in event['provider']:
                    org = event['provider']['department'].get('organization')
                    if org and 'id' in org:
                        org_id = org.get('id')
                # Skip assertion if organization is missing
                if org_id is not None:
                    assert org_id == filters['organizationId'], f"Event organizationId mismatch filter {filters}"
            if 'available' in filters and filters['available'] == "true":
                assert event.get('isBooked') is False, f"Event booked mismatch for filter {filters}"
                assert isinstance(event['start'], str) and len(event['start']) > 0, "Invalid start datetime"
    session.close()

test_get_events_with_filters()
