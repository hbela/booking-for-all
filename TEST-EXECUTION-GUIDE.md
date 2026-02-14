# 🧪 Interactive Test Execution Guide
## Organization-Scoped Authentication Method Validation

---

## ✅ Pre-Test Setup

### Step 1: Get Organization IDs from Prisma Studio

Since Prisma Studio is already running (terminal 1), open it in your browser:
- URL: `http://localhost:5555`
- Click on `organization` table
- **Copy the IDs for:**
  - Medicare organization → `__MEDICARE_ORG_ID__`
  - Wellness organization (or any second org) → `__WELLNESS_ORG_ID__`

### Step 2: Check Existing Users & Members

In Prisma Studio:
- Click on `member` table
- Note which users already exist and their `authMethod`
- We'll use these for testing

### Step 3: Start Servers (if not running)

Open two terminals:

**Terminal 1 - Backend:**
```bash
cd apps/server
npm run dev
```
Server should start on `http://localhost:3000`

**Terminal 2 - Frontend:**
```bash
cd apps/web  
npm run dev
```
Frontend should start on `http://localhost:3001`

---

## 📝 Test Execution Checklist

For each test:
1. ✅ Mark PASS if behavior matches expected result
2. ❌ Mark FAIL and note the actual behavior
3. Take screenshots if needed

---

## 🧪 TEST 1: Sign-In with Correct Credential Auth

**Objective:** Verify user can sign in with email/password when they signed up with credentials

**Precondition:**  
- Find a user in Prisma Studio (`member` table) where `authMethod='credential'`
- Note their email and organization ID

**Steps:**
1. Open browser: `http://localhost:3001/login?org=<org-id>`
2. Enter the user's email
3. Enter the password (you need to know this)
4. Click "Sign In"

**Expected Result:**
- ✅ Sign-in succeeds
- ✅ Redirected to dashboard
- ✅ No error messages

**Actual Result:**
```
[ ] PASS
[ ] FAIL - Actual behavior: _________________________________
```

---

## 🧪 TEST 2: Sign-In with Wrong Auth Method (Credential → Google)

**Objective:** Verify validation blocks credential sign-in when user signed up with Google

**Precondition:**  
- Find a user in Prisma Studio where `authMethod='google'`
- Note their email and organization ID

**Steps:**
1. Open browser: `http://localhost:3001/login?org=<org-id>`
2. Enter the Google user's email
3. Enter any password (e.g., `TestPassword123`)
4. Click "Sign In"
5. **BEFORE authentication happens, validation should run**

**Expected Result:**
- ❌ Sign-in blocked
- 🔔 Toast appears: "You have already authenticated with google. Please use that method to login."
- ✅ User stays on login page
- ✅ No backend request to `/signin` endpoint

**Check Browser DevTools Network Tab:**
- Should see: `POST /api/org/<org-id>/validate-auth-method` → returns `valid: false, reason: 'wrong_method'`
- Should NOT see: `POST /api/org/<org-id>/signin`

**Actual Result:**
```
[ ] PASS
[ ] FAIL - Actual behavior: _________________________________
```

---

## 🧪 TEST 3: Sign-In with Wrong Auth Method (Google → Credential)

**Objective:** Verify validation blocks Google sign-in when user signed up with credentials

**Precondition:**  
- Find a user in Prisma Studio where `authMethod='credential'`
- Note their email and organization ID

**Steps:**
1. Open browser: `http://localhost:3001/login?org=<org-id>`
2. Enter the credential user's email in the email field
3. Click "Sign in with Google" button
4. **BEFORE Google OAuth initiates, validation should run**

**Expected Result:**
- ❌ Google OAuth blocked
- 🔔 Toast appears: "You have already authenticated with credential. Please use that method to login."
- ✅ User stays on login page
- ✅ No redirect to Google

**Check Browser DevTools Network Tab:**
- Should see: `POST /api/org/<org-id>/validate-auth-method` → returns `valid: false, reason: 'wrong_method'`
- Should NOT see: Google OAuth redirect

**Actual Result:**
```
[ ] PASS
[ ] FAIL - Actual behavior: _________________________________
```

---

## 🧪 TEST 4: Sign-In Non-Existent User → Redirect to Sign-Up

**Objective:** Verify validation redirects non-member users to sign-up form

