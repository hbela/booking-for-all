# Security Analysis: `wellness_external.html` Endpoint

## 🚨 Critical Security Vulnerabilities

### 1. **Wide-open CORS Policy** (CRITICAL)
**Location**: `connect.php` line 6
```php
header("Access-Control-Allow-Origin: *"); // Adjust or remove for production
```
**Risk**: **CRITICAL**
- Allows ANY website to make requests to your PHP proxy
- Malicious websites can:
  - Steal API keys through SSRF attacks
  - Make unauthorized API calls on behalf of users
  - Bypass browser same-origin policy restrictions
- **Attack Scenario**: An attacker creates `evil-site.com` that loads `wellness_external.html` in an iframe and manipulates the connection flow

**Fix**: Restrict to specific origins:
```php
header("Access-Control-Allow-Origin: https://your-trusted-domain.com");
```

---

### 2. **No Rate Limiting** (HIGH)
**Location**: `connect.php` - entire file
**Risk**: **HIGH**
- No protection against:
  - **DoS attacks**: Flood the endpoint with requests
  - **Brute force**: Try different organization IDs
  - **Resource exhaustion**: Overwhelm the server
- **Attack Scenario**: An attacker runs a script that makes 10,000 requests/second to `connect.php`

**Fix**: Implement rate limiting (per IP, per organization, etc.)

---

### 3. **API Keys Hardcoded in Source Code** (HIGH)
**Location**: `connect.php` lines 28-47
**Risk**: **HIGH**
- API keys are visible in:
  - Source code repositories (if committed)
  - File system access
  - Server logs
  - Version control history
- **Attack Scenario**: 
  - Developer accidentally commits file to public repo
  - Server compromise exposes all API keys
  - All organizations' keys compromised at once

**Fix**: Move to environment variables or secure key vault:
```php
$ORGANIZATION_API_KEYS = [
    "wellness" => [
        "api_key" => $_ENV['WELLNESS_API_KEY'],
        // ...
    ]
];
```

---

### 4. **Information Disclosure via Debug Messages** (MEDIUM)
**Location**: `connect.php` lines 65-67, 75-78
**Risk**: **MEDIUM**
- Error responses expose:
  - Available organization IDs (enumeration)
  - Internal structure
  - API response formats
- **Attack Scenario**: Attacker tries different `org` parameters to discover all valid organization IDs

**Fix**: Remove debug info in production, return generic error messages

---

### 5. **No Input Validation/Sanitization** (MEDIUM)
**Location**: `connect.php` lines 53-63
**Risk**: **MEDIUM**
- URL parameters used directly without sanitization
- Headers read without validation
- Potential for injection if used in other contexts

**Fix**: Validate and sanitize all inputs:
```php
$organizationId = filter_var($_GET['org'], FILTER_SANITIZE_STRING);
if (!preg_match('/^[a-z0-9_-]+$/i', $organizationId)) {
    // Invalid format
}
```

---

### 6. **Insecure Session Configuration** (MEDIUM)
**Location**: `connect.php` line 18
**Risk**: **MEDIUM**
- No `httponly` flag → vulnerable to XSS
- No `secure` flag → cookies sent over HTTP
- No `SameSite` protection → vulnerable to CSRF

**Fix**: Configure secure sessions:
```php
session_set_cookie_params([
    'httponly' => true,
    'secure' => true, // HTTPS only
    'samesite' => 'Strict'
]);
```

---

### 7. **Open Redirect Vulnerability** (MEDIUM)
**Location**: `connect.php` line 136, `wellness_external.html` line 137
**Risk**: **MEDIUM**
- Redirect URL comes from API response without validation
- If API is compromised, could redirect to malicious site
- **Attack Scenario**: Attacker modifies API response to redirect to `evil-site.com/phishing`

**Fix**: Whitelist allowed redirect domains:
```php
$allowedDomains = ['localhost:3001', 'yourdomain.com'];
$redirectUrl = parse_url($data['redirectUrl']);
if (!in_array($redirectUrl['host'], $allowedDomains)) {
    // Invalid redirect
}
```

---

### 8. **No Authentication/Authorization** (HIGH)
**Location**: `wellness_external.html` and `connect.php`
**Risk**: **HIGH**
- Anyone can access the HTML page
- Anyone can call the PHP proxy endpoint
- No verification that requester is legitimate
- **Attack Scenario**: Attacker directly calls `connect.php?org=wellness` to get organization access

**Fix**: 
- Add token-based authentication
- Verify request origin
- Require user authentication before connecting

---

