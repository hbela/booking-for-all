# PowerShell script to test APK install endpoints on Windows
# Usage: .\test-install-endpoint.ps1 -OrgId "your-org-id-here"

param(
    [Parameter(Mandatory=$true)]
    [string]$OrgId,
    
    [string]$BaseUrl = "https://apidev.appointer.hu"
)

Write-Host "🧪 Testing APK Install Endpoints for Organization: $OrgId" -ForegroundColor Cyan
Write-Host "=" * 70

# Test 1: Install API Endpoint
Write-Host "`n📡 Test 1: Install API Endpoint" -ForegroundColor Yellow
Write-Host "GET $BaseUrl/api/install/$OrgId" -ForegroundColor Gray
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/install/$OrgId" -Method Get -Headers @{"Accept"="application/json"}
    Write-Host "✅ Success!" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 10)
    
    # Check for issues
    if ($response.data.apk.downloadUrl -notlike "*$BaseUrl*") {
        Write-Host "`n⚠️  WARNING: APK download URL doesn't match base URL!" -ForegroundColor Yellow
        Write-Host "   Expected: $BaseUrl" -ForegroundColor Gray
        Write-Host "   Got: $($response.data.apk.downloadUrl)" -ForegroundColor Gray
        Write-Host "   Fix: Update PUBLIC_APP_URL environment variable on server" -ForegroundColor Gray
    }
    
    # Check if APK is available
    if ($response.data.apk.available) {
        Write-Host "`n📦 APK Available: $($response.data.apk.downloadUrl)" -ForegroundColor Green
        Write-Host "   Source: $($response.data.apk.source)" -ForegroundColor Gray
        
        # Test if APK URL is accessible
        Write-Host "`n🔗 Testing APK download URL accessibility..." -ForegroundColor Yellow
        try {
            $apkCheck = Invoke-WebRequest -Uri $response.data.apk.downloadUrl -Method Head -ErrorAction Stop
            Write-Host "✅ APK URL is accessible (Status: $($apkCheck.StatusCode))" -ForegroundColor Green
        } catch {
            Write-Host "❌ APK URL is NOT accessible: $($_.Exception.Message)" -ForegroundColor Red
        }
    } else {
        Write-Host "`n❌ APK not available" -ForegroundColor Red
    }
    
    # Check QR code
    if ($response.data.qrCode.available) {
        Write-Host "`n📱 QR Code Available: $($response.data.qrCode.imageUrl)" -ForegroundColor Green
    } else {
        Write-Host "`n⚠️  QR Code not available" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "   Status Code: $statusCode" -ForegroundColor Gray
    }
}

# Test 2: Install Page HTML
Write-Host "`n📡 Test 2: Install Page (HTML)" -ForegroundColor Yellow
Write-Host "GET $BaseUrl/org/$OrgId/app?orgId=$OrgId" -ForegroundColor Gray
try {
    $pageResponse = Invoke-WebRequest -Uri "$BaseUrl/org/$OrgId/app?orgId=$OrgId" -Method Get -ErrorAction Stop
    Write-Host "✅ Success! (Status: $($pageResponse.StatusCode))" -ForegroundColor Green
    Write-Host "   Content-Type: $($pageResponse.Headers.'Content-Type')" -ForegroundColor Gray
    Write-Host "   Content-Length: $($pageResponse.RawContentLength) bytes" -ForegroundColor Gray
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: QR Code Image
Write-Host "`n📡 Test 3: QR Code Image" -ForegroundColor Yellow
try {
    $qrUrl = "$BaseUrl/api/org/$OrgId/qrcode"
    Write-Host "GET $qrUrl" -ForegroundColor Gray
    $qrResponse = Invoke-WebRequest -Uri $qrUrl -Method Head -ErrorAction Stop
    Write-Host "✅ QR Code accessible (Status: $($qrResponse.StatusCode))" -ForegroundColor Green
    Write-Host "   Content-Type: $($qrResponse.Headers.'Content-Type')" -ForegroundColor Gray
} catch {
    Write-Host "❌ QR Code not accessible: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n" + ("=" * 70)
Write-Host "✅ Testing Complete!" -ForegroundColor Cyan

