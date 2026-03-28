#!/usr/bin/env bash
# validate.sh — Check Sentry and logging setup in a feature file
# Usage: bash .claude/skills/monitoring-expert/scripts/validate.sh [file]

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
FILE="${1:-}"

echo "=== booking-for-all — Monitoring Validator ==="
echo ""

# ── 1. Type-check ──────────────────────────────────────────────────────────────
echo "▶ Running TypeScript type-check..."
cd "$ROOT"
if pnpm check-types 2>&1; then
  echo "  ✓ No type errors"
else
  echo "  ✗ Type errors found — fix before continuing"
  exit 1
fi
echo ""

# ── 2. Per-file checks ─────────────────────────────────────────────────────────
if [[ -n "$FILE" ]]; then
  echo "▶ Checking monitoring patterns in: $FILE"

  if [[ ! -f "$FILE" ]]; then
    echo "  ✗ File not found: $FILE"
    exit 1
  fi

  # Sentry imported
  if grep -q "@sentry/" "$FILE"; then
    echo "  ✓ Sentry imported"
  else
    echo "  ⚠ No Sentry import — add error capture for critical paths"
  fi

  # Structured logging (not console.log)
  if grep -q "console\.log\|console\.error\|console\.warn" "$FILE"; then
    echo "  ✗ console.log/error/warn found — use request.log or app.log (Fastify logger) instead"
    exit 1
  else
    echo "  ✓ No console.* calls"
  fi

  # No PII in logs
  if grep -qiE "log.*password|log.*token|log.*secret" "$FILE"; then
    echo "  ✗ Possible PII in log statement — never log passwords, tokens, or secrets"
    exit 1
  else
    echo "  ✓ No obvious PII in log statements"
  fi

  echo ""
fi

# ── 3. Check Sentry env vars are documented ────────────────────────────────────
echo "▶ Checking .env files reference Sentry vars..."
SERVER_ENV="$ROOT/apps/server/.env"
if [[ -f "$SERVER_ENV" ]] && grep -q "SENTRY_DSN" "$SERVER_ENV"; then
  echo "  ✓ SENTRY_DSN present in apps/server/.env"
else
  echo "  ⚠ SENTRY_DSN not found in apps/server/.env — add it for error tracking"
fi

echo ""
echo "=== All checks passed ==="
