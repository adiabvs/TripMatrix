# Canva Embed SDK Troubleshooting Guide

## Common Issues and Solutions

### Issue: "Canva editor not initialized"

**Possible Causes:**
1. API key is missing or incorrect
2. Canva SDK failed to load
3. Network/CORS issues
4. API key doesn't have proper permissions

**Solutions:**

1. **Check API Key:**
   ```bash
   # In your frontend .env.local file
   NEXT_PUBLIC_CANVA_API_KEY=your_actual_api_key_here
   ```
   - Make sure there are no extra spaces or quotes
   - Restart your development server after adding/changing the key

2. **Verify API Key:**
   - Go to [Canva Developer Platform](https://www.canva.dev/)
   - Check that your API key is active
   - Verify it has the correct permissions for Embed SDK

3. **Check Browser Console:**
   - Open browser DevTools (F12)
   - Look for errors in the Console tab
   - Check Network tab for failed requests to `sdk.canva.com`

4. **Verify SDK Loading:**
   - Check if `https://sdk.canva.com/v1/embed.js` loads successfully
   - Look for CORS errors
   - Check if `window.Canva` is available after script loads

### Issue: "Design data not available"

**Solution:**
Click the "Regenerate Design Data" button. This will:
- Fetch all trip places
- Sort them by visit time
- Generate the design data structure
- Save it to the database

If regeneration fails:
1. Check that the trip has places
2. Verify trip status is "completed"
3. Check backend logs for errors

### Issue: SDK loads but button doesn't appear

**Possible Causes:**
1. API key is invalid
2. Button container not ready
3. Initialization race condition

**Solutions:**
1. Check browser console for initialization errors
2. Try clicking "Retry Initialization" button
3. Refresh the page
4. Verify API key format is correct

### Issue: "Failed to load Canva Embed SDK"

**Possible Causes:**
1. Network connectivity issues
2. Firewall blocking `sdk.canva.com`
3. Ad blocker interfering

**Solutions:**
1. Check internet connection
2. Disable ad blockers temporarily
3. Check firewall settings
4. Try accessing `https://sdk.canva.com/v1/embed.js` directly in browser

### Issue: Button appears but clicking does nothing

**Possible Causes:**
1. API key doesn't have create/edit permissions
2. Canva SDK version mismatch
3. Browser compatibility issues

**Solutions:**
1. Verify API key permissions in Canva Developer Console
2. Check browser console for JavaScript errors
3. Try a different browser
4. Clear browser cache

## Debugging Steps

1. **Check Environment Variables:**
   ```bash
   # Frontend
   echo $NEXT_PUBLIC_CANVA_API_KEY
   
   # Or check .env.local file
   cat apps/frontend/.env.local | grep CANVA
   ```

2. **Browser Console Debugging:**
   ```javascript
   // Check if SDK loaded
   console.log('Canva SDK:', window.Canva);
   console.log('DesignButton:', window.Canva?.DesignButton);
   
   // Check API key
   console.log('API Key:', process.env.NEXT_PUBLIC_CANVA_API_KEY?.substring(0, 10) + '...');
   ```

3. **Network Tab:**
   - Open DevTools > Network
   - Filter by "canva"
   - Check if requests succeed (status 200)
   - Look for 403/401 errors (authentication issues)

4. **Component State:**
   - Check React DevTools
   - Look at CanvaEditor component state
   - Verify `sdkLoaded` and `initialized` states

## Getting Help

If issues persist:
1. Check [Canva Developer Documentation](https://www.canva.dev/docs/)
2. Verify your API key in [Canva Developer Console](https://www.canva.dev/)
3. Check backend logs for errors
4. Review browser console for detailed error messages

## Quick Checklist

- [ ] API key is set in `.env.local`
- [ ] Development server restarted after adding API key
- [ ] API key is valid and active in Canva Developer Console
- [ ] No browser console errors
- [ ] Network requests to `sdk.canva.com` succeed
- [ ] `window.Canva` is available after SDK loads
- [ ] Button container element exists in DOM






