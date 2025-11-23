import requests
import uuid

BASE_URL = "http://localhost:3000"

def test_create_provider_with_user_account():
    session = requests.Session()
    # Authenticate with POST /api/auth/sign-in/email
    auth_resp = session.post(
        f"{BASE_URL}/api/auth/sign-in/email",
        json={"email": "elystrade@gmail.com", "password": "bel2000BELLE$"},
        timeout=30,
    )
    assert auth_resp.status_code == 200, f"Authentication failed: {auth_resp.text}"

    # Get owner's organizations
    orgs_resp = session.get(f"{BASE_URL}/api/organizations/my-organizations", timeout=30)
    assert orgs_resp.status_code == 200, f"Failed fetching organizations: {orgs_resp.text}"
    orgs = orgs_resp.json()
    assert isinstance(orgs, list) and len(orgs) > 0, "No organizations found for owner"
    # Choose first enabled org or first org
    organization_id = next(
        (org["id"] for org in orgs if org.get("enabled")),
        orgs[0]["id"],
    )

    # Create a department first to secure departmentId for provider creation
    dept_name = "TestDept_" + uuid.uuid4().hex[:8]
    dept_payload = {
        "name": dept_name,
        "organizationId": organization_id,
    }
    dept_resp = session.post(
        f"{BASE_URL}/api/owner/departments", json=dept_payload, timeout=30
    )
    assert dept_resp.status_code == 201, f"Department creation failed: {dept_resp.text}"
    department = dept_resp.json()
    department_id = department.get("id")
    assert department_id, "No department ID returned"

    # Prepare unique email for provider
    unique_email = f"testprovider_{uuid.uuid4().hex[:8]}@example.com"
    provider_name = "Test Provider " + uuid.uuid4().hex[:6]

    provider_payload = {
        "name": provider_name,
        "email": unique_email,
        "organizationId": organization_id,
        "departmentId": department_id,
        "bio": "Test provider bio",
        "specialization": "Test specialization",
    }

    provider_id = None
    user_id = None

    try:
        # Create provider with user account
        prov_resp = session.post(
            f"{BASE_URL}/api/owner/providers/create-user",
            json=provider_payload,
            timeout=30,
        )
        assert prov_resp.status_code == 201, f"Provider creation failed: {prov_resp.text}"
        prov_json = prov_resp.json()

        # Validate structure of response
        assert "provider" in prov_json and isinstance(prov_json["provider"], dict), "Missing provider in response"
        provider = prov_json["provider"]
        assert "id" in provider and provider["id"], "Provider ID missing"
        provider_id = provider["id"]
        assert provider.get("departmentId") == department_id, "Department ID mismatch in provider"

        assert "user" in prov_json and isinstance(prov_json["user"], dict), "Missing user in response"
        user = prov_json["user"]
        assert user.get("email") == unique_email, "User email mismatch in response"
        assert user.get("name") == provider_name, "User name mismatch in response"
        user_id = user.get("id")
        assert user_id, "User ID missing"

        temp_password = prov_json.get("tempPassword")
        assert temp_password and isinstance(temp_password, str), "Temporary password missing"

        # Validation: Try to create provider with same email should fail (unique email constraint)
        dup_resp = session.post(
            f"{BASE_URL}/api/owner/providers/create-user",
            json=provider_payload,
            timeout=30,
        )
        assert dup_resp.status_code == 400, "Duplicate email did not fail as expected"
        dup_json = dup_resp.json()
        err_msg = dup_json.get("error", "").lower()
        assert "already exists" in err_msg or "duplicate" in err_msg, "Unexpected error message for duplicate email"

        # Validation: Missing required fields should fail
        for missing_field in ["name", "email", "organizationId", "departmentId"]:
            payload_missing = provider_payload.copy()
            payload_missing.pop(missing_field)
            resp_missing = session.post(
                f"{BASE_URL}/api/owner/providers/create-user",
                json=payload_missing,
                timeout=30,
            )
            assert resp_missing.status_code == 400, f"Missing {missing_field} did not fail as expected"
            error_resp = resp_missing.json()
            assert "error" in error_resp and error_resp["error"], f"No error message for missing {missing_field}"

        # Validation: Invalid email format should fail
        payload_invalid_email = provider_payload.copy()
        payload_invalid_email["email"] = "invalid-email"
        resp_invalid_email = session.post(
            f"{BASE_URL}/api/owner/providers/create-user",
            json=payload_invalid_email,
            timeout=30,
        )
        assert resp_invalid_email.status_code == 400, "Invalid email format did not fail as expected"
        err_resp = resp_invalid_email.json()
        assert "error" in err_resp and "email" in err_resp["error"].lower(), "Unexpected error message for invalid email"

        # Validation: Organization membership - try with invalid org ID
        payload_invalid_org = provider_payload.copy()
        payload_invalid_org["organizationId"] = "00000000-0000-0000-0000-000000000000"
        resp_invalid_org = session.post(
            f"{BASE_URL}/api/owner/providers/create-user",
            json=payload_invalid_org,
            timeout=30,
        )
        # Could be 403 Forbidden with membership error or 404 if org not found
        assert resp_invalid_org.status_code in (403, 404), "Invalid organizationId did not fail as expected"
        err_org = resp_invalid_org.json()
        assert "error" in err_org, "No error message for invalid organization"

        # Validation: Department ownership check - department not belonging to org
        # Create a department in another organization (try to fake by changing dept organizationId?)
        # Since we can't create depts in other orgs here, try sending wrong departmentId
        payload_invalid_dept = provider_payload.copy()
        payload_invalid_dept["departmentId"] = "00000000-0000-0000-0000-000000000000"
        resp_invalid_dept = session.post(
            f"{BASE_URL}/api/owner/providers/create-user",
            json=payload_invalid_dept,
            timeout=30,
        )
        assert resp_invalid_dept.status_code == 404, "Invalid departmentId did not fail as expected"
        err_dept = resp_invalid_dept.json()
        assert "error" in err_dept and "department" in err_dept["error"].lower(), "Unexpected error for invalid department"

    finally:
        # Cleanup: delete created provider and user if created
        if provider_id:
            del_resp = session.delete(
                f"{BASE_URL}/api/owner/providers/{provider_id}", timeout=30
            )
            # Deletion may return 200 or 404 if already deleted
            assert del_resp.status_code in (200, 404), f"Failed to delete provider: {del_resp.text}"
        if department_id:
            del_dept_resp = session.delete(
                f"{BASE_URL}/api/owner/departments/{department_id}", timeout=30
            )
            assert del_dept_resp.status_code in (200, 404), f"Failed to delete department: {del_dept_resp.text}"

test_create_provider_with_user_account()
