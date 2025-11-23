"""Test script to verify owner authentication and organization fetching"""
from auth_helper import get_owner_session, get_owner_organizations, get_owner_organization_id

def test_owner_auth():
    print("Testing owner authentication...")
    session = get_owner_session()
    print("SUCCESS: Owner authentication successful!")
    
    print("\nFetching owner's organizations...")
    orgs = get_owner_organizations(session)
    print(f"SUCCESS: Found {len(orgs)} organization(s):")
    for org in orgs:
        print(f"  - {org.get('name')} (ID: {org.get('id')}, Enabled: {org.get('enabled')})")
    
    print("\nGetting organization ID for tests...")
    org_id = get_owner_organization_id(session)
    print(f"SUCCESS: Using organization ID: {org_id}")
    
    return session, org_id

if __name__ == "__main__":
    test_owner_auth()