**Precondition:**  
- Use an email that does NOT exist in the `member` table
- Example: `nonexistentuser@example.com`

**Steps:**
1. Open browser: `http://localhost:3001/login?org=<any-org-id>`
2. Ensure you're on the SIGN-IN form (not sign-up)
3. Enter: `nonexistentuser@example.com`
4. Enter any password
5. Click "Sign In"

**Expected Result:**
- ❌ Sign-in blocked
- 🔔 Toast appears: "No such user. Please sign up first."
- ✅ Form automatically switches to SIGN-UP view
- ✅ Email field is pre-filled with `nonexistentuser@example.com`

**Check Browser DevTools Network Tab:**
- Should see: `POST /api/org/<org-id>/validate-auth-method` → returns `valid: false, reason: 'user_not_found'` OR `reason: 'no_membership'`

**Actual Result:**
```
[ ] PASS
[ ] FAIL - Actual behavior: _________________________________
```

---

## 🧪 TEST 5: Sign-Up New User with Credentials

**Objective:** Verify new user can sign up with email/password and `authMethod='credential'` is stored

**Precondition:**  
- Use a fresh email: `newcreduser@example.com`

**Steps:**
1. Open browser: `http://localhost:3001/login?org=<wellness-org-id>`
2. Click "Need an account?" to switch to sign-up form
3. Fill in:
   - Name: "New Credential User"
   - Email: `newcreduser@example.com`
   - Password: `TestPassword123!`
4. Click "Sign Up"

**Expected Result:**
- ✅ Sign-up succeeds
- ✅ User is signed in automatically
- ✅ Redirected to client dashboard

**Verify in Prisma Studio:**
1. Open `member` table
2. Find `newcreduser@example.com`
3. Check: `authMethod` should be `'credential'`

**Actual Result:**
```
[ ] PASS
[ ] FAIL - Actual behavior: _________________________________

authMethod in database: ___________
```

---

## 🧪 TEST 6: Sign-Up with Google (New User)

**Objective:** Verify new user can sign up with Google and `authMethod='google'` is stored

**Precondition:**  
- Use a Google account that does NOT exist in the database
- Example: your personal Google email if not yet registered

**Steps:**
1. Open browser: `http://localhost:3001/login?org=<medicare-org-id>`
2. Click "Need an account?" to switch to sign-up form
3. Enter your Google email in the email field (for validation)
4. Click "Sign up with Google"
5. Complete Google OAuth flow

**Expected Result:**
- ✅ Sign-up succeeds via Google
- ✅ User is signed in automatically
- ✅ Redirected to client dashboard

**Verify in Prisma Studio:**
1. Open `member` table
2. Find your Google email
3. Check: `authMethod` should be `'google'`

**Actual Result:**
```
[ ] PASS
[ ] FAIL - Actual behavior: _________________________________

authMethod in database: ___________
```

---

## 🧪 TEST 7: Sign-Up Existing User → Redirect to Sign-In

**Objective:** Verify validation blocks sign-up for existing members and redirects to sign-in

**Precondition:**  
- Use an email that ALREADY exists in the `member` table
- Example: `newcreduser@example.com` (from TEST 5)

**Steps:**
1. Open browser: `http://localhost:3001/login?org=<wellness-org-id>` (same org)
2. Click "Need an account?" to switch to sign-up form
3. Fill in:
   - Name: "Any Name"
   - Email: `newcreduser@example.com`
   - Password: `AnyPassword123`
4. Click "Sign Up"

**Expected Result:**
- ❌ Sign-up blocked
- 🔔 Toast appears: "You already have an account with credential. Please sign in using that method."
- ✅ Form automatically switches to SIGN-IN view

**Check Browser DevTools Network Tab:**
- Should see: `POST /api/org/<org-id>/validate-auth-method` → returns `valid: true` (indicating membership exists)

**Actual Result:**
```
[ ] PASS
[ ] FAIL - Actual behavior: _________________________________
```

---

## 🧪 TEST 8: Backend Security - Direct API Call with Wrong Method

**Objective:** Verify backend rejects direct API calls that bypass frontend validation

**Precondition:**  
- Find a user with `authMethod='google'` in Prisma Studio
- Note their email and organization ID

