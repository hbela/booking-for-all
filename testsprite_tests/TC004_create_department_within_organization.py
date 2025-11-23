import requests
import uuid

BASE_URL = "http://localhost:3000"

def test_create_department_within_organization():
    session = requests.Session()
    # Step 1: Authenticate to get session cookies
    auth_payload = {
        "email": "elystrade@gmail.com",
        "password": "bel2000BELLE$"
    }
    auth_resp = session.post(f"{BASE_URL}/api/auth/sign-in/email", json=auth_payload, timeout=30)
    assert auth_resp.status_code == 200, f"Authentication failed: {auth_resp.text}"

    # Step 2: Get owner's organizations to find an organization ID
    orgs_resp = session.get(f"{BASE_URL}/api/organizations/my-organizations", timeout=30)
    assert orgs_resp.status_code == 200, f"Failed to fetch organizations: {orgs_resp.text}"
    orgs = orgs_resp.json()
    assert isinstance(orgs, list) and len(orgs) > 0, "No organizations found for the owner"
    # Pick first enabled or fallback to first
    organization_id = next((org["id"] for org in orgs if org.get("enabled")), orgs[0]["id"])

    department_id = None
    try:
        # Step 3: Prepare payload for creating a new department with a unique name
        dept_name = f"Test Dept {str(uuid.uuid4())[:8]}"
        dept_payload = {
            "name": dept_name,
            "organizationId": organization_id,
            "description": "Automatically created test department"
        }

        # Step 4: POST to create a department
        create_resp = session.post(f"{BASE_URL}/api/owner/departments", json=dept_payload, timeout=30)
        assert create_resp.status_code == 201, f"Failed to create department: {create_resp.text}"
        dept_data = create_resp.json()

        # Validate response body fields
        assert "id" in dept_data and isinstance(dept_data["id"], str) and dept_data["id"], "Missing or invalid id in response"
        assert dept_data.get("name") == dept_name, "Department name does not match"
        assert dept_data.get("organizationId") == organization_id, "Organization ID does not match"
        assert "createdAt" in dept_data and isinstance(dept_data["createdAt"], str), "Missing createdAt in response"
        assert "updatedAt" in dept_data and isinstance(dept_data["updatedAt"], str), "Missing updatedAt in response"
        assert "description" in dept_data, "Missing description in response"

        department_id = dept_data["id"]
    finally:
        # Cleanup: Delete created department if created
        if department_id:
            del_resp = session.delete(f"{BASE_URL}/api/owner/departments/{department_id}", timeout=30)
            # We won't assert delete success here because test focus is creation,
            # but log if fails
            if del_resp.status_code != 200:
                print(f"Warning: Cleanup failed to delete department id {department_id}: {del_resp.status_code} {del_resp.text}")

test_create_department_within_organization()
