# Lottie Animations for Transport Modes

This folder should contain Lottie JSON animation files for different transport modes:

- `walking-man-bag.json` - Animated person walking with a bag
- `bicycle.json` - Animated bicycle
- `car.json` - Animated car
- `train.json` - Animated train
- `bus.json` - Animated bus
- `flight-shaking.json` - Animated airplane (shaking/turbulence effect)

## How to Add Lottie Animations

1. **Find Lottie animations** from free sources:
   - LottieFiles: https://lottiefiles.com (search for "walking", "bicycle", "car", "train", "bus", "airplane")
   - Look for animations that are:
     - Free to use (check license)
     - Small file size (< 100KB recommended)
     - Loop seamlessly
     - Simple and clear

2. **Download the JSON files**:
   - On LottieFiles, click on an animation you like
   - Click "Download" → Select "Lottie JSON"
   - Save with the exact filenames listed above

3. **Place them in this folder**: `apps/frontend/public/lottie/`

4. **The code will automatically use them** - no configuration needed!

## Recommended Animation Specifications

- Format: Lottie JSON (.json)
- File size: Keep under 100KB for better performance
- Dimensions: 100x100px to 200x200px (will be scaled to 32px)
- Loop: Should loop seamlessly
- Style: Simple, clear, and recognizable

## Benefits of Lottie over GIFs

- ✅ Vector-based (scales perfectly at any size)
- ✅ Smaller file sizes
- ✅ Better performance
- ✅ Can be styled and colored dynamically
- ✅ Smoother animations

