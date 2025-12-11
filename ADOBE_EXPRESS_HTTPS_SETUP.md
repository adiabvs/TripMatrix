# Setting Up HTTPS for Local Development

This guide helps you run your Next.js app with HTTPS locally, which is required for Adobe Express Embed SDK.

## Quick Start (Easiest Method)

### Option 1: Use mkcert (Recommended)

1. **Install mkcert:**
   ```bash
   # Windows (with Chocolatey)
   choco install mkcert
   
   # macOS
   brew install mkcert
   
   # Linux
   sudo apt install mkcert
   ```

2. **Install the local CA:**
   ```bash
   mkcert -install
   ```

3. **Generate certificates:**
   ```bash
   cd apps/frontend
   mkcert localhost
   ```

4. **Rename the files:**
   ```bash
   # Windows PowerShell
   Rename-Item localhost+1.pem cert.pem
   Rename-Item localhost+1-key.pem key.pem
   
   # macOS/Linux
   mv localhost+1.pem cert.pem
   mv localhost+1-key.pem key.pem
   ```

5. **Start the HTTPS server:**
   ```bash
   pnpm dev:https
   ```

6. **Access your app:**
   - Open: `https://localhost:3000`
   - No security warnings! ✅

### Option 2: Use OpenSSL

1. **Install OpenSSL (if not already installed):**
   - **Windows**: Download from [Win32OpenSSL](https://slproweb.com/products/Win32OpenSSL.html)
   - **macOS**: Already installed
   - **Linux**: `sudo apt-get install openssl`

2. **Generate certificates:**
   ```bash
   cd apps/frontend
   openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -days 365 -subj "/CN=localhost"
   ```

3. **Start the HTTPS server:**
   ```bash
   pnpm dev:https
   ```

4. **Access your app:**
   - Open: `https://localhost:3000`
   - Click "Advanced" → "Proceed to localhost (unsafe)" (this is normal for self-signed certs)

## Update Adobe Developer Console

After setting up HTTPS:

1. Go to [Adobe Developer Console](https://developer.adobe.com/console)
2. Open your project
3. Add to **Allowed Domains**:
   ```
   https://localhost:3000
   ```
4. Save and wait 2-5 minutes

## Running the App

```bash
# Regular HTTP (port 3000)
pnpm dev

# HTTPS (port 3000)
pnpm dev:https
```

## Troubleshooting

### "Certificates not found" error

**Solution**: Generate certificates first using one of the methods above.

### Browser shows security warning

**This is normal for self-signed certificates:**
- Click "Advanced" or "Show Details"
- Click "Proceed to localhost" or "Accept the Risk"
- The warning will appear once per browser

### Port 3000 already in use

**Solution**: Change the port in `server.js`:
```javascript
const port = 3001; // or any other port
```

Then update Adobe Developer Console to include the new port:
```
https://localhost:3001
```

### mkcert not found

**Windows**: 
- Install via Chocolatey: `choco install mkcert`
- Or download from: https://github.com/FiloSottile/mkcert/releases

**macOS**: 
- Install Homebrew first: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`
- Then: `brew install mkcert`

**Linux**: 
- `sudo apt install mkcert` (Ubuntu/Debian)
- Or install from: https://github.com/FiloSottile/mkcert/releases

## Alternative: Use ngrok (No Certificate Setup)

If you don't want to set up certificates:

1. **Install ngrok:**
   ```bash
   npm install -g ngrok
   # Or download from https://ngrok.com
   ```

2. **Start your regular dev server:**
   ```bash
   pnpm dev
   ```

3. **In another terminal, start ngrok:**
   ```bash
   ngrok http 3000
   ```

4. **Copy the HTTPS URL** (e.g., `https://abc123.ngrok.io`)

5. **Add to Adobe Developer Console:**
   - Add the ngrok URL to Allowed Domains
   - Access your app via the ngrok URL

**Note**: The ngrok URL changes each time you restart ngrok (unless you have a paid plan).

## Security Notes

- Self-signed certificates are only for local development
- Never commit `cert.pem` or `key.pem` to git (they're in `.gitignore`)
- For production, use proper SSL certificates from Let's Encrypt or your hosting provider

