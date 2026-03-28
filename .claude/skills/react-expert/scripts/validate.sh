#!/usr/bin/env bash
# validate.sh — Run after creating or editing a React component in apps/web
# Usage: bash .claude/skills/react-expert/scripts/validate.sh [component-file]

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
WEB="$ROOT/apps/web"
FILE="${1:-}"

echo "=== booking-for-all — React Component Validator ==="
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

# ── 2. Per-file checks ─────────────────────────────────────────────────────────
if [[ -n "$FILE" ]]; then
  ABS="$WEB/src/$FILE"
  echo "▶ Checking component file: $ABS"

  if [[ ! -f "$ABS" ]]; then
    echo "  ✗ File not found: $ABS"
    exit 1
  fi
  echo "  ✓ File exists"

  # Must export at least one function/const component
  if grep -qE "^export (function|const) [A-Z]" "$ABS"; then
    echo "  ✓ Exports at least one component"
  else
    echo "  ✗ No exported React component found (expected 'export function Foo' or 'export const Foo')"
    exit 1
  fi

  # Should use useTranslation (not hardcoded English strings in JSX)
  if grep -q "useTranslation" "$ABS"; then
    echo "  ✓ Uses useTranslation for i18n"
  else
    echo "  ⚠ No useTranslation found — add i18n if component has user-visible strings"
  fi

  # Should not use inline styles
  if grep -q 'style={{' "$ABS"; then
    echo "  ⚠ Inline styles found — prefer Tailwind utility classes"
  else
    echo "  ✓ No inline styles"
  fi

  echo ""
fi

echo "=== All checks passed ==="
