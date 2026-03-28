#!/usr/bin/env bash
# validate.sh — Run after TypeScript changes across the monorepo
# Usage: bash .claude/skills/typescript-pro/scripts/validate.sh [file]

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
FILE="${1:-}"

echo "=== booking-for-all — TypeScript Validator ==="
echo ""

# ── 1. Full monorepo type-check ────────────────────────────────────────────────
echo "▶ Running type-check across all packages..."
cd "$ROOT"
if pnpm check-types 2>&1; then
  echo "  ✓ No type errors in any package"
else
  echo "  ✗ Type errors found — fix before continuing"
  exit 1
fi
echo ""

# ── 2. Per-file anti-pattern checks ───────────────────────────────────────────
if [[ -n "$FILE" ]]; then
  echo "▶ Checking $FILE for anti-patterns..."

  if [[ ! -f "$FILE" ]]; then
    echo "  ✗ File not found: $FILE"
    exit 1
  fi

  # No 'any' type
  if grep -qE ": any[^a-zA-Z]|as any" "$FILE"; then
    echo "  ✗ Found 'any' type — use 'unknown' + narrowing or proper generics"
    exit 1
  else
    echo "  ✓ No 'any' types"
  fi

  # No non-null assertions
  if grep -qE "[^!]![^=]" "$FILE"; then
    echo "  ⚠ Non-null assertions (!) found — prefer optional chaining or explicit null checks"
  else
    echo "  ✓ No non-null assertions"
  fi

  # Prefer z.infer over manual interfaces for Zod schemas
  if grep -q "z.object" "$FILE" && ! grep -q "z.infer" "$FILE"; then
    echo "  ⚠ Zod schema defined but z.infer not used — infer types rather than writing duplicate interfaces"
  fi

  echo ""
fi

echo "=== All checks passed ==="
