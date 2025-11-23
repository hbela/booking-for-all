import requests
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

BASE_URL = "http://localhost:3000"
AUTH_ENDPOINT = "/api/auth/sign-in/email"
PROVIDERS_ENDPOINT = "/api/providers"
EVENTS_ENDPOINT = "/api/events"
PROVIDER_EVENTS_ENDPOINT = "/api/provider/events"

PROVIDER_EMAIL = "elysprovider1@gmail.com"
PROVIDER_PASSWORD = "bel2000BELLE$"

AVAILABILITY_START_HOUR = 8
AVAILABILITY_END_HOUR = 20
AVAILABILITY_TIME_ZONE = "Europe/Budapest"


def test_update_unbooked_event_with_valid_data():
    session = requests.Session()
    # Authenticate and maintain session
    auth_resp = session.post(
        f"{BASE_URL}{AUTH_ENDPOINT}",
        json={"email": PROVIDER_EMAIL, "password": PROVIDER_PASSWORD},
        timeout=30,
    )
    assert auth_resp.status_code == 200, f"Authentication failed: {auth_resp.text}"

    # Get authenticated user info from one of the endpoints (use /api/providers filtered by userId)
    user_id = None
    # Fetch all providers without userId filter to find matching email
    providers_resp = session.get(f"{BASE_URL}{PROVIDERS_ENDPOINT}", timeout=30)
    assert providers_resp.status_code == 200, f"Could not fetch providers: {providers_resp.text}"
    providers = providers_resp.json()
    provider = None
    for p in providers:
        if p.get("user", {}).get("email") == PROVIDER_EMAIL:
            provider = p
            break
    assert provider, "Authenticated provider record not found"
    provider_id = provider["id"]
    user_id = provider["userId"]

    # Get unbooked events owned by this provider
    params = {"providerId": provider_id, "available": "true"}
    events_resp = session.get(f"{BASE_URL}{EVENTS_ENDPOINT}", params=params, timeout=30)
    assert events_resp.status_code == 200, f"Failed to get events: {events_resp.text}"
    events = events_resp.json()

    # Filter to an unbooked event (isBooked=false). The "available=true" filter should suffice but double-check.
    unbooked_event = None
    for ev in events:
        if ev.get("providerId") == provider_id and ev.get("isBooked") is False:
            unbooked_event = ev
            break

    created_new_event = False
    # If no suitable unbooked event found, create one
    if not unbooked_event:
        created_new_event = True
        # Create event time in the future (next day at 9:00 to 10:00)
        tz = ZoneInfo(AVAILABILITY_TIME_ZONE)
        now = datetime.now(tz)
        start_dt = now + timedelta(days=1)
        start_dt = start_dt.replace(hour=9, minute=0, second=0, microsecond=0)
        end_dt = start_dt + timedelta(hours=1)

        new_event_payload = {
            "providerId": provider_id,
            "title": "Test Event for Update",
            "description": "Event to test update unbooked event",
            "start": start_dt.isoformat(),
            "end": end_dt.isoformat(),
        }

        create_resp = session.post(
            f"{BASE_URL}{PROVIDER_EVENTS_ENDPOINT}", json=new_event_payload, timeout=30
        )
        assert create_resp.status_code == 201, f"Failed to create event: {create_resp.text}"
        unbooked_event = create_resp.json()

    event_id = unbooked_event["id"]

    try:
        # Prepare update payload with new title and description
        update_payload = {
            "title": "Updated Event Title",
            "description": "Updated description for unbooked event"
        }

        update_resp = session.put(
            f"{BASE_URL}{PROVIDER_EVENTS_ENDPOINT}/{event_id}", json=update_payload, timeout=30
        )
        assert update_resp.status_code == 200, f"Update failed: {update_resp.text}"

        updated_event = update_resp.json()

        # Assert updated fields match sent data
        assert updated_event["id"] == event_id
        assert updated_event["title"] == update_payload["title"]
        # Description could be null if not provided, here provided so check equality
        assert updated_event.get("description") == update_payload["description"]
        # Assert ownership remains same
        assert updated_event["providerId"] == provider_id

        # Assert isBooked is False (updated event must be unbooked)
        # The "isBooked" field is not in update response explicitly, but booking is null means unbooked
        assert updated_event.get("booking") is None or updated_event.get("booking") == None

    finally:
        if created_new_event:
            # Cleanup: delete the created event to avoid test side-effects
            delete_resp = session.delete(
                f"{BASE_URL}{PROVIDER_EVENTS_ENDPOINT}/{event_id}", timeout=30
            )
            # Expect 204 no content on successful deletion
            assert delete_resp.status_code == 204 or delete_resp.status_code == 404, f"Failed to delete created event: {delete_resp.text}"


test_update_unbooked_event_with_valid_data()