import requests
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

BASE_URL = "http://localhost:3000"
AUTH_URL = f"{BASE_URL}/api/auth/sign-in/email"
PROVIDERS_URL = f"{BASE_URL}/api/providers"
PROVIDER_EVENTS_URL = f"{BASE_URL}/api/provider/events"
EVENTS_URL = f"{BASE_URL}/api/events"

PROVIDER_EMAIL = "elysprovider1@gmail.com"
PROVIDER_PASSWORD = "bel2000BELLE$"
TIMEZONE = "Europe/Budapest"
AVAILABILITY_START_HOUR = 8
AVAILABILITY_END_HOUR = 20

def test_delete_unbooked_event_success():
    session = requests.Session()
    # Authenticate provider user
    auth_resp = session.post(
        AUTH_URL,
        json={"email": PROVIDER_EMAIL, "password": PROVIDER_PASSWORD},
        timeout=30,
    )
    assert auth_resp.status_code == 200, f"Authentication failed: {auth_resp.text}"

    # Fetch authenticated user's userId from providers endpoint
    providers_resp = session.get(
        PROVIDERS_URL,
        timeout=30,
    )
    assert providers_resp.status_code == 200, f"Failed to get providers: {providers_resp.text}"
    providers = providers_resp.json()
    provider = None
    for p in providers:
        if p["user"]["email"].lower() == PROVIDER_EMAIL.lower():
            provider = p
            break
    assert provider is not None, "Authenticated provider record not found in /api/providers"

    provider_id = provider["id"]
    user_id = provider["userId"]

    # Create an unbooked event (within business hours and future)
    tz = ZoneInfo(TIMEZONE)
    now = datetime.now(tz)

    start_time = now + timedelta(days=1)
    start_time = start_time.replace(hour=AVAILABILITY_START_HOUR + 1, minute=0, second=0, microsecond=0)
    end_time = start_time + timedelta(hours=1)

    event_payload = {
        "providerId": provider_id,
        "title": "Test Event for Deletion",
        "description": "This event will be deleted in test",
        "start": start_time.isoformat(),
        "end": end_time.isoformat(),
    }

    create_resp = session.post(
        PROVIDER_EVENTS_URL,
        json=event_payload,
        timeout=30,
    )
    assert create_resp.status_code == 201, f"Event creation failed: {create_resp.text}"
    created_event = create_resp.json()
    event_id = created_event.get("id")
    assert event_id is not None, "Created event has no ID"

    try:
        # Verify event is unbooked
        event_detail_resp = session.get(f"{EVENTS_URL}/{event_id}", timeout=30)
        assert event_detail_resp.status_code == 200, f"Failed to get event details: {event_detail_resp.text}"
        event_detail = event_detail_resp.json()
        assert event_detail.get("isBooked") is False, "Created event should be unbooked"

        # Delete the unbooked event
        delete_resp = session.delete(f"{PROVIDER_EVENTS_URL}/{event_id}", timeout=30)
        assert delete_resp.status_code == 204, f"Event deletion failed: {delete_resp.text}"
        # Body should be empty
        assert not delete_resp.content, "Delete response body should be empty"

        # Verify event no longer exists
        get_after_delete = session.get(f"{EVENTS_URL}/{event_id}", timeout=30)
        assert get_after_delete.status_code == 404, "Deleted event should not be found"

    finally:
        # Cleanup in case deletion failed
        # Try deleting to clean up (ignore errors)
        session.delete(f"{PROVIDER_EVENTS_URL}/{event_id}", timeout=30)

test_delete_unbooked_event_success()
