# ClassGuru Ad Service - API Test Script
# PowerShell script to test all API endpoints

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "ClassGuru Ad Service - API Tests" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$baseUrl = "http://localhost:8791"
$testsPassed = 0
$testsFailed = 0

# Function to test endpoint
function Test-Endpoint {
    param (
        [string]$Name,
        [string]$Method,
        [string]$Url,
        [object]$Body = $null
    )
    
    Write-Host "Testing: $Name..." -NoNewline
    
    try {
        if ($Method -eq "GET") {
            $response = Invoke-RestMethod -Uri $Url -Method GET -ErrorAction Stop
        } else {
            $json = $Body | ConvertTo-Json
            $response = Invoke-RestMethod -Uri $Url -Method POST -Body $json -ContentType "application/json" -ErrorAction Stop
        }
        
        Write-Host " ✓ PASSED" -ForegroundColor Green
        Write-Host "  Response: $($response | ConvertTo-Json -Depth 2 -Compress)" -ForegroundColor Gray
        $script:testsPassed++
        return $true
    }
    catch {
        Write-Host " ✗ FAILED" -ForegroundColor Red
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
        $script:testsFailed++
        return $false
    }
}

# Wait for server to be ready
Write-Host "Checking if server is running..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

# Test 1: Health Check
Write-Host "`n--- Test 1: Health Check ---" -ForegroundColor Cyan
Test-Endpoint -Name "Health Check" -Method "GET" -Url "$baseUrl/api/ads/health"

# Test 2: Get AdSense Config
Write-Host "`n--- Test 2: AdSense Config ---" -ForegroundColor Cyan
Test-Endpoint -Name "Get AdSense Config" -Method "GET" -Url "$baseUrl/api/ads/config"

# Test 3: Request Banner Ad
Write-Host "`n--- Test 3: Request Banner Ad ---" -ForegroundColor Cyan
$adRequest = @{
    page = "/test-page"
    format = "banner"
    sessionId = "test-session-" + (Get-Random)
    deviceType = "desktop"
}
$adResponse = Test-Endpoint -Name "Request Banner Ad" -Method "POST" -Url "$baseUrl/api/ads/request" -Body $adRequest

# Test 4: Request Rectangle Ad
Write-Host "`n--- Test 4: Request Rectangle Ad ---" -ForegroundColor Cyan
$adRequest2 = @{
    page = "/home"
    format = "rectangle"
    sessionId = "test-session-" + (Get-Random)
    deviceType = "mobile"
}
Test-Endpoint -Name "Request Rectangle Ad" -Method "POST" -Url "$baseUrl/api/ads/request" -Body $adRequest2

# Test 5: Track Ad Click
Write-Host "`n--- Test 5: Track Ad Click ---" -ForegroundColor Cyan
$clickRequest = @{
    impressionId = "mock_imp_" + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + "_test123"
    clickUrl = "https://example.com/ad-destination"
}
Test-Endpoint -Name "Track Ad Click" -Method "POST" -Url "$baseUrl/api/ads/click" -Body $clickRequest

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Tests Passed: $testsPassed" -ForegroundColor Green
Write-Host "Tests Failed: $testsFailed" -ForegroundColor $(if ($testsFailed -gt 0) { "Red" } else { "Green" })
Write-Host "Total Tests:  $($testsPassed + $testsFailed)" -ForegroundColor White

if ($testsFailed -eq 0) {
    Write-Host "`n✓ All tests passed! Server is working correctly." -ForegroundColor Green
} else {
    Write-Host "`n✗ Some tests failed. Check the output above." -ForegroundColor Red
}

Write-Host ""
