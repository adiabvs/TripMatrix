# Transport Mode GIFs

This folder should contain animated GIFs for different transport modes:

- `walking-man-bag.gif` - Animated person walking with a bag
- `bicycle.gif` - Animated bicycle
- `car.gif` - Animated car
- `train.gif` - Animated train
- `bus.gif` - Animated bus
- `flight-shaking.gif` - Animated airplane (shaking/turbulence effect)

## How to Add GIFs

1. Find GIFs from free sources:
   - Giphy: https://giphy.com (search for "walking man bag", "bicycle", "car", "train", "bus", "airplane")
   - Tenor: https://tenor.com
   - Pixabay: https://pixabay.com/gifs/
   - GIFGIFs: https://gifgifs.com/transportation/

2. Download the GIFs and save them with the exact filenames listed above

3. Place them in this folder: `apps/frontend/public/gifs/`

4. Enable GIFs in `apps/frontend/src/components/TripMapbox.tsx`:
   - Change `const USE_GIFS = false;` to `const USE_GIFS = true;`

## Recommended GIF Specifications

- Size: 32x32px to 64x64px (will be scaled automatically)
- Format: GIF (animated)
- File size: Keep under 500KB for better performance
- Loop: Should loop seamlessly

