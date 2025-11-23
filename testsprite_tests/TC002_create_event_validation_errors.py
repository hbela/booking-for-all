import requests
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

BASE_URL = "http://localhost:3000/features/admin"
AUTH_URL = "http://localhost:3000/api/auth/sign-in/email"
PROVIDERS_URL = "http://localhost:3000/api/providers"
PROVIDER_EVENTS_URL = "http://localhost:3000/api/provider/events"

EMAIL = "elysprovider1@gmail.com"
PASSWORD = "bel2000BELLE$"

AVAILABILITY_START_HOUR = 8
AVAILABILITY_END_HOUR = 20
AVAILABILITY_TIME_ZONE = "Europe/Budapest"


def test_create_event_validation_errors():
    session = requests.Session()
    # Authenticate provider user
    auth_resp = session.post(
        AUTH_URL,
        json={"email": EMAIL, "password": PASSWORD},
        timeout=30,
    )
    assert auth_resp.status_code == 200, f"Authentication failed: {auth_resp.text}"

    # Get authenticated user's providerId
    provs_resp = session.get(
        f"http://localhost:3000/api/providers",
        timeout=30,
    )
    assert provs_resp.status_code == 200, f"Failed to get providers: {provs_resp.text}"
    providers = provs_resp.json()
    providerId = None
    for p in providers:
        if p.get("user", {}).get("email") == EMAIL:
            providerId = p.get("id")
            break
    assert providerId, "Provider ID for authenticated user not found"

    now = datetime.now(ZoneInfo(AVAILABILITY_TIME_ZONE))

    # Helper function to make POST and assert 400 with expected error substring
    def post_event_and_check(payload, expected_error_fragment):
        resp = session.post(
            PROVIDER_EVENTS_URL,
            json=payload,
            timeout=30,
        )
        assert resp.status_code == 400, f"Expected 400 error: got {resp.status_code}, body: {resp.text}"
        body = resp.json()
        assert "error" in body, "Error message missing in response"
        # Check error message contains expected fragment (case insensitive)
        assert expected_error_fragment.lower() in body["error"].lower(), f"Unexpected error message: {body['error']}"

    # 1. Missing required fields (omit providerId, title, start, end one by one & also all missing)
    # a) Missing providerId
    payload = {
        "title": "Test event missing providerId",
        "start": (now + timedelta(hours=1)).isoformat(),
        "end": (now + timedelta(hours=2)).isoformat(),
    }
    post_event_and_check(payload, "providerId")

    # b) Missing title
    payload = {
        "providerId": providerId,
        "start": (now + timedelta(hours=1)).isoformat(),
        "end": (now + timedelta(hours=2)).isoformat(),
    }
    post_event_and_check(payload, "title")

    # c) Missing start
    payload = {
        "providerId": providerId,
        "title": "No start time",
        "end": (now + timedelta(hours=2)).isoformat(),
    }
    post_event_and_check(payload, "start")

    # d) Missing end
    payload = {
        "providerId": providerId,
        "title": "No end time",
        "start": (now + timedelta(hours=1)).isoformat(),
    }
    post_event_and_check(payload, "end")

    # 2. Start date in the past
    past_start = (now - timedelta(days=1)).replace(hour=9, minute=0, second=0, microsecond=0)
    past_end = past_start + timedelta(hours=1)
    payload = {
        "providerId": providerId,
        "title": "Event with past start time",
        "start": past_start.isoformat(),
        "end": past_end.isoformat(),
    }
    post_event_and_check(payload, "past")

    # 3. Start time before business hours (before 8:00)
    # Compose a datetime for tomorrow before 8am
    tomorrow = now + timedelta(days=1)
    early_start = tomorrow.replace(hour=7, minute=0, second=0, microsecond=0)
    early_end = early_start + timedelta(hours=1)
    payload = {
        "providerId": providerId,
        "title": "Event start before business hours",
        "start": early_start.isoformat(),
        "end": early_end.isoformat(),
    }
    post_event_and_check(payload, "business hours")

    # 4. End time after business hours (after 20:00)
    late_start = tomorrow.replace(hour=19, minute=30, second=0, microsecond=0)
    late_end = tomorrow.replace(hour=21, minute=0, second=0, microsecond=0)
    payload = {
        "providerId": providerId,
        "title": "Event end after business hours",
        "start": late_start.isoformat(),
        "end": late_end.isoformat(),
    }
    post_event_and_check(payload, "business hours")

    # 5. End time before start time (invalid)
    invalid_end = tomorrow.replace(hour=10, minute=0, second=0, microsecond=0)
    invalid_start = tomorrow.replace(hour=11, minute=0, second=0, microsecond=0)
    payload = {
        "providerId": providerId,
        "title": "Event where end before start",
        "start": invalid_start.isoformat(),
        "end": invalid_end.isoformat(),
    }
    post_event_and_check(payload, "end time must be after start time")


test_create_event_validation_errors()
