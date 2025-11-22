import requests
import uuid
from auth_helper import get_admin_session, BASE_URL

ORG_CREATE_URL = f"{BASE_URL}/api/admin/organizations/create"

def test_TC002_create_organization_validate_unique_name_slug_owner_email():
    # Get authenticated admin session using auth_helper
    admin_session = get_admin_session()
    timeout = 30

    # Prepare unique base data for organization creation
    unique_str = str(uuid.uuid4())[:8]
    org_name = f"TestOrg-{unique_str}"
    org_slug = f"testorg-{unique_str}".lower()
    owner_name = "Test Owner"
    owner_email = f"owner{unique_str}@example.com"

    created_org_id = None

    # Step 1: Create a new organization successfully
    create_payload = {
        "name": org_name,
        "slug": org_slug,
        "ownerName": owner_name,
        "ownerEmail": owner_email
    }
    create_resp = admin_session.post(ORG_CREATE_URL, json=create_payload)
    assert create_resp.status_code == 200, f"Initial organization creation failed with status {create_resp.status_code}"
    create_resp_json = create_resp.json()
    assert "organization" in create_resp_json
    assert create_resp_json["organization"]["name"] == org_name
    assert create_resp_json["organization"]["slug"] == org_slug
    assert create_resp_json["owner"]["email"] == owner_email
    created_org_id = create_resp_json["organization"]["id"]

    # Step 2: Attempt to create organization with duplicate name but different slug - should succeed (200)
    # Note: API only enforces slug uniqueness, not name uniqueness (see schema: slug is @unique, name is not)
    dup_name_payload = {
        "name": org_name,  # Same name
        "slug": f"{org_slug}-dup",  # Different slug
        "ownerName": "Other Owner",
        "ownerEmail": f"other{unique_str}@example.com"
    }
    dup_name_resp = admin_session.post(ORG_CREATE_URL, json=dup_name_payload)
    assert dup_name_resp.status_code == 200, f"Duplicate name with different slug should succeed: expected 200, got {dup_name_resp.status_code}"
    # Clean up this duplicate org created for testing
    dup_org_id = dup_name_resp.json().get("organization", {}).get("id")

    # Step 3: Attempt to create organization with duplicate slug - expect 400
    dup_slug_payload = {
        "name": f"{org_name}-diff",
        "slug": org_slug,
        "ownerName": "Other Owner",
        "ownerEmail": f"other2{unique_str}@example.com"
    }
    dup_slug_resp = admin_session.post(ORG_CREATE_URL, json=dup_slug_payload)
    assert dup_slug_resp.status_code == 400, f"Duplicate slug check failed: expected 400, got {dup_slug_resp.status_code}"

    # Step 4: Attempt to create organization with duplicate ownerEmail - expect 400
    dup_owner_email_payload = {
        "name": f"{org_name}-diff2",
        "slug": f"{org_slug}-diff2",
        "ownerName": "Other Owner",
        "ownerEmail": owner_email
    }
    dup_owner_email_resp = admin_session.post(ORG_CREATE_URL, json=dup_owner_email_payload)
    assert dup_owner_email_resp.status_code == 400, f"Duplicate ownerEmail check failed: expected 400, got {dup_owner_email_resp.status_code}"

    # Cleanup: No delete endpoint for organization in PRD, so skipping resource deletion

test_TC002_create_organization_validate_unique_name_slug_owner_email()
