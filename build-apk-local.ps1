# TraysikelKO Local APK Build Script
param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('debug', 'release')]
    [string]$BuildType = 'debug'
)

Write-Host "`nTraysikelKO - Local APK Build Script`n" -ForegroundColor Cyan

# Step 1: Set up Java
Write-Host "Step 1: Setting up Java environment..." -ForegroundColor Yellow
$javaHome = "C:\Program Files\Android\Android Studio\jbr"
if (Test-Path $javaHome) {
    $env:JAVA_HOME = $javaHome
    $env:PATH = "$javaHome\bin;$env:PATH"
    Write-Host "  OK Java configured" -ForegroundColor Green
} else {
    Write-Host "  ERROR Java not found!" -ForegroundColor Red
    exit 1
}

# Step 2: Verify ANDROID_HOME
Write-Host "`nStep 2: Verifying Android SDK..." -ForegroundColor Yellow
if ($env:ANDROID_HOME) {
    Write-Host "  OK ANDROID_HOME set" -ForegroundColor Green
} else {
    Write-Host "  ERROR ANDROID_HOME not set!" -ForegroundColor Red
    exit 1
}

# Step 3: Clean previous builds
Write-Host "`nStep 3: Cleaning previous builds..." -ForegroundColor Yellow
if (Test-Path "android\app\build") {
    Remove-Item -Recurse -Force "android\app\build" -ErrorAction SilentlyContinue
    Write-Host "  OK Cleaned" -ForegroundColor Green
}

# Step 4: Build the APK
Write-Host "`nStep 4: Building APK ($BuildType)..." -ForegroundColor Yellow
Push-Location android

if ($BuildType -eq 'debug') {
    Write-Host "  Building debug APK..." -ForegroundColor White
    .\gradlew.bat assembleDebug
    $apkPath = "app\build\outputs\apk\debug\app-debug.apk"
} else {
    Write-Host "  Building release APK..." -ForegroundColor White
    .\gradlew.bat assembleRelease
    $apkPath = "app\build\outputs\apk\release\app-release.apk"
}

$buildExit = $LASTEXITCODE
Pop-Location

if ($buildExit -ne 0) {
    Write-Host "`nBuild failed!" -ForegroundColor Red
    exit 1
}

# Step 5: Check if build succeeded
Write-Host "`nStep 5: Verifying build..." -ForegroundColor Yellow
$fullApkPath = Join-Path "android" $apkPath
if (Test-Path $fullApkPath) {
    $apkSize = (Get-Item $fullApkPath).Length / 1MB
    Write-Host "`nBUILD SUCCESSFUL!" -ForegroundColor Green
    Write-Host "APK Location: $fullApkPath" -ForegroundColor Cyan
    Write-Host "APK Size: $([math]::Round($apkSize, 2)) MB" -ForegroundColor Cyan
    
    $outputApk = "TraysikelKO-$BuildType.apk"
    Copy-Item $fullApkPath $outputApk -Force
    Write-Host "`nCopied to: $outputApk" -ForegroundColor Green
    
    Write-Host "`nNext steps:" -ForegroundColor Yellow
    Write-Host "  1. Transfer APK to your Android device" -ForegroundColor White
    Write-Host "  2. Enable 'Install from Unknown Sources'" -ForegroundColor White
    Write-Host "  3. Install and test the APK" -ForegroundColor White
} else {
    Write-Host "`nAPK not found! Build may have failed." -ForegroundColor Red
    exit 1
}
