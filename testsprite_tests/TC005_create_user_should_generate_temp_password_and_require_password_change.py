import requests
import uuid
from auth_helper import get_admin_session, BASE_URL

USERS_URL = f"{BASE_URL}/api/admin/users"

def test_create_user_generates_temp_password_and_requires_password_change():
    # Get authenticated admin session using auth_helper
    admin_session = get_admin_session()

    # Generate a unique email for the new user to avoid conflicts
    unique_email = f"testuser_{uuid.uuid4().hex}@example.com"
    user_payload = {
        "name": "Test User",
        "email": unique_email,
        "role": "USER"
    }

    created_user_id = None
    try:
        # Create new user
        create_resp = admin_session.post(USERS_URL, json=user_payload)
        assert create_resp.status_code == 201, f"User creation failed with {create_resp.status_code}: {create_resp.text}"
        data = create_resp.json()

        # Validate response keys
        assert "user" in data, "Response JSON does not contain 'user'"
        assert "tempPassword" in data, "Response JSON does not contain 'tempPassword'"

        user = data["user"]
        temp_password = data["tempPassword"]

        # Validate user fields
        assert user.get("id"), "User ID missing"
        created_user_id = user["id"]
        assert user.get("name") == user_payload["name"], "User name mismatch"
        assert user.get("email") == user_payload["email"], "User email mismatch"
        assert user.get("needsPasswordChange") is True, "needsPasswordChange should be True"
        assert isinstance(temp_password, str) and len(temp_password) > 0, "tempPassword should be a non-empty string"

    finally:
        # Cleanup: delete the created user if possible
        # No DELETE user endpoint provided in PRD, so cleanup cannot be done here
        pass

test_create_user_generates_temp_password_and_requires_password_change()
