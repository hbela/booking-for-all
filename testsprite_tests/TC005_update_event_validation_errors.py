import requests
from datetime import datetime, timedelta
try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo  # For older Python versions

BASE_URL = "http://localhost:3000"
AUTH_ENDPOINT = f"{BASE_URL}/api/auth/sign-in/email"
PROVIDERS_ENDPOINT = f"{BASE_URL}/api/providers"
EVENTS_ENDPOINT = f"{BASE_URL}/api/events"
PROVIDER_EVENTS_ENDPOINT = f"{BASE_URL}/api/provider/events"

EMAIL = "elysprovider1@gmail.com"
PASSWORD = "bel2000BELLE$"
TIMEZONE = "Europe/Budapest"
AVAILABILITY_START_HOUR = 8
AVAILABILITY_END_HOUR = 20


def authenticate_provider():
    session = requests.Session()
    resp = session.post(
        AUTH_ENDPOINT,
        json={"email": EMAIL, "password": PASSWORD},
        timeout=30,
    )
    assert resp.status_code == 200, "Authentication failed"
    return session


def get_authenticated_provider(session):
    resp = session.get(PROVIDERS_ENDPOINT, timeout=30)
    assert resp.status_code == 200
    providers = resp.json()
    for provider in providers:
        if provider.get("user", {}).get("email") == EMAIL:
            return provider
    raise RuntimeError("Authenticated provider not found")


def create_event(session, provider_id, title="Test Event", description=None, start=None, end=None):
    payload = {
        "providerId": provider_id,
        "title": title,
        "start": start,
        "end": end,
    }
    if description is not None:
        payload["description"] = description
    resp = session.post(PROVIDER_EVENTS_ENDPOINT, json=payload, timeout=30)
    return resp


def delete_event(session, event_id):
    resp = session.delete(f"{PROVIDER_EVENTS_ENDPOINT}/{event_id}", timeout=30)
    return resp


def update_event(session, event_id, data):
    resp = session.put(f"{PROVIDER_EVENTS_ENDPOINT}/{event_id}", json=data, timeout=30)
    return resp


def get_event(session, event_id):
    resp = session.get(f"{EVENTS_ENDPOINT}/{event_id}", timeout=30)
    return resp


def update_event_validation_errors():
    session = authenticate_provider()
    provider = get_authenticated_provider(session)
    provider_id = provider["id"]

    tz = ZoneInfo(TIMEZONE)
    now = datetime.now(tz)
    start_dt = now + timedelta(days=1)
    start_dt = start_dt.replace(hour=9, minute=0, second=0, microsecond=0)
    end_dt = start_dt + timedelta(hours=1)
    start_iso = start_dt.isoformat()
    end_iso = end_dt.isoformat()

    event_id = None

    try:
        create_resp = create_event(session, provider_id, title="Unbooked Event", start=start_iso, end=end_iso)
        assert create_resp.status_code == 201, f"Failed to create event for update test: {create_resp.text}"
        event = create_resp.json()
        event_id = event["id"]

        events_resp = session.get(f"{EVENTS_ENDPOINT}?providerId={provider_id}", timeout=30)
        assert events_resp.status_code == 200
        booked_event = None
        for e in events_resp.json():
            if e.get("isBooked") and e.get("providerId") == provider_id and e.get("id") != event_id:
                booked_event = e
                break

        events_resp_all = session.get(EVENTS_ENDPOINT, timeout=30)
        assert events_resp_all.status_code == 200
        other_provider_event = None
        for e in events_resp_all.json():
            if e.get("providerId") != provider_id:
                other_provider_event = e
                break

        update_data_missing_title = {
            "description": "Updated description"
        }
        resp_missing_title = update_event(session, event_id, update_data_missing_title)
        assert resp_missing_title.status_code == 400, f"Expected 400 for missing title, got {resp_missing_title.status_code}"
        assert "error" in resp_missing_title.json()

        if booked_event is not None:
            update_data_booked = {
                "title": "Update Attempt On Booked",
                "description": "Should fail update on booked event"
            }
            resp_booked = update_event(session, booked_event["id"], update_data_booked)
            assert resp_booked.status_code == 400, f"Expected 400 for booked event update, got {resp_booked.status_code}"
            err = resp_booked.json()
            assert "error" in err and ("booked" in err["error"].lower() or "cannot update" in err["error"].lower())

        if other_provider_event is not None:
            update_data_not_owned = {
                "title": "Illegal Update",
                "description": "Should fail due to ownership"
            }
            resp_not_owned = update_event(session, other_provider_event["id"], update_data_not_owned)
            assert resp_not_owned.status_code in (403, 404), \
                f"Expected 403 or 404 for updating event not owned, got {resp_not_owned.status_code}"
            err = resp_not_owned.json()
            assert "error" in err

    finally:
        if event_id is not None:
            delete_event(session, event_id)
    print("Test TC005 (update_event_validation_errors) passed.")


update_event_validation_errors()
