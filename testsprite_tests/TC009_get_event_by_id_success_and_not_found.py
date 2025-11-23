import requests
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

BASE_URL = "http://localhost:3000/features/admin"
AUTH_URL = "http://localhost:3000/api/auth/sign-in/email"
PROVIDERS_URL = "http://localhost:3000/api/providers"
EVENTS_URL = "http://localhost:3000/api/events"
PROVIDER_EVENTS_URL = "http://localhost:3000/api/provider/events"

EMAIL = "elysprovider1@gmail.com"
PASSWORD = "bel2000BELLE$"
TIMEZONE = "Europe/Budapest"
AVAILABILITY_START_HOUR = 8
AVAILABILITY_END_HOUR = 20

def test_get_event_by_id_success_and_not_found():
    session = requests.Session()

    # Authenticate and obtain session cookies
    auth_payload = {"email": EMAIL, "password": PASSWORD}
    auth_resp = session.post(AUTH_URL, json=auth_payload, timeout=30)
    assert auth_resp.status_code == 200, f"Authentication failed: {auth_resp.text}"

    # Get authenticated user's provider record by listing all providers and filter on user email
    providers_resp = session.get(PROVIDERS_URL, timeout=30)
    assert providers_resp.status_code == 200, f"Failed to get providers: {providers_resp.text}"
    providers_data = providers_resp.json()
    assert isinstance(providers_data, list) and len(providers_data) > 0, "No providers found"
    provider = None
    for p in providers_data:
        if "user" in p and p["user"].get("email") == EMAIL:
            provider = p
            break
    assert provider is not None, "Provider matching authenticated email not found"
    provider_id = provider["id"]

    # Prepare to create an event for testing GET by ID success case
    tz = ZoneInfo(TIMEZONE)
    now = datetime.now(tz)
    start_dt = now + timedelta(days=1)
    start_dt = start_dt.replace(hour=AVAILABILITY_START_HOUR + 1, minute=0, second=0, microsecond=0)
    end_dt = start_dt + timedelta(hours=1)

    event_payload = {
        "providerId": provider_id,
        "title": "Test Event for GET by ID",
        "description": "Testing get_event_by_id_success_and_not_found",
        "start": start_dt.isoformat(),
        "end": end_dt.isoformat()
    }

    created_event_id = None

    try:
        # Create event via POST /api/provider/events
        create_resp = session.post(PROVIDER_EVENTS_URL, json=event_payload, timeout=30)
        assert create_resp.status_code == 201, f"Failed to create event: {create_resp.text}"
        created_event = create_resp.json()
        created_event_id = created_event["id"]

        # Test GET /api/events/:id for existing event (should return 200)
        get_resp = session.get(f"{EVENTS_URL}/{created_event_id}", timeout=30)
        assert get_resp.status_code == 200, f"GET existing event failed: {get_resp.text}"
        event_data = get_resp.json()
        assert event_data["id"] == created_event_id, "Returned event ID does not match"
        assert event_data["providerId"] == provider_id, "Returned event providerId does not match"
        assert event_data["title"] == event_payload["title"], "Returned event title mismatch"
        assert event_data["start"] == event_payload["start"], "Returned event start mismatch"
        assert event_data["end"] == event_payload["end"], "Returned event end mismatch"

        # Test GET /api/events/:id for non-existent event (should return 404)
        non_existing_id = "00000000-0000-0000-0000-000000000000"
        get_nonexist_resp = session.get(f"{EVENTS_URL}/{non_existing_id}", timeout=30)
        assert get_nonexist_resp.status_code == 404, f"GET non-existent event did not return 404: {get_nonexist_resp.text}"
        error_body = get_nonexist_resp.json()
        assert "error" in error_body, "Error message missing for 404 response"
        assert error_body["error"].lower() == "event not found", f"Unexpected error message: {error_body['error']}"
    finally:
        if created_event_id:
            del_resp = session.delete(f"{PROVIDER_EVENTS_URL}/{created_event_id}", timeout=30)
            # delete might fail if event is booked or already deleted, just pass
            if del_resp.status_code not in [204, 404]:
                raise AssertionError(f"Failed to clean up event: {del_resp.status_code} {del_resp.text}")

test_get_event_by_id_success_and_not_found()