### 9. **Missing CSRF Protection** (MEDIUM)
**Location**: `wellness_external.html` fetch request
**Risk**: **MEDIUM**
- No CSRF token validation
- Vulnerable to cross-site request forgery
- **Attack Scenario**: Attacker tricks user into clicking link that calls `connect.php` in background

**Fix**: Implement CSRF tokens and validate on server

---

### 10. **HTTP Protocol (No HTTPS)** (MEDIUM)
**Location**: `wellness_external.html` line 100
**Risk**: **MEDIUM**
- Data transmitted in plain text
- Vulnerable to man-in-the-middle attacks
- API keys exposed if intercepted
- **Attack Scenario**: Attacker on same network intercepts traffic

**Fix**: Use HTTPS in production

---

### 11. **No Request Logging/Monitoring** (LOW)
**Location**: `connect.php`
**Risk**: **LOW**
- No audit trail of who accessed what
- Cannot detect suspicious patterns
- No alerting on anomalies

**Fix**: Log all requests with IP, timestamp, organization ID

---

### 12. **Session Storage Usage** (LOW-MEDIUM)
**Location**: `wellness_external.html` lines 132-134
**Risk**: **LOW-MEDIUM**
- Sensitive data stored in `sessionStorage`
- Vulnerable to XSS attacks
- Data persists only per tab, but still accessible via JavaScript

**Fix**: Minimize data stored, validate before using

---

## 🎯 Attack Vectors

### Attack Vector 1: CORS + SSRF Attack
```
1. Attacker creates evil-site.com
2. Embeds wellness_external.html in iframe
3. Manipulates JavaScript to call connect.php
4. PHP proxy makes API call with legitimate API key
5. Attacker intercepts responses or causes DoS
```

### Attack Vector 2: Organization Enumeration
```
1. Attacker tries: connect.php?org=admin
2. Server responds with error listing available orgs
3. Attacker discovers: wellness, medical, fitness
4. Attacker tries each until one works
```

### Attack Vector 3: Open Redirect Phishing
```
1. Attacker compromises API response
2. Sets redirectUrl to evil-site.com/login
3. User redirected to phishing page
4. User enters credentials thinking it's legitimate
```

### Attack Vector 4: DoS via Rate Limiting Bypass
```
1. Attacker uses multiple IPs/proxies
2. Floods connect.php endpoint
3. Server resources exhausted
4. Legitimate users cannot connect
```

### Attack Vector 5: Source Code Exposure
```
1. Developer commits connect.php to public repo
2. API keys visible in GitHub/GitLab
3. Attacker clones repo
4. All organization API keys compromised
```

---

## 🔒 Recommended Security Fixes (Priority Order)

### Immediate (Critical)
1. ✅ Restrict CORS to specific origins
2. ✅ Move API keys to environment variables
3. ✅ Remove debug information from production
4. ✅ Add rate limiting

### High Priority
5. ✅ Add authentication/authorization
6. ✅ Validate and sanitize all inputs
7. ✅ Implement secure session configuration
8. ✅ Add redirect URL validation

### Medium Priority
9. ✅ Add CSRF protection
10. ✅ Implement request logging
11. ✅ Use HTTPS in production
12. ✅ Add monitoring and alerting

---

## 📊 Risk Summary

| Vulnerability | Severity | Exploitability | Impact |
|--------------|----------|----------------|--------|
| Wide-open CORS | CRITICAL | Easy | High |
| No Rate Limiting | HIGH | Easy | High |
| Hardcoded API Keys | HIGH | Medium | Critical |
| No Authentication | HIGH | Easy | High |
| Open Redirect | MEDIUM | Medium | Medium |
| Information Disclosure | MEDIUM | Easy | Low |
| Insecure Sessions | MEDIUM | Medium | Medium |
| No CSRF Protection | MEDIUM | Medium | Medium |
| HTTP Protocol | MEDIUM | Medium | High |
| Input Validation | MEDIUM | Hard | Medium |

---

## 🔍 Testing Checklist

- [ ] Try accessing from different origins (test CORS)
- [ ] Attempt organization enumeration
- [ ] Test rate limiting with many requests
- [ ] Verify API keys not in response
- [ ] Test redirect URL manipulation
- [ ] Check session cookie flags
- [ ] Attempt CSRF attacks
- [ ] Test input with special characters
- [ ] Verify HTTPS enforcement

---

## ⚠️ Current State Assessment

**Overall Security Rating: 🔴 CRITICAL**

The current implementation has multiple critical vulnerabilities that could lead to:
- Complete API key compromise
- Unauthorized access to all organizations
- Denial of service attacks
- Phishing attacks via open redirects
- Cross-site attacks via CORS

**Recommendation**: Do not deploy to production without addressing the critical and high-priority items.

