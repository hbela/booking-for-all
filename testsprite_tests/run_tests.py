#!/usr/bin/env python3
"""
Test runner script for manual admin route tests.
This script runs all test files using the auth_helper module.
"""

import sys
import subprocess
import os
from pathlib import Path

# Get the directory where this script is located
test_dir = Path(__file__).parent

# List of test files to run in order
test_files = [
    "TC001_get_all_organizations_should_require_admin_authentication.py",
    "TC002_create_organization_should_validate_unique_name_slug_and_owner_email.py",
    "TC003_create_organization_should_generate_temp_password_and_send_email.py",
    "TC004_create_user_should_enforce_unique_email_and_role_mapping.py",
    "TC005_create_user_should_generate_temp_password_and_require_password_change.py",
    "TC006_get_all_api_keys_should_require_admin_authentication.py",
    "TC007_generate_api_key_should_create_key_with_optional_expiration.py",
    "TC008_delete_api_key_should_soft_delete_and_disable_key.py",
]

def run_test(test_file):
    """Run a single test file and return the result."""
    test_path = test_dir / test_file
    if not test_path.exists():
        print(f"❌ Test file not found: {test_file}")
        return False
    
    print(f"\n{'='*70}")
    print(f"Running: {test_file}")
    print(f"{'='*70}")
    
    try:
        result = subprocess.run(
            [sys.executable, str(test_path)],
            cwd=str(test_dir),
            capture_output=True,
            text=True,
            timeout=120  # 2 minute timeout per test
        )
        
        if result.returncode == 0:
            print(f"✅ PASSED: {test_file}")
            if result.stdout:
                print(result.stdout)
            return True
        else:
            print(f"❌ FAILED: {test_file}")
            if result.stdout:
                print("STDOUT:", result.stdout)
            if result.stderr:
                print("STDERR:", result.stderr)
            return False
    except subprocess.TimeoutExpired:
        print(f"⏱️ TIMEOUT: {test_file} (exceeded 2 minutes)")
        return False
    except Exception as e:
        print(f"❌ ERROR running {test_file}: {e}")
        return False

def main():
    """Run all tests and report results."""
    print("🧪 Starting Manual Test Suite")
    print("=" * 70)
    print("Using Better Auth session authentication via auth_helper.py")
    print("=" * 70)
    
    # Check if server is running
    import requests
    try:
        response = requests.get("http://localhost:3000", timeout=5)
        print("✅ Server is running at http://localhost:3000")
    except Exception as e:
        print("⚠️ WARNING: Cannot reach server at http://localhost:3000")
        print(f"   Error: {e}")
        print("   Please ensure the server is running before continuing.")
        response = input("   Continue anyway? (y/n): ")
        if response.lower() != 'y':
            sys.exit(1)
    
    results = []
    for test_file in test_files:
        passed = run_test(test_file)
        results.append((test_file, passed))
    
    # Print summary
    print("\n" + "=" * 70)
    print("📊 TEST SUMMARY")
    print("=" * 70)
    
    passed_count = sum(1 for _, passed in results if passed)
    total_count = len(results)
    
    for test_file, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{status}: {test_file}")
    
    print("=" * 70)
    print(f"Total: {passed_count}/{total_count} tests passed ({passed_count*100//total_count if total_count > 0 else 0}%)")
    print("=" * 70)
    
    # Exit with error code if any tests failed
    sys.exit(0 if passed_count == total_count else 1)

if __name__ == "__main__":
    main()

