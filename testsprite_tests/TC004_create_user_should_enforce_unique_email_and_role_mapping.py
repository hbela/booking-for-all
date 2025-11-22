import requests
import uuid
from auth_helper import get_admin_session, BASE_URL

def test_create_user_unique_email_role_mapping():
    # Get authenticated admin session using auth_helper
    admin_session = get_admin_session()

    users_url = f"{BASE_URL}/api/admin/users"

    # Generate unique email for test user
    unique_email = f"testuser_{uuid.uuid4().hex}@example.com"
    user_payload = {
        "name": "Test User",
        "email": unique_email,
        "role": "USER",  # USER role should be mapped internally to CLIENT
    }

    created_user_id = None
    try:
        # Create user - expect 201 Created
        create_resp = admin_session.post(users_url, json=user_payload)
        assert create_resp.status_code == 201, f"Create user failed: {create_resp.text}"
        create_data = create_resp.json()
        user = create_data.get("user")
        temp_password = create_data.get("tempPassword")

        # Validate response fields exist
        assert user is not None, "Response missing 'user' object"
        assert isinstance(temp_password, str) and len(temp_password) > 0, "'tempPassword' missing or empty"
        created_user_id = user.get("id")
        assert created_user_id is not None and created_user_id != "", "User ID missing"

        # Validate user fields
        assert user.get("email") == unique_email, "Returned email does not match"
        # Role should be CLIENT internally if USER role is sent
        returned_role = user.get("role")
        assert returned_role is not None, "User role missing"
        assert (user_payload["role"] == "USER" and returned_role == "CLIENT") or (user_payload["role"] != "USER"), \
            f"User role mapping failed: expected CLIENT but got {returned_role} for USER role"

        # Test unique email enforcement:
        # Try to create user with same email again - should fail with 400
        duplicate_resp = admin_session.post(users_url, json=user_payload)
        assert duplicate_resp.status_code == 400, \
            f"Duplicate email was allowed: {duplicate_resp.status_code} - {duplicate_resp.text}"

    finally:
        # No delete endpoint to cleanup
        pass

test_create_user_unique_email_role_mapping()
