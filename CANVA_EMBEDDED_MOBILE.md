# Canva Embedded Editor - Mobile Compatible

## Overview

The Canva editor is now embedded directly in the app using an iframe - **no redirects!** It's fully mobile-responsive and works seamlessly on all devices.

## Features

✅ **No Redirects** - Editor opens in iframe within the app
✅ **Mobile Responsive** - Full-screen on mobile, modal on desktop
✅ **Touch-Friendly** - Optimized for mobile interactions
✅ **Auto-Opens** - Editor opens automatically after diary generation

## Mobile Experience

### On Mobile (< 768px):
- **Full-screen dialog** - Takes up entire screen
- **Large close button** - Easy to tap (36x36px)
- **No info banner** - Cleaner interface
- **Touch-optimized** - All interactions work with touch

### On Desktop (≥ 768px):
- **Modal dialog** - 90% viewport height, centered
- **Responsive width** - 95% on tablet, 90% on desktop
- **Info banner** - Shows helpful message at bottom
- **Standard close button** - 40x40px

## Iframe Configuration

The Canva editor is embedded using:

```html
<iframe
  src="https://www.canva.com/_partnership/embed?action=editDesign&designId=XXX&embed=true"
  width="100%"
  height="100%"
  allowFullScreen
  allow="clipboard-read; clipboard-write; camera; microphone; geolocation; autoplay"
  sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-downloads"
/>
```

## URL Format

### For Editing Existing Design:
```
https://www.canva.com/_partnership/embed?action=editDesign&designId={designId}&embed=true&hideBranding=false
```

### For Creating New Design:
```
https://www.canva.com/_partnership/embed?action=createDesign&type=Presentation&embed=true&hideBranding=false
```

## Mobile Breakpoints

- **Mobile**: `< 600px` (xs) - Full screen
- **Tablet**: `600px - 960px` (sm) - 95% width
- **Desktop**: `≥ 960px` (md+) - 90% width, max 1400px

## User Flow

1. **User clicks "Generate Diary"**
   - Backend creates Canva design with content
   - Returns design ID

2. **Editor opens automatically**
   - Iframe loads Canva editor
   - User stays in app (no redirect)
   - On mobile: Full-screen
   - On desktop: Modal dialog

3. **User edits design**
   - All Canva features work in iframe
   - Changes save automatically
   - Touch gestures work on mobile

4. **User closes editor**
   - Click close button
   - Returns to diary page
   - Design is saved

## Technical Details

### Dialog Configuration:
```typescript
<Dialog
  fullScreen={isMobile}  // Full screen on mobile
  maxWidth={false}      // No max width constraint
  PaperProps={{
    height: { xs: '100vh', sm: '90vh' },
    width: { xs: '100%', sm: '95%', md: '90%' },
  }}
/>
```

### Mobile Detection:
```typescript
const theme = useTheme();
const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
```

### CSP Headers:
Updated `next.config.js` to allow Canva iframes:
```javascript
'Content-Security-Policy': "frame-src 'self' https://www.canva.com https://canva.com https://*.canva.com;"
```

## Testing

### Mobile Testing:
1. Open browser DevTools
2. Toggle device toolbar
3. Select mobile device (iPhone, Android)
4. Test editor opening and editing

### Desktop Testing:
1. Open on desktop browser
2. Verify modal dialog appears
3. Check responsive resizing
4. Test all editor features

## Notes

- Canva embed URL requires partnership/API access
- Some features may require Canva partnership
- Iframe sandbox allows necessary permissions
- Editor scales automatically on all screen sizes

## Troubleshooting

**Iframe not loading:**
- Check CSP headers in `next.config.js`
- Verify Canva embed URL is correct
- Check browser console for errors

**Mobile not full-screen:**
- Verify `isMobile` detection works
- Check `fullScreen` prop on Dialog
- Test with actual mobile device

**Touch not working:**
- Verify iframe `sandbox` permissions
- Check `allow` attribute includes needed features
- Test on actual mobile device (not just emulator)



