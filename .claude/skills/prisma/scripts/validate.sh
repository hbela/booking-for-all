#!/usr/bin/env bash
# validate.sh — Run after adding or modifying a Prisma schema model
# Usage: bash .claude/skills/prisma/scripts/validate.sh [model-name]
#
# Checks:
#   1. Prisma schema is valid (prisma validate)
#   2. Prisma client is up-to-date (prisma generate)
#   3. TypeScript type-check across packages/db
#   4. If a model name is provided, confirms it exists in the schema

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SCHEMA_DIR="$ROOT/packages/db/prisma/schema"
MODEL_NAME="${1:-}"

echo "=== ProjectDeck — Prisma Schema Validator ==="
echo ""

# ── 1. Validate schema syntax ─────────────────────────────────────────────────
echo "▶ Validating Prisma schema..."
cd "$ROOT"
if pnpm --filter @projectdeck/db exec prisma validate --schema "$SCHEMA_DIR" 2>&1; then
  echo "  ✓ Schema is valid"
else
  echo "  ✗ Schema validation failed — fix syntax errors before continuing"
  exit 1
fi
echo ""

# ── 2. Generate Prisma client ─────────────────────────────────────────────────
echo "▶ Regenerating Prisma client..."
if pnpm run db:generate 2>&1; then
  echo "  ✓ Client generated"
else
  echo "  ✗ Client generation failed"
  exit 1
fi
echo ""

# ── 3. TypeScript type-check on packages/db ───────────────────────────────────
echo "▶ Running TypeScript type-check (packages/db)..."
if pnpm --filter @projectdeck/db exec tsc --noEmit 2>&1; then
  echo "  ✓ No type errors"
else
  echo "  ✗ Type errors found — fix before continuing"
  exit 1
fi
echo ""

# ── 4. Model existence check (optional) ──────────────────────────────────────
if [[ -n "$MODEL_NAME" ]]; then
  echo "▶ Checking for model: $MODEL_NAME"

  FOUND=$(grep -rl "^model ${MODEL_NAME} " "$SCHEMA_DIR" 2>/dev/null || true)

  if [[ -n "$FOUND" ]]; then
    echo "  ✓ Model '$MODEL_NAME' found in: $FOUND"

    # Check @@map exists
    FILE="$FOUND"
    if grep -q "@@map(" "$FILE"; then
      echo "  ✓ @@map() table mapping present"
    else
      echo "  ⚠ No @@map() found — consider adding a snake_case table name"
    fi

    # Check updatedAt exists
    if grep -q "updatedAt" "$FILE"; then
      echo "  ✓ updatedAt field present"
    else
      echo "  ⚠ No updatedAt field — consider adding: updatedAt DateTime @updatedAt"
    fi
  else
    echo "  ✗ Model '$MODEL_NAME' not found in $SCHEMA_DIR"
    echo "    Expected a file containing: model $MODEL_NAME {"
    exit 1
  fi
  echo ""
fi

echo "=== All checks passed ==="
echo ""
echo "Next step — push schema to the database:"
echo "  Dev (no migration file):  pnpm run db:push"
echo "  Production (with migration): pnpm run db:migrate"
