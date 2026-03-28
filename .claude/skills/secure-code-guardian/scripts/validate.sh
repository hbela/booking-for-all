#!/usr/bin/env bash
# validate.sh — Security audit for a Fastify route file
# Usage: bash .claude/skills/secure-code-guardian/scripts/validate.sh <route-file>

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
FILE="${1:-}"

echo "=== booking-for-all — Security Validator ==="
echo ""

if [[ -z "$FILE" ]]; then
  echo "Usage: validate.sh <path-to-route-file>"
  exit 1
fi

if [[ ! -f "$FILE" ]]; then
  echo "  ✗ File not found: $FILE"
  exit 1
fi

PASS=true

# ── 1. Session check present ───────────────────────────────────────────────────
echo "▶ Checking for session validation..."
if grep -qE "request\.session|session\?" "$FILE"; then
  echo "  ✓ Session check present"
else
  echo "  ✗ No session check found — protected routes must validate request.session"
  PASS=false
fi

# ── 2. RBAC via authz plugin ───────────────────────────────────────────────────
echo "▶ Checking for RBAC enforcement..."
if grep -q "fastify.authorize" "$FILE"; then
  echo "  ✓ fastify.authorize() used for RBAC"
elif grep -qE "\.role\s*!==" "$FILE"; then
  echo "  ⚠ Inline role check found — use fastify.authorize() instead for consistency"
else
  echo "  ⚠ No RBAC check found — is this route intentionally public?"
fi

# ── 3. Org scoping ─────────────────────────────────────────────────────────────
echo "▶ Checking for org scoping in DB queries..."
if grep -q "organizationId" "$FILE"; then
  echo "  ✓ organizationId present in queries"
else
  echo "  ✗ No organizationId filter found — all queries must be scoped to the active org"
  PASS=false
fi

# ── 4. Input validation ────────────────────────────────────────────────────────
echo "▶ Checking for input validation..."
if grep -qE "safeParse|\.parse\(" "$FILE"; then
  echo "  ✓ Zod validation present"
else
  echo "  ✗ No Zod safeParse/parse found — validate all external input before use"
  PASS=false
fi

# ── 5. No clientId / role from request body ────────────────────────────────────
echo "▶ Checking for privilege escalation vectors..."
if grep -qE "body\.(clientId|role|isAdmin|isSystemAdmin)" "$FILE"; then
  echo "  ✗ Sensitive field read from request body — take clientId/role from session, not user input"
  PASS=false
else
  echo "  ✓ No sensitive fields taken from request body"
fi

echo ""

if [[ "$PASS" == "true" ]]; then
  echo "=== All security checks passed ==="
else
  echo "=== Security issues found — fix before merging ==="
  exit 1
fi
