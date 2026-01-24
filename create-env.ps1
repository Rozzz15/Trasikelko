# Create .env file automatically
# Run this script on new devices after cloning

Write-Host "Creating .env file..." -ForegroundColor Cyan

$envContent = @"
EXPO_PUBLIC_SUPABASE_URL=https://ohuhbchbhdjevsoksqqz.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9odWhiY2hiaGRqZXZzb2tzcXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODkxMDUsImV4cCI6MjA4NDA2NTEwNX0.bAHXqTW9WReQ6m0dQ7YUHN5441wrOqmihwiYfce5M9A
"@

$envContent | Out-File -FilePath ".env" -Encoding utf8

if (Test-Path ".env") {
    Write-Host "✅ .env file created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Contents:" -ForegroundColor Yellow
    Get-Content ".env"
} else {
    Write-Host "❌ Failed to create .env file" -ForegroundColor Red
}
