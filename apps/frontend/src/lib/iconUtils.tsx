// Utility to get mode of travel icons as SVG strings for use in map markers
// Using Material Design Icons SVG paths
export const getModeIconSVG = (mode: string | null | undefined, color: string = 'currentColor'): string => {
  // Material Design Icons SVG paths (from react-icons/md)
  const iconMap: Record<string, { viewBox: string; paths: string[] }> = {
    walk: {
      viewBox: '0 0 24 24',
      paths: ['M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z']
    },
    bike: {
      viewBox: '0 0 24 24',
      paths: ['M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm2.5-1.5L11 12l-1.5 1.5L8 12l-.5-1.5zm8.5 1.5c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-2.5 1.5L13 12l1.5-1.5L16 12l.5 1.5z']
    },
    car: {
      viewBox: '0 0 24 24',
      paths: ['M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z']
    },
    train: {
      viewBox: '0 0 24 24',
      paths: ['M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2.23l2-2H14l2 2H18v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z']
    },
    bus: {
      viewBox: '0 0 24 24',
      paths: ['M4 16c0 .88.39 1.67 1 2.22V20a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h8v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4S4 2.5 4 6v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z']
    },
    flight: {
      viewBox: '0 0 24 24',
      paths: ['M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z']
    },
  };
  
  const icon = iconMap[mode || ''] || {
    viewBox: '0 0 24 24',
    paths: ['M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z']
  };
  
  const pathsHTML = icon.paths.map(path => `<path d="${path}" fill="${color}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}" style="width: 20px; height: 20px; display: block;">${pathsHTML}</svg>`;
};

// Get animated GIF URL for mode of travel
// Priority: Local GIFs in /public/gifs/ folder, then fallback to CDN URLs
// 
// TO USE YOUR OWN GIFs:
// 1. Create a folder: apps/frontend/public/gifs/
// 2. Add your GIF files with these exact names:
//    - walking-man-bag.gif (for walk mode - animated person walking with bag)
//    - bicycle.gif (for bike mode - animated bicycle)
//    - car.gif (for car mode - animated car)
//    - train.gif (for train mode - animated train)
//    - bus.gif (for bus mode - animated bus)
//    - flight-shaking.gif (for flight mode - animated airplane shaking)
// 3. The code will automatically use local files if they exist, otherwise use CDN fallback
export const getModeGifUrl = (mode: string | null | undefined): string | null => {
  if (!mode) return null;
  
  // Local GIFs from /public/gifs/ folder (served at /gifs/ in Next.js)
  // These will be used if files exist in public/gifs/ folder
  const localGifMap: Record<string, string> = {
    walk: '/gifs/walking-man-bag.gif',
    bike: '/gifs/bicycle.gif',
    car: '/gifs/car.gif',
    train: '/gifs/train.gif',
    bus: '/gifs/bus.gif',
    flight: '/gifs/flight-shaking.gif',
  };
  
  // CDN fallback URLs (replace these with better GIF URLs from Giphy, Tenor, etc.)
  // Or set to null to force using local files only
  const cdnGifMap: Record<string, string | null> = {
    // Walking man with bag - find on Giphy: https://giphy.com/search/walking-man-bag
    walk: null, // Set to null to use local file, or provide CDN URL
    
    // Bicycle animation - find on Giphy: https://giphy.com/search/bicycle-animation
    bike: null, // Set to null to use local file, or provide CDN URL
    
    // Car animation - find on Giphy: https://giphy.com/search/car-animation
    car: null, // Set to null to use local file, or provide CDN URL
    
    // Train animation - find on Giphy: https://giphy.com/search/train-animation
    train: null, // Set to null to use local file, or provide CDN URL
    
    // Bus animation - find on Giphy: https://giphy.com/search/bus-animation
    bus: null, // Set to null to use local file, or provide CDN URL
    
    // Flight/airplane shaking - find on Giphy: https://giphy.com/search/airplane-shaking
    flight: null, // Set to null to use local file, or provide CDN URL
  };
  
  // Prefer local files, fallback to CDN if local doesn't exist
  // Browser will handle 404 if local file doesn't exist, so we try local first
  return localGifMap[mode] || cdnGifMap[mode] || null;
};

// Get mode icon as HTML (SVG icons)
export const getModeIconHTML = (mode: string | null | undefined, color: string = 'currentColor', useGif: boolean = false): string => {
  // Return SVG icons
  return getModeIconSVG(mode, color);
};