**Steps:**
1. Open browser DevTools Console (F12)
2. Paste and execute this code (replace `<org-id>` and email):

```javascript
fetch('http://localhost:3000/api/org/<org-id>/signin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    email: 'googleuser@example.com', // User with authMethod='google'
    password: 'anypassword'
  })
}).then(r => r.json()).then(console.log)
```

**Expected Result:**
- ❌ Backend rejects the request
- HTTP Status: `403 Forbidden`
- Response body includes: `"You have already authenticated with google"` or similar

**Actual Result:**
```
[ ] PASS
[ ] FAIL - Response: _________________________________
```

---

## 🧪 TEST 9: Multi-Organization - Different Auth Methods Per Org

**Objective:** Verify user can have different auth methods for different organizations

**Setup:**
1. Create a user with credential auth in Medicare
2. Sign up the SAME email with Google auth in Wellness

**Steps:**
1. Sign in to Medicare with credentials → Should ✅ succeed
2. Sign out
3. Sign in to Medicare with Google → Should ❌ fail ("use credential")
4. Sign in to Wellness with Google → Should ✅ succeed
5. Sign out
6. Sign in to Wellness with credentials → Should ❌ fail ("use google")

**Expected Result:**
- ✅ Each organization enforces its own auth method
- ❌ Wrong method always blocked with appropriate message

**Actual Result:**
```
[ ] PASS
[ ] FAIL - Actual behavior: _________________________________
```

---

## 🧪 TEST 10: Session Management - activeOrganizationId

**Objective:** Verify `activeOrganizationId` is set correctly in session

**Steps:**
1. Sign in to Medicare organization
2. Open Prisma Studio
3. Go to `session` table
4. Find your most recent session (sort by `createdAt` descending)
5. Check the `activeOrganizationId` field

**Expected Result:**
- ✅ `activeOrganizationId` matches the Medicare organization ID
- ✅ Session is linked to correct user

**Verify in Prisma Studio:**
```sql
-- Query to copy from Prisma Studio's query tool:
SELECT 
  s.id,
  s.userId,
  s.activeOrganizationId,
  u.email,
  o.name as organizationName
FROM session s
JOIN "user" u ON s.userId = u.id
LEFT JOIN organization o ON s.activeOrganizationId = o.id
ORDER BY s.createdAt DESC
LIMIT 5;
```

**Actual Result:**
```
[ ] PASS
[ ] FAIL - activeOrganizationId: _________________________________
```

---

## 📊 Test Summary

| Test | Status | Notes |
|------|--------|-------|
| 1. Sign-in correct credential | [ ] P [ ] F | |
| 2. Sign-in wrong method (Cred→Google) | [ ] P [ ] F | |
| 3. Sign-in wrong method (Google→Cred) | [ ] P [ ] F | |
| 4. Sign-in non-existent → Sign-up | [ ] P [ ] F | |
| 5. Sign-up new credential user | [ ] P [ ] F | |
| 6. Sign-up new Google user | [ ] P [ ] F | |
| 7. Sign-up existing → Sign-in | [ ] P [ ] F | |
| 8. Backend security check | [ ] P [ ] F | |
| 9. Multi-org different methods | [ ] P [ ] F | |
| 10. Session management | [ ] P [ ] F | |

**Total Passed:** ___ / 10  
**Total Failed:** ___ / 10

---

## 🐛 Issues Found

Document any bugs or unexpected behavior:

1. **Issue:** ____________________________
   - **Expected:** ____________________________
   - **Actual:** ____________________________
   - **Severity:** [ ] Critical [ ] High [ ] Medium [ ] Low

2. **Issue:** ____________________________
   - **Expected:** ____________________________
   - **Actual:** ____________________________
   - **Severity:** [ ] Critical [ ] High [ ] Medium [ ] Low

---

## 🧹 Cleanup

After testing, remove test users:

1. Open Prisma Studio
2. Go to `member` table → Delete test member records
3. Go to `account` table → Delete test account records
4. Go to `session` table → Delete test session records
5. Go to `user` table → Delete test user records

---

## ✅ Sign-Off

- **Tested by:** ___________________
- **Date:** ___________________
- **Environment:** Development (localhost)
- **All tests passed:** [ ] YES [ ] NO
- **Ready for production:** [ ] YES [ ] NO [ ] NEEDS FIXES


