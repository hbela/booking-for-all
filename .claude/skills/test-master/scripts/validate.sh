#!/usr/bin/env bash
# validate.sh — Run tests and check test file conventions
# Usage: bash .claude/skills/test-master/scripts/validate.sh [test-file]

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
FILE="${1:-}"

echo "=== booking-for-all — Test Validator ==="
echo ""

# ── 1. Run server tests ────────────────────────────────────────────────────────
echo "▶ Running server tests..."
cd "$ROOT"
if pnpm --filter @booking-for-all/server test:run 2>&1; then
  echo "  ✓ All server tests pass"
else
  echo "  ✗ Server tests failed"
  exit 1
fi
echo ""

# ── 2. Per-file checks ─────────────────────────────────────────────────────────
if [[ -n "$FILE" ]]; then
  echo "▶ Checking test file: $FILE"

  if [[ ! -f "$FILE" ]]; then
    echo "  ✗ File not found: $FILE"
    exit 1
  fi

  # Must have describe + it blocks
  if grep -q "describe(" "$FILE" && grep -q "it(" "$FILE"; then
    echo "  ✓ Has describe/it structure"
  else
    echo "  ✗ Missing describe() or it() blocks"
    exit 1
  fi

  # Should test the 401 case for server route tests
  if echo "$FILE" | grep -q "server" && ! grep -q "401" "$FILE"; then
    echo "  ⚠ No 401 test found — consider testing unauthenticated access"
  fi

  # Should test the 403/RBAC case
  if echo "$FILE" | grep -q "server" && ! grep -q "403" "$FILE"; then
    echo "  ⚠ No 403 test found — consider testing wrong role access"
  fi

  # React tests should have wrapper with QueryClientProvider
  if echo "$FILE" | grep -q "\.test\.tsx" && ! grep -q "QueryClientProvider" "$FILE"; then
    echo "  ⚠ No QueryClientProvider wrapper found — hooks that use TanStack Query need it"
  fi

  echo ""
fi

echo "=== All checks passed ==="
