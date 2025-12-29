# PowerShell script to download transport mode GIFs
# Run this script from the apps/frontend directory

$gifsFolder = "public/gifs"

# Create folder if it doesn't exist
if (-not (Test-Path $gifsFolder)) {
    New-Item -ItemType Directory -Path $gifsFolder -Force
}

Write-Host "Downloading transport mode GIFs..."
Write-Host "Note: You may need to find alternative URLs if these don't work."
Write-Host ""

# Try downloading from various sources
# Note: These URLs may need to be updated with working links

# Walking man with bag
Write-Host "Downloading walking-man-bag.gif..."
try {
    # Try Giphy CDN URL (you'll need to replace with actual Giphy GIF ID)
    # Example: Invoke-WebRequest -Uri "https://media.giphy.com/media/[GIPHY_ID]/giphy.gif" -OutFile "$gifsFolder/walking-man-bag.gif"
    Write-Host "  Please download manually from: https://giphy.com/search/walking-man-bag"
} catch {
    Write-Host "  Failed. Please download manually."
}

# Bicycle
Write-Host "Downloading bicycle.gif..."
try {
    Write-Host "  Please download manually from: https://giphy.com/search/bicycle-animation"
} catch {
    Write-Host "  Failed. Please download manually."
}

# Car
Write-Host "Downloading car.gif..."
try {
    Write-Host "  Please download manually from: https://giphy.com/search/car-animation"
} catch {
    Write-Host "  Failed. Please download manually."
}

# Train
Write-Host "Downloading train.gif..."
try {
    Write-Host "  Please download manually from: https://giphy.com/search/train-animation"
} catch {
    Write-Host "  Failed. Please download manually."
}

# Bus
Write-Host "Downloading bus.gif..."
try {
    Write-Host "  Please download manually from: https://giphy.com/search/bus-animation"
} catch {
    Write-Host "  Failed. Please download manually."
}

# Flight shaking
Write-Host "Downloading flight-shaking.gif..."
try {
    Write-Host "  Please download manually from: https://giphy.com/search/airplane-shaking"
} catch {
    Write-Host "  Failed. Please download manually."
}

Write-Host ""
Write-Host "Manual Download Instructions:"
Write-Host "1. Visit https://giphy.com"
Write-Host "2. Search for each transport mode"
Write-Host "3. Click on a GIF you like"
Write-Host "4. Click 'Download' button"
Write-Host "5. Save with the exact filename in: $gifsFolder"
Write-Host ""
Write-Host "Required filenames:"
Write-Host "  - walking-man-bag.gif"
Write-Host "  - bicycle.gif"
Write-Host "  - car.gif"
Write-Host "  - train.gif"
Write-Host "  - bus.gif"
Write-Host "  - flight-shaking.gif"

