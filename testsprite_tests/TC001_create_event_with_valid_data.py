import requests
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

BASE_URL = "http://localhost:3000/features/admin"
AUTH_URL = "http://localhost:3000/api/auth/sign-in/email"
PROVIDERS_URL = "http://localhost:3000/api/providers"
CREATE_EVENT_URL = "http://localhost:3000/api/provider/events"

EMAIL = "elysprovider1@gmail.com"
PASSWORD = "bel2000BELLE$"
TIMEZONE = "Europe/Budapest"
AVAILABILITY_START_HOUR = 8
AVAILABILITY_END_HOUR = 20
TIMEOUT = 30


def create_event_with_valid_data():
    session = requests.Session()
    # Authenticate as provider user (Better Auth session-based)
    auth_payload = {"email": EMAIL, "password": PASSWORD}
    auth_resp = session.post(AUTH_URL, json=auth_payload, timeout=TIMEOUT)
    assert auth_resp.status_code == 200, f"Authentication failed: {auth_resp.text}"

    # Get authenticated user info from /api/providers?userId=<userId> by filtering providers for the user's email
    providers_resp = session.get(PROVIDERS_URL, timeout=TIMEOUT)
    assert providers_resp.status_code == 200, f"Failed to get providers list: {providers_resp.text}"
    providers = providers_resp.json()
    provider = None
    for p in providers:
        if "user" in p and p["user"].get("email") == EMAIL:
            provider = p
            break
    assert provider is not None, "Authenticated provider record not found"

    provider_id = provider["id"]

    # Prepare event data within business hours, in the future
    tz = ZoneInfo(TIMEZONE)
    now = datetime.now(tz)

    # Set start time tomorrow at 9:00 and end time at 10:00 (within 8-20)
    start_dt = (now + timedelta(days=1)).replace(hour=9, minute=0, second=0, microsecond=0)
    end_dt = start_dt + timedelta(hours=1)

    # ISO 8601 formatted string
    start_str = start_dt.isoformat()
    end_str = end_dt.isoformat()

    event_payload = {
        "providerId": provider_id,
        "title": "Test Event Valid",
        "description": "This is a test event created by automated test.",
        "start": start_str,
        "end": end_str,
    }

    # Create event via POST /api/provider/events
    create_resp = session.post(CREATE_EVENT_URL, json=event_payload, timeout=TIMEOUT)
    assert create_resp.status_code == 201, f"Event creation failed: {create_resp.status_code} {create_resp.text}"
    event = create_resp.json()

    try:
        # Validate response body
        assert isinstance(event.get("id"), str) and event["id"], "Missing or invalid event id"
        assert event["providerId"] == provider_id, "providerId mismatch in response"
        assert event["title"] == event_payload["title"], "Title mismatch"
        if "description" in event_payload:
            assert event.get("description") == event_payload["description"], "Description mismatch"
        else:
            assert event.get("description") is None or isinstance(event.get("description"), str)

        # Compare start and end datetimes parsed from response with originals
        event_start_dt = datetime.fromisoformat(event.get("start"))
        event_end_dt = datetime.fromisoformat(event.get("end"))

        assert event_start_dt == start_dt, f"Start time mismatch: expected {start_dt.isoformat()}, got {event.get('start')}"
        assert event_end_dt == end_dt, f"End time mismatch: expected {end_dt.isoformat()}, got {event.get('end')}"

        # Duration should be 60 minutes
        assert isinstance(event.get("duration"), (int, float)) and int(event["duration"]) == 60, "Duration mismatch"
        # price is null as per schema
        assert event.get("price") is None, "Price should be null"

        provider_user = event.get("provider", {}).get("user")
        assert provider_user and "email" in provider_user and provider_user["email"] == EMAIL, "Provider user email mismatch"

    finally:
        # Cleanup: Delete created event
        event_id = event.get("id")
        if event_id:
            del_url = f"http://localhost:3000/api/provider/events/{event_id}"
            del_resp = session.delete(del_url, timeout=TIMEOUT)
            # Either 204 No Content or an error if already booked or missing
            assert del_resp.status_code == 204, f"Failed to delete test event: {del_resp.status_code} {del_resp.text}"


create_event_with_valid_data()
