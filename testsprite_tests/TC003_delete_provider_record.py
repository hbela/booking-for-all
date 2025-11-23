import requests
import uuid
import random
import string
import sys

BASE_URL = "http://localhost:3000"

def test_delete_provider_record():
    session = requests.Session()
    # Authenticate
    auth_resp = session.post(
        f"{BASE_URL}/api/auth/sign-in/email",
        json={"email": "elystrade@gmail.com", "password": "bel2000BELLE$"},
        timeout=30,
    )
    assert auth_resp.status_code == 200, f"Auth failed: {auth_resp.text}"

    # Get owner's organizations
    orgs_resp = session.get(f"{BASE_URL}/api/organizations/my-organizations", timeout=30)
    assert orgs_resp.status_code == 200, f"Failed to get organizations: {orgs_resp.text}"
    orgs = orgs_resp.json()
    assert isinstance(orgs, list) and len(orgs) > 0, "No organizations found for owner"

    # Get first enabled org or first org
    organization_id = None
    for org in orgs:
        if org.get("enabled"):
            organization_id = org["id"]
            break
    if organization_id is None:
        organization_id = orgs[0]["id"]
    assert organization_id is not None, "No organization ID found"

    # Create a department to assign to provider (required for provider creation)
    dept_name = f"TestDept-{uuid.uuid4().hex[:6]}"
    dept_payload = {
        "name": dept_name,
        "organizationId": organization_id,
    }
    dept_resp = session.post(f"{BASE_URL}/api/owner/departments", json=dept_payload, timeout=30)
    assert dept_resp.status_code == 201, f"Department creation failed: {dept_resp.text}"
    department = dept_resp.json()
    department_id = department["id"]
    assert department_id is not None, "Department ID missing"

    # Create provider user account
    # Generate unique email for provider
    random_str = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
    provider_email = f"testprovider_{random_str}@example.com"
    provider_name = f"Test Provider {random_str}"
    provider_payload = {
        "name": provider_name,
        "email": provider_email,
        "organizationId": organization_id,
        "departmentId": department_id,
    }
    provider_resp = session.post(
        f"{BASE_URL}/api/owner/providers/create-user",
        json=provider_payload,
        timeout=30,
    )
    assert provider_resp.status_code == 201, f"Provider creation failed: {provider_resp.text}"
    provider_data = provider_resp.json()
    provider_id = provider_data.get("provider", {}).get("id")
    assert provider_id is not None, "Provider ID missing from creation response"

    try:
        # Verify provider exists by fetching provider data (simulate by GET /api/owner/providers/:id if supported)
        # Since there's no GET endpoint documented for single provider, we skip direct fetch and trust creation.

        # Now delete the provider record
        del_resp = session.delete(f"{BASE_URL}/api/owner/providers/{provider_id}", timeout=30)
        assert del_resp.status_code == 200, f"Provider deletion failed: {del_resp.text}"
        del_json = del_resp.json()
        assert del_json.get("success") is True, "Provider deletion success flag not true"

        # Confirm organization membership cleanup and disable logic
        # No direct endpoint described to verify membership or organization enabled status after deletion.
        # We can attempt to delete the provider again to see 404 error (provider should no longer exist).
        del_resp_2 = session.delete(f"{BASE_URL}/api/owner/providers/{provider_id}", timeout=30)
        assert del_resp_2.status_code == 404, "Provider still exists after deletion"

    finally:
        # Cleanup: just in case provider still exists, try to delete (idempotent)
        session.delete(f"{BASE_URL}/api/owner/providers/{provider_id}", timeout=5)

        # Cleanup department created
        session.delete(f"{BASE_URL}/api/owner/departments/{department_id}", timeout=30)


test_delete_provider_record()
