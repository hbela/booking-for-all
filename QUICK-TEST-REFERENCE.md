# 🧪 Quick Test Reference Card

## 🎯 **Environment**
- ✅ Backend: `http://localhost:3000`
- ✅ Frontend: `http://localhost:3001`
- ✅ Prisma Studio: `http://localhost:5555`

---

## 📝 **Organization IDs (Fill these in first!)**

Open Prisma Studio → `organization` table → Copy IDs:

```
Medicare Org ID:    ___________________________________

Wellness Org ID:    ___________________________________

(Any other orgs):   ___________________________________
```

---

## 🧪 **Priority Tests (Do These First)**

### ✅ **TEST 1: Wrong Auth Method - Credential User Tries Google**

**Find in Prisma Studio:**
- `member` table → Find user where `authMethod = 'credential'`
- Copy their email and organizationId

**Test:**
1. Go to: `http://localhost:3001/login?org=<their-org-id>`
2. Enter their email in the email field
3. Click "Sign in with Google"
4. **Watch for toast:** "You have already authenticated with credential..."

**Expected:**
- ❌ Google sign-in blocked
- 🔔 Toast with correct message
- ✅ Stays on login page

---

### ✅ **TEST 2: Wrong Auth Method - Google User Tries Credential**

**Find in Prisma Studio:**
- `member` table → Find user where `authMethod = 'google'`
- Copy their email and organizationId

**Test:**
1. Go to: `http://localhost:3001/login?org=<their-org-id>`
2. Enter their email
3. Enter any password: `Test123!`
4. Click "Sign In"
5. **Watch for toast:** "You have already authenticated with google..."

**Expected:**
- ❌ Credential sign-in blocked
- 🔔 Toast with correct message
- ✅ Stays on login page

---

### ✅ **TEST 3: Non-Existent User → Redirect to Sign-Up**

**Test:**
1. Go to: `http://localhost:3001/login?org=<any-org-id>`
2. Make sure you're on SIGN-IN form (not sign-up)
3. Enter: `nonexistentuser123@example.com`
4. Enter any password
5. Click "Sign In"
6. **Watch for:**
   - Toast: "No such user. Please sign up first."
   - Form switches to SIGN-UP automatically

**Expected:**
- ❌ Sign-in blocked
- 🔔 Toast appears
- ✅ Form switches to sign-up
- ✅ Email pre-filled

---

### ✅ **TEST 4: New User Sign-Up with Credentials**

**Test:**
1. Go to: `http://localhost:3001/login?org=<wellness-org-id>`
2. Click "Need an account?" → Switch to sign-up
3. Fill:
   - Name: `Test Credential User`
   - Email: `testcred-${Date.now()}@example.com` (use unique email)
   - Password: `TestPassword123!`
4. Click "Sign Up"

**Expected:**
- ✅ Sign-up succeeds
- ✅ Redirected to dashboard
- ✅ Check Prisma Studio: `member` table → `authMethod = 'credential'`

---

### ✅ **TEST 5: Existing User Tries to Sign Up Again**

**Use the user from TEST 4**

**Test:**
1. Sign out if logged in
2. Go to: `http://localhost:3001/login?org=<same-org-id>`
3. Click "Need an account?" → Sign-up form
4. Enter the SAME email from TEST 4
5. Enter any name/password
6. Click "Sign Up"
7. **Watch for:**
   - Toast: "You already have an account with credential..."
   - Form switches to SIGN-IN

**Expected:**
- ❌ Sign-up blocked
- 🔔 Toast appears
- ✅ Form switches to sign-in

---

## 🔍 **How to Check Network Tab (Chrome DevTools)**

Press **F12** → **Network** tab:

### ✅ **For Wrong Auth Method Tests:**
Look for:
```
✅ POST /api/org/<org-id>/validate-auth-method
   Response: { valid: false, reason: 'wrong_method', requiredMethod: '...' }

❌ NO call to POST /api/org/<org-id>/signin
❌ NO redirect to Google OAuth
```

### ✅ **For Non-Existent User Tests:**
Look for:
```
✅ POST /api/org/<org-id>/validate-auth-method
   Response: { valid: false, reason: 'user_not_found' or 'no_membership' }
```

---

## 📊 **Quick Test Results**

| Test | Pass/Fail | Notes |
|------|-----------|-------|
| 1. Credential→Google blocked | [ ] | |
| 2. Google→Credential blocked | [ ] | |
| 3. Non-existent → Sign-up | [ ] | |
| 4. New user sign-up works | [ ] | |
| 5. Existing user blocked | [ ] | |

---

## 🐛 **Common Issues to Watch For**

- ❌ Toast doesn't appear
- ❌ Toast shows wrong message
- ❌ Form doesn't auto-switch
- ❌ Backend still gets called when it shouldn't
- ❌ `authMethod` is NULL in database
- ❌ Error 500 instead of validation message

---

## 💡 **Pro Tips**

1. **Keep Prisma Studio open** - refresh to see database changes
2. **Keep DevTools Network tab open** - watch the API calls
3. **Use unique emails** for new user tests: `test-${Date.now()}@example.com`
4. **Clear browser cache** if getting weird behavior
5. **Check browser console** for any JavaScript errors

---

## 🆘 **If Test Fails**

1. Note what happened (take screenshot)
2. Check browser console for errors (F12 → Console)
3. Check Network tab for actual API responses
4. Check Prisma Studio for database state
5. Let me know and I'll help debug!

---

**Ready? Start with TEST 1!** 🚀



