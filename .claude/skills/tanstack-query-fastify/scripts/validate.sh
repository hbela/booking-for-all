#!/usr/bin/env bash
# validate.sh — Run after generating or editing a TanStack Query hook in apps/web
# Usage: bash .claude/skills/tanstack-query-fastify/scripts/validate.sh [hook-file]
#
# Checks:
#   1. TypeScript type-check across the entire web package
#   2. Hook file exists and exports at least one function
#   3. Query key entries exist in lib/query-keys.ts for the hook's resource

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
WEB="$ROOT/apps/web"
HOOK_FILE="${1:-}"

echo "=== booking-for-all — TanStack Query Hook Validator ==="
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

# ── 2. Hook file checks (only if a file was provided) ─────────────────────────
if [[ -n "$HOOK_FILE" ]]; then
  ABS_HOOK="$WEB/src/hooks/$HOOK_FILE"

  echo "▶ Checking hook file: $ABS_HOOK"

  if [[ ! -f "$ABS_HOOK" ]]; then
    echo "  ✗ File not found: $ABS_HOOK"
    exit 1
  fi
  echo "  ✓ File exists"

  # Confirm it exports at least one function
  if grep -q "^export function use" "$ABS_HOOK"; then
    echo "  ✓ Exports at least one hook (export function use...)"
  else
    echo "  ✗ No exported hook functions found — expected at least one 'export function use*'"
    exit 1
  fi

  # Confirm credentials: 'include' is present
  if grep -q "credentials.*include" "$ABS_HOOK"; then
    echo "  ✓ credentials: 'include' present"
  else
    echo "  ✗ Missing credentials: 'include' — Better-auth requires cookie forwarding"
    exit 1
  fi

  # Confirm VITE_SERVER_URL is used
  if grep -q "VITE_SERVER_URL" "$ABS_HOOK"; then
    echo "  ✓ Uses VITE_SERVER_URL"
  else
    echo "  ✗ Base URL should come from import.meta.env.VITE_SERVER_URL"
    exit 1
  fi

  echo ""

  # ── 3. Query key check ────────────────────────────────────────────────────────
  QUERY_KEYS_FILE="$WEB/src/lib/query-keys.ts"
  # Derive resource name from filename: use-bookings.ts → bookings
  BASENAME=$(basename "$HOOK_FILE" .ts)
  RESOURCE="${BASENAME#use-}"

  echo "▶ Checking query keys for resource '${RESOURCE}' in lib/query-keys.ts..."

  if [[ ! -f "$QUERY_KEYS_FILE" ]]; then
    echo "  ⚠ $QUERY_KEYS_FILE not found — skipping query key check"
  elif grep -q "${RESOURCE}:" "$QUERY_KEYS_FILE"; then
    echo "  ✓ Query key section '${RESOURCE}' exists in query-keys.ts"
  else
    echo "  ✗ No query key entry for '${RESOURCE}' found in query-keys.ts"
    echo "      Add a '${RESOURCE}' section following the factory pattern in template.md"
    exit 1
  fi
  echo ""
fi

echo "=== All checks passed ==="
