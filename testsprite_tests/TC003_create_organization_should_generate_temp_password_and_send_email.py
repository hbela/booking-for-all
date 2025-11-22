import requests
import uuid
from auth_helper import get_admin_session, BASE_URL

ORG_CREATE_ENDPOINT = f"{BASE_URL}/api/admin/organizations/create"

def test_create_organization_should_generate_temp_password_and_send_email():
    # Get authenticated admin session using auth_helper
    admin_session = get_admin_session()

    # Step 2: Create unique organization data to avoid conflicts
    unique_suffix = str(uuid.uuid4())[:8]
    org_name = f"Test Organization {unique_suffix}"
    owner_name = "Test Owner"
    owner_email = f"owner_{unique_suffix}@example.com"

    create_payload = {
        "name": org_name,
        "ownerName": owner_name,
        "ownerEmail": owner_email
    }

    org_id = None
    try:
        # Step 3: Create the organization using the authenticated session
        create_resp = admin_session.post(ORG_CREATE_ENDPOINT, json=create_payload)
        assert create_resp.status_code == 200, f"Failed to create organization: {create_resp.text}"

        resp_json = create_resp.json()
        # Validate response schema for organization
        organization = resp_json.get("organization")
        owner = resp_json.get("owner")
        message = resp_json.get("message")

        assert organization is not None, "Response missing 'organization'"
        assert owner is not None, "Response missing 'owner'"
        assert isinstance(message, str) and len(message) > 0, "Missing or empty 'message' indicating email sent"

        org_id = organization.get("id")
        assert isinstance(org_id, str) and len(org_id) > 0, "Organization 'id' missing or invalid"
        assert organization.get("name") == org_name, "Organization name mismatch"
        assert organization.get("enabled") is True or organization.get("enabled") is False, "'enabled' must be boolean"
        assert isinstance(organization.get("slug"), str) and len(organization.get("slug")) > 0, "Organization 'slug' missing or invalid"
        assert organization.get("createdAt") is not None, "'createdAt' missing"

        # Validate owner data
        assert owner.get("id") is not None and isinstance(owner.get("id"), str), "Owner 'id' missing or invalid"
        assert owner.get("name") == owner_name, "Owner name mismatch"
        assert owner.get("email") == owner_email, "Owner email mismatch"

        # Note: We cannot directly verify the temp password or email sending beyond the presence of 'message' field.
    finally:
        # Cleanup: Delete the organization if created (if endpoint exists)
        if org_id:
            delete_endpoint = f"{BASE_URL}/api/admin/organizations/{org_id}"
            try:
                del_resp = admin_session.delete(delete_endpoint)
                # Accept 200 success or 404 if already deleted or endpoint doesn't exist
                assert del_resp.status_code in (200, 404, 405), f"Failed to delete organization: {del_resp.text}"
            except Exception:
                pass

test_create_organization_should_generate_temp_password_and_send_email()
