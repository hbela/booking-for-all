#!/bin/bash

# Initialize BookingProduction Database using Prisma Migrations
# This script helps you set up the production database structure

set -e

echo "=========================================="
echo "BookingProduction Database Initialization"
echo "=========================================="
echo ""

# Check if DIRECT_URL is set
if [ -z "$DIRECT_URL" ]; then
    echo "❌ ERROR: DIRECT_URL environment variable is not set"
    echo ""
    echo "Please set DIRECT_URL with your direct PostgreSQL connection string:"
    echo "  export DIRECT_URL='postgresql://user:password@host:5432/database'"
    echo ""
    echo "You can find this in your Prisma Accelerate dashboard under 'Connection Details'"
    exit 1
fi

# Check if DATABASE_URL is set (optional for migrations, but good to have)
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  WARNING: DATABASE_URL is not set"
    echo "   This is optional for migrations but required for the application"
    echo ""
fi

echo "✅ DIRECT_URL is set"
echo "📋 Deploying migrations..."
echo ""

# Navigate to packages/db directory
cd "$(dirname "$0")/.."

# Deploy migrations
npx prisma migrate deploy

echo ""
echo "✅ Migrations deployed successfully!"
echo ""
echo "Next steps:"
echo "1. Verify the database structure using: npx prisma studio"
echo "2. Set DATABASE_URL in your production environment to the Accelerate URL"
echo "3. Generate Prisma Client for production: pnpm db:generate:prod"
echo ""

