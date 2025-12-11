# PowerShell script to generate SSL certificates using mkcert
# Run this script: .\generate-cert-simple.ps1

Write-Host "🔐 Generating SSL certificates for localhost..." -ForegroundColor Cyan

# Check if mkcert is installed
$mkcertPath = Get-Command mkcert -ErrorAction SilentlyContinue

if (-not $mkcertPath) {
    Write-Host "❌ mkcert is not installed." -ForegroundColor Red
    Write-Host ""
    Write-Host "To install mkcert:" -ForegroundColor Yellow
    Write-Host "  1. Download from: https://github.com/FiloSottile/mkcert/releases" -ForegroundColor White
    Write-Host "  2. Or install via Chocolatey: choco install mkcert" -ForegroundColor White
    Write-Host ""
    Write-Host "After installing, run this script again." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ mkcert found!" -ForegroundColor Green
Write-Host ""

# Install local CA
Write-Host "Installing local CA..." -ForegroundColor Cyan
try {
    mkcert -install
    Write-Host "✅ Local CA installed" -ForegroundColor Green
} catch {
    Write-Host "⚠️  CA might already be installed" -ForegroundColor Yellow
}

Write-Host ""

# Generate certificates
Write-Host "Generating certificates for localhost..." -ForegroundColor Cyan
try {
    mkcert localhost
    
    # Rename files
    if (Test-Path "localhost+1.pem") {
        Rename-Item -Path "localhost+1.pem" -NewName "cert.pem" -Force
        Write-Host "✅ Created cert.pem" -ForegroundColor Green
    }
    
    if (Test-Path "localhost+1-key.pem") {
        Rename-Item -Path "localhost+1-key.pem" -NewName "key.pem" -Force
        Write-Host "✅ Created key.pem" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "✅ Certificates generated successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Run: pnpm dev:https" -ForegroundColor White
    Write-Host "  2. Open: https://localhost:3000" -ForegroundColor White
    Write-Host "  3. Add https://localhost:3000 to Adobe Developer Console allowed domains" -ForegroundColor White
    
} catch {
    Write-Host "❌ Error generating certificates: $_" -ForegroundColor Red
    exit 1
}

