# Fixing Adobe Express Embed SDK CSP Error

## Error Message

```
Framing 'https://new.express.adobe.com/' violates the following Content Security Policy directive: "frame-ancestors 'self' localhost:3000"
```

## What This Means

Adobe Express is blocking the iframe because your domain is not in the allowed list. The CSP (Content Security Policy) only allows embedding from specific domains that you've registered.

## Step-by-Step Fix

### 1. Go to Adobe Developer Console

1. Visit [https://developer.adobe.com/console](https://developer.adobe.com/console)
2. Sign in with your Adobe account
3. Select your project (the one with Adobe Express Embed SDK)

### 2. Find Allowed Domains Setting

1. In your project, look for:
   - **"Allowed Domains"**
   - **"Redirect URIs"**
   - **"OAuth Settings"** → **"Redirect URIs"**
   - **"API Settings"** → **"Allowed Domains"**

2. The exact location may vary depending on your project type

### 3. Add Your Domain

**For Local Development:**
```
http://localhost:3000
```

**Important Notes:**
- Include the protocol: `http://` or `https://`
- Include the port: `:3000` (if using a port)
- No trailing slash
- Must match exactly what's in your browser's address bar

**For Production:**
```
https://yourdomain.com
https://www.yourdomain.com  (if you use www)
```

### 4. Save and Wait

1. Click **Save** or **Update**
2. Wait 2-5 minutes for changes to propagate
3. Clear your browser cache
4. Refresh the page

### 5. Verify It Works

1. Open your application
2. Try to open the Adobe Express editor
3. Check the browser console - the CSP error should be gone

## Alternative: Use HTTPS for Localhost

Adobe Express works better with HTTPS. You can:

### Option A: Use ngrok (Easiest)

1. Install ngrok: `npm install -g ngrok` or download from [ngrok.com](https://ngrok.com)
2. Start your Next.js app: `pnpm dev` (on port 3000)
3. In another terminal: `ngrok http 3000`
4. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
5. Add this URL to Adobe Developer Console allowed domains
6. Access your app via the ngrok URL

### Option B: Configure Next.js HTTPS

1. Install `@next/bundle-analyzer` and configure HTTPS in `next.config.js`
2. Or use a tool like `mkcert` to create local SSL certificates

## Still Not Working?

1. **Double-check the domain format:**
   - ✅ Correct: `http://localhost:3000`
   - ❌ Wrong: `localhost:3000` (missing protocol)
   - ❌ Wrong: `http://localhost:3000/` (trailing slash)
   - ❌ Wrong: `http://localhost` (missing port)

2. **Check if approval is needed:**
   - Some Adobe Express integrations require business approval
   - Check your project status in Adobe Developer Console
   - Contact Adobe support if needed

3. **Try a different browser:**
   - Clear cache and cookies
   - Try incognito/private mode

4. **Check browser console:**
   - Look for the exact CSP error message
   - It will show which domains are allowed
   - Make sure your domain matches exactly

## Contact Adobe Support

If the issue persists:
- [Adobe Developer Support](https://developer.adobe.com/express/embed-sdk/docs/support/)
- [Adobe Community Forums](https://community.adobe.com/t5/adobe-express-embed-sdk/ct-p/ct-adobe-express-embed-sdk)

