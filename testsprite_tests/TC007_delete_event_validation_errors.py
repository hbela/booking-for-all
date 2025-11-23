import requests
import datetime
from dateutil import tz

BASE_URL = "http://localhost:3000"
AUTH_URL = BASE_URL + "/api/auth/sign-in/email"
PROVIDERS_URL = BASE_URL + "/api/providers"
PROVIDER_EVENTS_URL = BASE_URL + "/api/provider/events"
EVENTS_URL = BASE_URL + "/api/events"

PROVIDER_EMAIL = "elysprovider1@gmail.com"
PROVIDER_PASSWORD = "bel2000BELLE$"

def delete_event_validation_errors():
    session = requests.Session()
    # Authenticate as provider user (Better Auth session-based)
    auth_resp = session.post(AUTH_URL, json={"email": PROVIDER_EMAIL, "password": PROVIDER_PASSWORD}, timeout=30)
    assert auth_resp.status_code == 200, f"Authentication failed: {auth_resp.text}"

    # Get authenticated user info from one of the endpoints (providers) to find providerId and userId
    # We search for provider by userId
    # First get userId from session by calling /api/providers with no filter (should return providers list)
    providers_resp = session.get(PROVIDERS_URL, timeout=30)
    assert providers_resp.status_code == 200, f"Failed to get providers: {providers_resp.text}"
    provider_data_list = providers_resp.json()
    # Find provider matching our email
    provider = next((p for p in provider_data_list if p.get("user", {}).get("email") == PROVIDER_EMAIL), None)
    assert provider is not None, "Provider record not found for authenticated user"
    provider_id = provider["id"]

    # Helper function to create an event for this provider that is unbooked
    def create_unbooked_event():
        # Use future date and business hours (default 8:00-20:00 Europe/Budapest)
        # Use dateutil to handle time zones
        from_zone = tz.tzutc()
        to_zone = tz.gettz("Europe/Budapest")
        now = datetime.datetime.now(tz=to_zone)
        start_dt = now + datetime.timedelta(days=1)
        start_dt = start_dt.replace(hour=9, minute=0, second=0, microsecond=0)
        end_dt = start_dt + datetime.timedelta(hours=1)
        payload = {
            "providerId": provider_id,
            "title": "Test Event for Deletion Validation",
            "start": start_dt.isoformat(),
            "end": end_dt.isoformat()
        }
        create_resp = session.post(PROVIDER_EVENTS_URL, json=payload, timeout=30)
        assert create_resp.status_code == 201, f"Failed to create event: {create_resp.text}"
        return create_resp.json()

    # Helper function to get an event that is booked and owned by provider (if none, try create and book - but booking not in scope, so find manually)
    # Since booking flow isn't defined, will search for any booked event of provider via GET /api/events?providerId=<provider_id>&available=true does not include booked events
    # So get all events for provider then filter booked ones
    def get_booked_event_for_provider():
        events_resp = session.get(EVENTS_URL + f"?providerId={provider_id}", timeout=30)
        assert events_resp.status_code == 200, f"Failed to get events: {events_resp.text}"
        events = events_resp.json()
        for event in events:
            if event.get("isBooked") and event.get("providerId") == provider_id:
                return event
        return None

    # Helper function to get an event that is NOT owned by the provider
    # Get all events, find one whose providerId is not our provider_id
    def get_not_owned_event():
        events_resp = session.get(EVENTS_URL, timeout=30)
        assert events_resp.status_code == 200, f"Failed to get events: {events_resp.text}"
        events = events_resp.json()
        for event in events:
            if event.get("providerId") != provider_id:
                return event
        return None

    # Attempt to get a booked event of the provider
    booked_event = get_booked_event_for_provider()

    # If no booked event found, we cannot create a booked event because booking mechanism is not defined
    # So skip booked event deletion test if booked event not found
    # For test completeness, if booked_event is None, log and continue with not owned event test

    # Get event not owned by provider
    not_owned_event = get_not_owned_event()

    # Test deletion of booked event returns 400 with proper error message (if booked_event found)
    if booked_event:
        delete_url = PROVIDER_EVENTS_URL + f"/{booked_event['id']}"
        resp = session.delete(delete_url, timeout=30)
        assert resp.status_code == 400, f"Expected 400 when deleting booked event, got {resp.status_code}"
        error_body = resp.json()
        assert "error" in error_body, "Error message missing in 400 response for booked event deletion"
        assert "Cannot delete a booked event" in error_body["error"], f"Unexpected error message: {error_body['error']}"
    else:
        print("No booked event found for provider to test deletion validation error on booked event.")

    # Test deletion of event not owned by provider returns 403 with proper error message (if not_owned_event found)
    if not_owned_event:
        delete_url = PROVIDER_EVENTS_URL + f"/{not_owned_event['id']}"
        resp = session.delete(delete_url, timeout=30)
        assert resp.status_code == 403, f"Expected 403 when deleting event not owned by provider, got {resp.status_code}"
        error_body = resp.json()
        assert "error" in error_body, "Error message missing in 403 response for unauthorized deletion"
        assert "Forbidden - Only the provider can delete their events" in error_body["error"], f"Unexpected error message: {error_body['error']}"
    else:
        print("No event found that is not owned by provider to test deletion validation error on unauthorized deletion.")

delete_event_validation_errors()