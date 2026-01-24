# TraysikelKO Rebuild Test Script
# This script helps you rebuild and test the app after the fix

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('quick', 'deep', 'production')]
    [string]$CleanLevel = 'quick'
)

Write-Host "`n╔══════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║          TraysikelKO - Rebuild Test Script v1.0                     ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Step 1: Verify Fix Applied
Write-Host "Step 1: Verifying fix is applied..." -ForegroundColor Yellow
$babelContent = Get-Content babel.config.js -Raw
if ($babelContent -match "'react-native-reanimated/plugin'") {
    Write-Host "  ✅ react-native-reanimated plugin is ENABLED" -ForegroundColor Green
} else {
    Write-Host "  ❌ react-native-reanimated plugin is NOT enabled!" -ForegroundColor Red
    Write-Host "  Please check babel.config.js" -ForegroundColor Red
    exit 1
}

# Step 2: Check for running processes
Write-Host "`nStep 2: Checking for running Metro processes..." -ForegroundColor Yellow
$metroProcess = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($metroProcess) {
    Write-Host "  ⚠️  Node processes detected. If Metro is running, please stop it first." -ForegroundColor Yellow
    Write-Host "  Continuing anyway..." -ForegroundColor Gray
} else {
    Write-Host "  ✅ No Node processes running" -ForegroundColor Green
}

# Step 3: Clean based on level
Write-Host "`nStep 3: Cleaning caches (Level: $CleanLevel)..." -ForegroundColor Yellow

switch ($CleanLevel) {
    'quick' {
        Write-Host "  Running quick clean..." -ForegroundColor White
        # Metro cache will be cleared when starting
        Write-Host "  ✅ Quick clean prepared" -ForegroundColor Green
    }
    'deep' {
        Write-Host "  Running deep clean..." -ForegroundColor White
        if (Test-Path "node_modules/.cache") {
            Remove-Item -Recurse -Force "node_modules/.cache"
            Write-Host "  ✅ Cleared node_modules/.cache" -ForegroundColor Green
        }
        if (Test-Path ".expo") {
            Remove-Item -Recurse -Force ".expo"
            Write-Host "  ✅ Cleared .expo directory" -ForegroundColor Green
        }
    }
    'production' {
        Write-Host "  Running production clean (deep + node_modules)..." -ForegroundColor White
        if (Test-Path "node_modules") {
            Write-Host "  Removing node_modules..." -ForegroundColor Yellow
            Remove-Item -Recurse -Force "node_modules"
            Write-Host "  ✅ Removed node_modules" -ForegroundColor Green
            Write-Host "  Running npm install..." -ForegroundColor Yellow
            npm install
            Write-Host "  ✅ Dependencies reinstalled" -ForegroundColor Green
        }
        if (Test-Path "node_modules/.cache") {
            Remove-Item -Recurse -Force "node_modules/.cache"
        }
        if (Test-Path ".expo") {
            Remove-Item -Recurse -Force ".expo"
        }
    }
}

# Step 4: Verify critical files
Write-Host "`nStep 4: Verifying critical files..." -ForegroundColor Yellow
$criticalFiles = @("package.json", "App.tsx", "app.json", "babel.config.js", ".env")
$allPresent = $true
foreach ($file in $criticalFiles) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file MISSING!" -ForegroundColor Red
        $allPresent = $false
    }
}

if (-not $allPresent) {
    Write-Host "`n❌ Some critical files are missing. Cannot proceed." -ForegroundColor Red
    exit 1
}

# Step 5: Check dependencies
Write-Host "`nStep 5: Verifying key dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules/react-native-reanimated") {
    Write-Host "  ✅ react-native-reanimated installed" -ForegroundColor Green
} else {
    Write-Host "  ❌ react-native-reanimated NOT installed!" -ForegroundColor Red
    Write-Host "  Run: npm install" -ForegroundColor Yellow
    exit 1
}

if (Test-Path "node_modules/react-native-gesture-handler") {
    Write-Host "  ✅ react-native-gesture-handler installed" -ForegroundColor Green
} else {
    Write-Host "  ❌ react-native-gesture-handler NOT installed!" -ForegroundColor Red
    exit 1
}

# Step 6: Ready to start
Write-Host "`n╔══════════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                    ✅ PRE-BUILD CHECKS PASSED                        ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Green

Write-Host "Ready to start Metro bundler with cache cleared!" -ForegroundColor Cyan
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "  1. Run: npx expo start --clear" -ForegroundColor White
Write-Host "  2. Wait for 'Metro waiting on...' message" -ForegroundColor White
Write-Host "  3. Scan QR code with Expo Go app" -ForegroundColor White
Write-Host "  4. Test the app on your phone`n" -ForegroundColor White

# Ask if user wants to start now
$response = Read-Host "Do you want to start Metro bundler now? (y/n)"
if ($response -eq 'y' -or $response -eq 'Y' -or $response -eq 'yes') {
    Write-Host "`nStarting Metro bundler with cache cleared..." -ForegroundColor Cyan
    Write-Host "Watch for any RED error messages!`n" -ForegroundColor Yellow
    npx expo start --clear
} else {
    Write-Host "`nWhen ready, run: npx expo start --clear" -ForegroundColor Cyan
    Write-Host "See REBUILD_TEST.md for complete testing guide.`n" -ForegroundColor Gray
}
