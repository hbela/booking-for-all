import requests
import uuid

def test_create_provider_record_for_existing_user():
    base_url = "http://localhost:3000"
    session = requests.Session()
    timeout = 30

    # 1. Authenticate and establish session with cookies
    auth_payload = {"email": "elystrade@gmail.com", "password": "bel2000BELLE$"}
    auth_resp = session.post(f"{base_url}/api/auth/sign-in/email", json=auth_payload, timeout=timeout)
    assert auth_resp.status_code == 200, f"Authentication failed: {auth_resp.text}"

    # 2. Fetch owner's organizations
    orgs_resp = session.get(f"{base_url}/api/organizations/my-organizations", timeout=timeout)
    assert orgs_resp.status_code == 200, f"Failed to fetch organizations: {orgs_resp.text}"
    orgs = orgs_resp.json()
    assert isinstance(orgs, list) and len(orgs) > 0, "No organizations found for owner"

    # Choose the first enabled organization or first if none enabled
    organization_id = next((org.get("id") for org in orgs if org.get("enabled")), orgs[0].get("id"))
    assert organization_id, "Valid organization ID not found"

    # 3. Create a new department inside the selected organization (required to link provider)
    department_name = f"Dept-{uuid.uuid4()}"
    dept_payload = {"name": department_name, "organizationId": organization_id}
    dept_resp = session.post(f"{base_url}/api/owner/departments", json=dept_payload, timeout=timeout)
    assert dept_resp.status_code == 201, f"Failed to create department: {dept_resp.text}"
    department = dept_resp.json()
    department_id = department.get("id")
    assert department_id, "Department ID missing in response"

    # 4. Create a new provider with user account to obtain an existing user to create a provider record for
    new_provider_email = f"provider.{uuid.uuid4()}@example.com"
    create_provider_payload = {
        "name": "Temp Provider User",
        "email": new_provider_email,
        "organizationId": organization_id,
        "departmentId": department_id
    }
    create_provider_resp = session.post(f"{base_url}/api/owner/providers/create-user", json=create_provider_payload, timeout=timeout)
    assert create_provider_resp.status_code == 201, f"Failed to create provider user: {create_provider_resp.text}"
    provider_user_data = create_provider_resp.json()
    existing_user_id = provider_user_data.get("user", {}).get("id")
    assert existing_user_id, "User ID missing from provider creation response"

    # 5. Now test POST /api/owner/providers to create a provider record for existing user
    test_bio = "Experienced healthcare provider."
    test_specialization = "Cardiology"
    create_provider_record_payload = {
        "userId": existing_user_id,
        "departmentId": department_id,
        "bio": test_bio,
        "specialization": test_specialization
    }

    # Use try-finally to ensure cleanup of provider record and department after test
    created_provider_record_id = None
    created_provider_user_id = existing_user_id
    try:
        provider_record_resp = session.post(f"{base_url}/api/owner/providers", json=create_provider_record_payload, timeout=timeout)
        assert provider_record_resp.status_code == 201, f"Provider record creation failed: {provider_record_resp.text}"
        provider_record = provider_record_resp.json()
        created_provider_record_id = provider_record.get("id")
        assert created_provider_record_id, "Provider record ID missing in response"
        assert provider_record.get("userId") == existing_user_id, "UserId mismatch in provider record"
        assert provider_record.get("departmentId") == department_id, "DepartmentId mismatch in provider record"
        # Confirm department's organizationId matches
        department_info = provider_record.get("department")
        assert isinstance(department_info, dict), "Missing department info in response"
        assert department_info.get("organizationId") == organization_id, "Department organizationId mismatch"
        # Bio and specialization validations
        assert provider_record.get("bio") == test_bio, "Bio mismatch"
        assert provider_record.get("specialization") == test_specialization, "Specialization mismatch"

    finally:
        # Cleanup: delete provider record if created
        if created_provider_record_id:
            del_resp = session.delete(f"{base_url}/api/owner/providers/{created_provider_record_id}", timeout=timeout)
            # Accept either 200 or 404 if already deleted
            assert del_resp.status_code in (200, 404), f"Cleanup failed deleting provider record: {del_resp.text}"

        # Cleanup: delete the department created
        if department_id:
            del_dept_resp = session.delete(f"{base_url}/api/owner/departments/{department_id}", timeout=timeout)
            assert del_dept_resp.status_code == 200, f"Cleanup failed deleting department: {del_dept_resp.text}"

test_create_provider_record_for_existing_user()
