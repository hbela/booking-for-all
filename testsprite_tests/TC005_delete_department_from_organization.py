import requests
import uuid

BASE_URL = "http://localhost:3000"

def test_TC005_delete_department_from_organization():
    session = requests.Session()
    # Authenticate
    auth_resp = session.post(
        f"{BASE_URL}/api/auth/sign-in/email",
        json={"email": "elystrade@gmail.com", "password": "bel2000BELLE$"},
        timeout=30,
    )
    assert auth_resp.status_code == 200, f"Authentication failed: {auth_resp.text}"

    # Fetch owner's organizations
    orgs_resp = session.get(f"{BASE_URL}/api/organizations/my-organizations", timeout=30)
    assert orgs_resp.status_code == 200, f"Get organizations failed: {orgs_resp.text}"
    orgs = orgs_resp.json()
    assert isinstance(orgs, list) and len(orgs) > 0, "No organizations found for the owner"
    organization_id = next((org["id"] for org in orgs if org.get("enabled")), orgs[0]["id"])

    department_id = None
    try:
        # Create a new department to delete
        dept_name = f"Test Department {uuid.uuid4()}"
        create_dept_resp = session.post(
            f"{BASE_URL}/api/owner/departments",
            json={
                "name": dept_name,
                "organizationId": organization_id,
            },
            timeout=30,
        )
        assert create_dept_resp.status_code == 201, f"Department creation failed: {create_dept_resp.text}"
        department = create_dept_resp.json()
        department_id = department.get("id")
        assert department_id is not None, "Department ID missing in creation response"
        assert department.get("organizationId") == organization_id, "Department orgId mismatch"

        # Verify the department exists by attempting to delete it
        delete_resp = session.delete(
            f"{BASE_URL}/api/owner/departments/{department_id}",
            timeout=30,
        )
        assert delete_resp.status_code == 200, f"Department deletion failed: {delete_resp.text}"
        delete_data = delete_resp.json()
        assert isinstance(delete_data, dict), "Invalid delete response format"
        assert delete_data.get("success") is True, "Department deletion success flag missing or false"

        # Confirm department no longer exists (expect 404)
        verify_del_resp = session.delete(
            f"{BASE_URL}/api/owner/departments/{department_id}",
            timeout=30,
        )
        assert verify_del_resp.status_code == 404, "Deleted department still found or wrong status code on re-delete"

    finally:
        # Cleanup: if deletion failed for some reason and department_id is set, attempt deletion to leave test environment clean
        if department_id is not None:
            try:
                session.delete(f"{BASE_URL}/api/owner/departments/{department_id}", timeout=30)
            except Exception:
                pass

test_TC005_delete_department_from_organization()
