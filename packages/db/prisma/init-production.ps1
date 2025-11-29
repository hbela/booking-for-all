# Initialize BookingProduction Database using Prisma Migrations
# PowerShell script for Windows

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "BookingProduction Database Initialization" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if DIRECT_URL is set
if (-not $env:DIRECT_URL) {
    Write-Host "❌ ERROR: DIRECT_URL environment variable is not set" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please set DIRECT_URL with your direct PostgreSQL connection string:" -ForegroundColor Yellow
    Write-Host '  $env:DIRECT_URL="postgresql://user:password@host:5432/database"' -ForegroundColor Yellow
    Write-Host ""
    Write-Host "You can find this in your Prisma Accelerate dashboard under 'Connection Details'" -ForegroundColor Yellow
    exit 1
}

# Check if DATABASE_URL is set (optional for migrations, but good to have)
if (-not $env:DATABASE_URL) {
    Write-Host "⚠️  WARNING: DATABASE_URL is not set" -ForegroundColor Yellow
    Write-Host "   This is optional for migrations but required for the application" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "✅ DIRECT_URL is set" -ForegroundColor Green
Write-Host "📋 Deploying migrations..." -ForegroundColor Cyan
Write-Host ""

# Navigate to packages/db directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $scriptPath "..")

# Deploy migrations
npx prisma migrate deploy

Write-Host ""
Write-Host "✅ Migrations deployed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Verify the database structure using: npx prisma studio"
Write-Host "2. Set DATABASE_URL in your production environment to the Accelerate URL"
Write-Host "3. Generate Prisma Client for production: pnpm db:generate:prod"
Write-Host ""

