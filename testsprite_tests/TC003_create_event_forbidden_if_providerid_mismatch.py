import requests
from datetime import datetime, timedelta, time
from zoneinfo import ZoneInfo

BASE_URL = "http://localhost:3000"
AUTH_SIGNIN_PATH = "/api/auth/sign-in/email"
PROVIDERS_PATH = "/api/providers"
CREATE_EVENT_PATH = "/api/provider/events"
TIMEOUT = 30

PROVIDER_EMAIL = "elysprovider1@gmail.com"
PROVIDER_PASSWORD = "bel2000BELLE$"

AVAILABILITY_START_HOUR = 8
AVAILABILITY_END_HOUR = 20
AVAILABILITY_TIME_ZONE = "Europe/Budapest"


def test_create_event_forbidden_if_providerid_mismatch():
    session = requests.Session()
    # Authenticate as provider user
    auth_resp = session.post(
        BASE_URL + AUTH_SIGNIN_PATH,
        json={"email": PROVIDER_EMAIL, "password": PROVIDER_PASSWORD},
        timeout=TIMEOUT,
    )
    assert auth_resp.status_code == 200, "Authentication failed"

    # Get authenticated user ID by calling /api/providers?userId=<userId>
    # But we don't know userId directly; get from provider record matching authenticated user

    user_id = None
    # We know the email of the authenticated user, but /api/providers accepts userId filter only.
    # So fetch all providers and find matching email.
    providers_resp = session.get(BASE_URL + PROVIDERS_PATH, timeout=TIMEOUT)
    assert providers_resp.status_code == 200, "Failed to get providers list"
    providers = providers_resp.json()
    # Find the provider corresponding to the provider user email
    authenticated_provider = None
    for p in providers:
        if "user" in p and p["user"].get("email") == PROVIDER_EMAIL:
            authenticated_provider = p
            break
    assert authenticated_provider is not None, "Authenticated provider record not found"
    authenticated_provider_id = authenticated_provider["id"]

    # Find another providerId that does NOT belong to the authenticated user to test mismatch
    other_provider_id = None
    for p in providers:
        if p["id"] != authenticated_provider_id:
            other_provider_id = p["id"]
            break
    # If no other provider found, cannot test mismatch, skip with assertion
    assert other_provider_id is not None, "No other provider exists to test providerId mismatch"

    # Prepare event data with mismatched providerId (other_provider_id)
    # Event start and end: future date, within business hours in configured timezone
    tz = ZoneInfo(AVAILABILITY_TIME_ZONE)
    now = datetime.now(tz)
    # Set start time next day 9:00 AM
    start_dt = datetime.combine(now.date() + timedelta(days=1), time(9, 0), tzinfo=tz)
    end_dt = start_dt + timedelta(hours=1)
    event_payload = {
        "providerId": other_provider_id,
        "title": "Forbidden Event Attempt",
        "description": "Trying to create event with mismatched providerId",
        "start": start_dt.isoformat(),
        "end": end_dt.isoformat(),
    }

    # Attempt to create event - expect 403 Forbidden due to providerId mismatch
    create_resp = session.post(
        BASE_URL + CREATE_EVENT_PATH, json=event_payload, timeout=TIMEOUT
    )

    assert create_resp.status_code == 403, f"Expected 403 Forbidden, got {create_resp.status_code}"
    error_resp = create_resp.json()
    assert (
        "error" in error_resp and error_resp["error"] == "Forbidden - Only the provider can perform this action"
    ), f"Unexpected error message: {error_resp.get('error')}"

test_create_event_forbidden_if_providerid_mismatch()
