#!/usr/bin/env bash
# validate.sh — Run after generating or editing a Fastify route in apps/server
# Usage: bash .claude/skills/fastify/scripts/validate.sh [route-file]
#
# Checks:
#   1. TypeScript type-check across the entire server package
#   2. Confirms the route file exists and is exported correctly
#   3. Confirms the route is registered in index.ts

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SERVER="$ROOT/apps/server"
ROUTE_FILE="${1:-}"

echo "=== ProjectDeck — Fastify Route Validator ==="
echo ""

# ── 1. Type-check ─────────────────────────────────────────────────────────────
echo "▶ Running TypeScript type-check (apps/server)..."
cd "$ROOT"
if pnpm --filter @projectdeck/server exec tsc --noEmit 2>&1; then
  echo "  ✓ No type errors"
else
  echo "  ✗ Type errors found — fix before continuing"
  exit 1
fi
echo ""

# ── 2. Route file checks (only if a file was provided) ────────────────────────
if [[ -n "$ROUTE_FILE" ]]; then
  ABS_ROUTE="$SERVER/src/routes/$ROUTE_FILE"

  echo "▶ Checking route file: $ABS_ROUTE"

  if [[ ! -f "$ABS_ROUTE" ]]; then
    echo "  ✗ File not found: $ABS_ROUTE"
    exit 1
  fi
  echo "  ✓ File exists"

  # Confirm it exports a FastifyPluginAsync
  if grep -q "FastifyPluginAsync" "$ABS_ROUTE"; then
    echo "  ✓ Exports FastifyPluginAsync"
  else
    echo "  ✗ Missing FastifyPluginAsync export — check the route module structure"
    exit 1
  fi

  # Derive the expected export name from the filename (e.g. tasks.ts → tasksRoutes)
  BASENAME=$(basename "$ROUTE_FILE" .ts)
  EXPORT_NAME="${BASENAME}Routes"

  if grep -q "export const ${EXPORT_NAME}" "$ABS_ROUTE"; then
    echo "  ✓ Found export: $EXPORT_NAME"
  else
    echo "  ✗ Expected export '${EXPORT_NAME}' not found in $ROUTE_FILE"
    exit 1
  fi
  echo ""

  # ── 3. Registration check ────────────────────────────────────────────────────
  INDEX="$SERVER/src/index.ts"
  echo "▶ Checking registration in index.ts..."

  if grep -q "$EXPORT_NAME" "$INDEX"; then
    echo "  ✓ Route is registered in index.ts"
  else
    echo "  ✗ '$EXPORT_NAME' not found in index.ts — add:"
    echo "      import { $EXPORT_NAME } from \"./routes/$BASENAME\";"
    echo "      fastify.register($EXPORT_NAME, { prefix: \"/api/$BASENAME\" });"
    exit 1
  fi
  echo ""
fi

echo "=== All checks passed ==="
