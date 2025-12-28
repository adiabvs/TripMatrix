# Fix Canva 400 Error - Embed Issue

## Problem
Getting `400 - Client error` from Canva when trying to embed the editor in iframe.

## Root Cause
Canva's embed URL format (`_partnership/embed`) may:
1. Require partnership/whitelisting
2. Not be publicly available
3. Need different authentication method

## Solution Options

### Option 1: Use Standard Edit URL (Current)
Using Canva's standard edit URL in iframe:
```
https://www.canva.com/design/{designId}/edit
```

**Limitation:** Canva may block iframe embedding with X-Frame-Options header.

### Option 2: Use Canva DesignButton SDK (Recommended)
Canva provides a DesignButton SDK that handles embedding properly:

```typescript
// Load Canva SDK
const script = document.createElement('script');
script.src = 'https://sdk.canva.com/designbutton/v2/api.js';
script.onload = () => {
  window.Canva.DesignButton.initialize({
    apiKey: 'YOUR_API_KEY',
  }).then((api) => {
    api.editDesign({ designId: 'XXX' });
  });
};
```

### Option 3: Open in New Window/Tab (Fallback)
If embedding doesn't work, open Canva editor in a new window:

```typescript
window.open(`https://www.canva.com/design/${designId}/edit`, '_blank');
```

## Current Implementation

The code now uses the standard edit URL. If Canva blocks iframe embedding:

1. **Check browser console** for X-Frame-Options errors
2. **Try opening in new window** as fallback
3. **Consider using Canva DesignButton SDK** for proper embedding

## Testing

1. **Check if iframe loads:**
   - Open browser DevTools → Network tab
   - Look for iframe request to Canva
   - Check response headers for `X-Frame-Options`

2. **If X-Frame-Options: DENY:**
   - Canva doesn't allow iframe embedding
   - Need to use DesignButton SDK or open in new window

3. **If 400 error persists:**
   - Verify access token is valid
   - Check Canva API status
   - Verify design ID exists

## Next Steps

If standard edit URL doesn't work in iframe:

1. **Implement DesignButton SDK** (best option)
2. **Use new window** as fallback
3. **Contact Canva support** for partnership embed access

## DesignButton SDK Implementation

```typescript
// In CanvaEmbeddedEditor.tsx
useEffect(() => {
  if (designId && isAuthenticated) {
    // Load Canva SDK
    const script = document.createElement('script');
    script.src = 'https://sdk.canva.com/designbutton/v2/api.js';
    script.async = true;
    
    script.onload = () => {
      if (window.Canva?.DesignButton) {
        window.Canva.DesignButton.initialize({
          apiKey: process.env.NEXT_PUBLIC_CANVA_API_KEY,
        }).then((api) => {
          // This opens Canva editor in a modal/overlay
          api.editDesign({ designId });
        });
      }
    };
    
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }
}, [designId, isAuthenticated]);
```

This SDK handles embedding properly and works within your app.






