# Quick HTTPS Setup for Windows

## Easiest Method: Use mkcert

### Step 1: Install mkcert

**Option A: Using Chocolatey (if you have it)**
```powershell
choco install mkcert
```

**Option B: Manual Download**
1. Go to: https://github.com/FiloSottile/mkcert/releases
2. Download `mkcert-v1.4.4-windows-amd64.exe` (or latest version)
3. Rename it to `mkcert.exe`
4. Move it to a folder in your PATH (e.g., `C:\Windows\System32` or create `C:\tools` and add to PATH)

### Step 2: Generate Certificates

**Option A: Use the PowerShell script (Easiest)**
```powershell
cd apps/frontend
.\generate-cert-simple.ps1
```

**Option B: Manual commands**
```powershell
cd apps/frontend
mkcert -install
mkcert localhost
Rename-Item localhost+1.pem cert.pem
Rename-Item localhost+1-key.pem key.pem
```

### Step 3: Start HTTPS Server

```powershell
pnpm dev:https
```

### Step 4: Access Your App

Open: `https://localhost:3000`

**No security warnings!** ✅ (mkcert creates trusted certificates)

### Step 5: Update Adobe Developer Console

1. Go to [Adobe Developer Console](https://developer.adobe.com/console)
2. Open your project
3. Add to **Allowed Domains**: `https://localhost:3000`
4. Save and wait 2-5 minutes

---

## Alternative: Use ngrok (No Certificate Setup)

If you don't want to install mkcert:

### Step 1: Install ngrok

```powershell
# Using npm
npm install -g ngrok

# Or download from: https://ngrok.com/download
```

### Step 2: Start Your Dev Server

```powershell
pnpm dev
```

### Step 3: Start ngrok (in another terminal)

```powershell
ngrok http 3000
```

### Step 4: Copy the HTTPS URL

You'll see something like:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:3000
```

### Step 5: Update Adobe Developer Console

Add the ngrok URL (e.g., `https://abc123.ngrok.io`) to allowed domains.

### Step 6: Access Your App

Use the ngrok URL instead of localhost.

**Note**: The ngrok URL changes each time you restart it (unless you have a paid plan with a fixed domain).

---

## Troubleshooting

### "mkcert is not recognized"

**Solution**: 
- Make sure mkcert.exe is in your PATH
- Or use the full path: `C:\path\to\mkcert.exe -install`

### "Port 3000 already in use"

**Solution**: 
- Change port in `server.js`: `const port = 3001;`
- Update Adobe Developer Console to include the new port

### Still having issues?

Use ngrok - it's the simplest option and requires no certificate setup!


