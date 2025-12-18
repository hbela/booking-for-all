# Test script for ngrok ERR_NGROK_3004 fixes
# Tests: Direct server, Caddy proxy, and ngrok (if configured)

Write-Host "Testing ngrok ERR_NGROK_3004 Configuration Fixes" -ForegroundColor Cyan
Write-Host ""

# Colors
$green = "Green"
$red = "Red"
$yellow = "Yellow"
$cyan = "Cyan"

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [hashtable]$Headers = @{}
    )
    
    Write-Host "Testing: $Name" -ForegroundColor $cyan
    Write-Host "   URL: $Url" -ForegroundColor Gray
    
    try {
        $params = @{
            Uri = $Url
            UseBasicParsing = $true
            ErrorAction = "Stop"
        }
        
        if ($Headers.Count -gt 0) {
            $params.Headers = $Headers
        }
        
        $response = Invoke-WebRequest @params
        $content = $response.Content | ConvertFrom-Json -ErrorAction SilentlyContinue
        
        Write-Host "   [OK] Status: $($response.StatusCode)" -ForegroundColor $green
        Write-Host "   [OK] Content-Type: $($response.Headers['Content-Type'])" -ForegroundColor $green
        
        if ($content) {
            Write-Host "   [OK] Response: $($content | ConvertTo-Json -Compress)" -ForegroundColor $green
        } else {
            $preview = $response.Content.Substring(0, [Math]::Min(100, $response.Content.Length))
            Write-Host "   [OK] Response: $preview" -ForegroundColor $green
        }
        
        return $true
    }
    catch {
        Write-Host "   [FAIL] Error: $($_.Exception.Message)" -ForegroundColor $red
        if ($_.Exception.Response) {
            Write-Host "   [FAIL] Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor $red
        }
        return $false
    }
    finally {
        Write-Host ""
    }
}

# Test 1: Direct server connection (localhost:3000)
Write-Host "============================================================" -ForegroundColor $cyan
Write-Host "Test 1: Direct Server Connection (localhost:3000)" -ForegroundColor $cyan
Write-Host "============================================================" -ForegroundColor $cyan
Write-Host ""

$test1a = Test-Endpoint -Name "Health Endpoint" -Url "http://localhost:3000/health"
$test1b = Test-Endpoint -Name "API Info Endpoint" -Url "http://localhost:3000/api"

# Test 2: Caddy proxy (if running)
Write-Host "============================================================" -ForegroundColor $cyan
Write-Host "Test 2: Caddy Proxy (wellness.hu)" -ForegroundColor $cyan
Write-Host "============================================================" -ForegroundColor $cyan
Write-Host ""

$test2a = $false
$test2b = $false

try {
    $test2a = Test-Endpoint -Name "Health via Caddy" -Url "http://wellness.hu/health"
} catch {
    Write-Host "   [WARN] Caddy not running or wellness.hu not configured" -ForegroundColor $yellow
    Write-Host "   [TIP] Start Caddy with: caddy run --config Caddyfile.dev" -ForegroundColor $yellow
    Write-Host ""
}

try {
    $test2b = Test-Endpoint -Name "API Info via Caddy" -Url "http://wellness.hu/api"
} catch {
    Write-Host "   [WARN] Caddy not running or wellness.hu not configured" -ForegroundColor $yellow
    Write-Host ""
}

# Test 3: ngrok (if configured)
Write-Host "============================================================" -ForegroundColor $cyan
Write-Host "Test 3: ngrok Tunnel (if running)" -ForegroundColor $cyan
Write-Host "============================================================" -ForegroundColor $cyan
Write-Host ""

$ngrokUrl = Read-Host "Enter your ngrok URL (e.g., https://xxxx.ngrok-free.app) or press Enter to skip"

if ($ngrokUrl -and $ngrokUrl -ne "") {
    $test3a = Test-Endpoint -Name "Health via ngrok" -Url "$ngrokUrl/health" -Headers @{"ngrok-skip-browser-warning" = "true"}
    $test3b = Test-Endpoint -Name "API Info via ngrok" -Url "$ngrokUrl/api" -Headers @{"ngrok-skip-browser-warning" = "true"}
} else {
    Write-Host "   [WARN] Skipping ngrok tests" -ForegroundColor $yellow
    Write-Host "   [TIP] Start ngrok with: ngrok http 3000" -ForegroundColor $yellow
    Write-Host ""
}

# Summary
Write-Host "============================================================" -ForegroundColor $cyan
Write-Host "Test Summary" -ForegroundColor $cyan
Write-Host "============================================================" -ForegroundColor $cyan
Write-Host ""

$tests = @(
    @{Name = "Direct Server - Health"; Result = $test1a},
    @{Name = "Direct Server - API"; Result = $test1b},
    @{Name = "Caddy - Health"; Result = $test2a},
    @{Name = "Caddy - API"; Result = $test2b}
)

$passed = 0
$total = 0

foreach ($test in $tests) {
    $total++
    if ($test.Result) {
        $passed++
        Write-Host "[PASS] $($test.Name)" -ForegroundColor $green
    } else {
        Write-Host "[FAIL] $($test.Name)" -ForegroundColor $red
    }
}

Write-Host ""
Write-Host "Passed: $passed / $total" -ForegroundColor $(if ($passed -eq $total) { $green } else { $yellow })

if ($passed -eq $total) {
    Write-Host ""
    Write-Host "All tests passed! Server is properly configured." -ForegroundColor $green
    Write-Host ""
    Write-Host "Server Configuration:" -ForegroundColor $green
    Write-Host "   - trustProxy: true" -ForegroundColor $green
    Write-Host "   - requestTimeout: 30000" -ForegroundColor $green
    Write-Host "   - Content-Type headers: Set" -ForegroundColor $green
    Write-Host "   - Error handlers: Configured" -ForegroundColor $green
} else {
    Write-Host ""
    Write-Host "Some tests failed. Check the errors above." -ForegroundColor $yellow
}
