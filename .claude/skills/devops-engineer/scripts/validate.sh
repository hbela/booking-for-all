#!/usr/bin/env bash
# validate.sh — Validate CI/CD config and build setup
# Usage: bash .claude/skills/devops-engineer/scripts/validate.sh

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

echo "=== booking-for-all — DevOps Validator ==="
echo ""

# ── 1. pnpm lockfile committed ─────────────────────────────────────────────────
echo "▶ Checking pnpm-lock.yaml is committed..."
if [[ -f "$ROOT/pnpm-lock.yaml" ]]; then
  echo "  ✓ pnpm-lock.yaml exists"
else
  echo "  ✗ pnpm-lock.yaml missing — run pnpm install and commit the lockfile"
  exit 1
fi

# ── 2. turbo.json has cache:false for dev/db tasks ─────────────────────────────
echo "▶ Checking turbo.json cache settings..."
TURBO="$ROOT/turbo.json"
if [[ -f "$TURBO" ]]; then
  if grep -q '"cache": false' "$TURBO"; then
    echo "  ✓ cache:false present in turbo.json"
  else
    echo "  ⚠ No 'cache: false' entries found — dev and db:* tasks should not be cached"
  fi
else
  echo "  ⚠ turbo.json not found"
fi

# ── 3. GitHub Actions workflow exists ─────────────────────────────────────────
echo "▶ Checking for GitHub Actions workflow..."
if ls "$ROOT/.github/workflows/"*.yml 2>/dev/null | head -1 | grep -q yml; then
  echo "  ✓ GitHub Actions workflow(s) found"
  # Check for --frozen-lockfile
  if grep -rq "frozen-lockfile" "$ROOT/.github/workflows/"; then
    echo "  ✓ --frozen-lockfile used in CI"
  else
    echo "  ⚠ --frozen-lockfile not found in workflows — add it to pnpm install"
  fi
else
  echo "  ⚠ No GitHub Actions workflows found in .github/workflows/"
fi

# ── 4. Build passes ────────────────────────────────────────────────────────────
echo ""
echo "▶ Running build (this may take a moment)..."
cd "$ROOT"
if pnpm build 2>&1; then
  echo "  ✓ Build succeeded"
else
  echo "  ✗ Build failed — fix before deploying"
  exit 1
fi

echo ""
echo "=== All checks passed ==="
