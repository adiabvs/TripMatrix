# Fixing Canva 403 Forbidden Error

## What the Error Means

A 403 Forbidden error from Canva means your request was rejected due to:
1. **Invalid or expired API key**
2. **Domain not whitelisted** in Canva Developer Console
3. **Missing permissions** for the DesignButton API

## Step-by-Step Fix

### Step 1: Verify Your API Key

1. Go to [Canva Developer Console](https://www.canva.dev/)
2. Sign in with your Canva account
3. Navigate to your app
4. Go to **API Keys** section
5. Verify your API key is:
   - ✅ Active (not revoked)
   - ✅ Has the correct permissions
   - ✅ Not expired

### Step 2: Whitelist Your Domain

**Important:** Canva requires you to whitelist domains that can use your API key.

1. In Canva Developer Console, go to your app settings
2. Find **"Allowed Domains"** or **"Whitelist"** section
3. Add your domains:
   - For development: `http://localhost:3000`
   - For production: `https://yourdomain.com`
4. Save the changes

**Note:** Some Canva apps require domain whitelisting in the app settings, not just the API key settings.

### Step 3: Check API Key Permissions

1. In Canva Developer Console, check your API key permissions
2. Ensure it has:
   - ✅ **DesignButton** permissions
   - ✅ **Create Design** permissions
   - ✅ **Edit Design** permissions

### Step 4: Verify API Key Format

Make sure your API key in `.env.local` is:
- ✅ Not wrapped in quotes
- ✅ No extra spaces
- ✅ Complete (not truncated)

```env
# Correct
NEXT_PUBLIC_CANVA_API_KEY=CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Wrong
NEXT_PUBLIC_CANVA_API_KEY="CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
NEXT_PUBLIC_CANVA_API_KEY= CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx 
```

### Step 5: Restart Your Server

After making changes:
1. Stop your development server (Ctrl+C)
2. Restart it:
   ```bash
   cd apps/frontend
   pnpm dev
   ```

### Step 6: Check Browser Console

1. Open browser DevTools (F12)
2. Go to **Network** tab
3. Filter by "canva"
4. Look for the 403 request
5. Check the **Response** tab for error details

## Common Issues

### Issue: "API key not found"
- **Solution:** Make sure `NEXT_PUBLIC_CANVA_API_KEY` is set in `.env.local`
- **Solution:** Restart your dev server after adding the key

### Issue: "Domain not allowed"
- **Solution:** Add `http://localhost:3000` to allowed domains in Canva Console
- **Solution:** For production, add your production domain

### Issue: "Insufficient permissions"
- **Solution:** Check that your API key has DesignButton permissions
- **Solution:** You may need to create a new API key with correct permissions

## Testing

After fixing the issues:

1. Clear your browser cache
2. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
3. Try creating a design again
4. Check browser console for any remaining errors

## Still Having Issues?

1. **Check Canva Status:** Visit [Canva Status Page](https://status.canva.com/)
2. **Review Documentation:** [Canva Developer Docs](https://www.canva.dev/docs/)
3. **Check API Key Limits:** Some API keys have rate limits or usage restrictions
4. **Contact Canva Support:** If your API key is valid but still getting 403, contact Canva support

## Alternative: Use Canva Connect

If you continue having issues with the DesignButton API, consider migrating to [Canva Connect](https://www.canva.dev/docs/connect/), which is Canva's recommended integration method (though it has different requirements like user authentication).







