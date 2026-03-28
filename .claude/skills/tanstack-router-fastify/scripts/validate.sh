#!/usr/bin/env bash
# validate.sh — Run after generating or editing a TanStack Router route in apps/web
# Usage: bash .claude/skills/tanstack-router-fastify/scripts/validate.sh [route-file]
#
# Checks:
#   1. TypeScript type-check across the entire web package
#   2. Route file exists and uses createFileRoute
#   3. Required conventions: head(), beforeLoad session.data check, apiFetch (not raw fetch),
#      redirect re-throw pattern, Route.useLoaderData (not package-level hook)

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
WEB="$ROOT/apps/web"
ROUTE_FILE="${1:-}"

echo "=== booking-for-all — TanStack Router Route Validator ==="
echo ""

# ── 1. Type-check ──────────────────────────────────────────────────────────────
echo "▶ Running TypeScript type-check (apps/web)..."
cd "$ROOT"
if pnpm --filter @booking-for-all/web exec tsc --noEmit 2>&1; then
  echo "  ✓ No type errors"
else
  echo "  ✗ Type errors found — fix before continuing"
  exit 1
fi
echo ""

# ── 2. Route file checks (only if a file was provided) ────────────────────────
if [[ -n "$ROUTE_FILE" ]]; then
  ABS_ROUTE="$WEB/src/routes/$ROUTE_FILE"

  echo "▶ Checking route file: $ABS_ROUTE"

  if [[ ! -f "$ABS_ROUTE" ]]; then
    echo "  ✗ File not found: $ABS_ROUTE"
    exit 1
  fi
  echo "  ✓ File exists"

  # Must use createFileRoute (not createRoute)
  if grep -q "createFileRoute" "$ABS_ROUTE"; then
    echo "  ✓ Uses createFileRoute"
  else
    echo "  ✗ Must use createFileRoute — not createRoute or createLazyFileRoute without a paired loader file"
    exit 1
  fi

  # Must have a head() for SEO
  if grep -q "head:" "$ABS_ROUTE"; then
    echo "  ✓ head() present for SEO"
  else
    echo "  ✗ Missing head() — every route must export meta tags (title, description, og:*, canonical)"
    exit 1
  fi

  # Auth checks must use session.data, not session directly
  if grep -q "session\.data" "$ABS_ROUTE"; then
    echo "  ✓ Uses session.data (correct Better-auth response shape)"
  elif grep -q "getSession\|authClient" "$ABS_ROUTE"; then
    echo "  ✗ Uses authClient.getSession() but does not check session.data — getSession() returns { data: Session | null }"
    exit 1
  else
    echo "  ⚠ No auth check found — ensure this is intentionally a public route"
  fi

  # Redirect errors must be re-thrown
  if grep -q "'to' in error" "$ABS_ROUTE" || grep -q "\"to\" in error" "$ABS_ROUTE"; then
    echo "  ✓ Redirect re-throw pattern present"
  elif grep -q "redirect" "$ABS_ROUTE"; then
    echo "  ✗ Uses redirect() but missing re-throw guard: if (error && typeof error === 'object' && 'to' in error) throw error"
    exit 1
  fi

  # Should use apiFetch, not raw fetch
  if grep -q "apiFetch" "$ABS_ROUTE"; then
    echo "  ✓ Uses apiFetch"
  elif grep -q "await fetch(" "$ABS_ROUTE"; then
    echo "  ✗ Raw fetch() found — use apiFetch from @/lib/apiFetch (handles credentials, ApiError, response unwrapping)"
    exit 1
  fi

  # Route-scoped hooks (Route.useLoaderData not useLoaderData)
  if grep -q "useLoaderData()" "$ABS_ROUTE" && ! grep -q "Route\.useLoaderData" "$ABS_ROUTE"; then
    echo "  ✗ Found useLoaderData() — use Route.useLoaderData() for type safety"
    exit 1
  fi

  # i18n strings
  if grep -q "useTranslation" "$ABS_ROUTE"; then
    echo "  ✓ Uses useTranslation for i18n"
  else
    echo "  ⚠ No useTranslation import — ensure all user-facing strings use i18next"
  fi

  echo ""
fi

echo "=== All checks passed ==="
