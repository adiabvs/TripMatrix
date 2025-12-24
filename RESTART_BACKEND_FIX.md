# Fix 404 Error - Restart Backend Server

## Problem
Getting `404 (Not Found)` when calling `/api/canva/token`

## Solution: Restart Backend Server

The Canva OAuth routes were added, but the backend server needs to be **restarted** to load them.

### Steps:

1. **Stop the backend server** (if running):
   - Press `Ctrl+C` in the terminal where backend is running

2. **Restart the backend**:
   ```bash
   cd apps/backend
   pnpm dev
   ```

3. **Verify routes are loaded**:
   - You should see: `🚀 Backend server running on port 3001`
   - No errors about missing routes

4. **Refresh frontend**:
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Or restart frontend dev server

## Verify Route Exists

After restarting, test the route:
```bash
# Should return 401 (unauthorized) or 404 (no token), but NOT 404 (route not found)
curl http://localhost:3001/api/canva/token \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Expected Responses

- **404 with `"Canva not connected"`** - Route exists, user just needs to connect Canva ✅
- **401 Unauthorized** - Route exists, token invalid ✅
- **404 Not Found** - Route doesn't exist, server needs restart ❌

## Quick Check

If you see this in backend console:
```
🚀 Backend server running on port 3001
```

And you still get 404, check:
1. Route is registered: `app.use('/api/canva', authenticateToken, canvaOAuthRoutes);`
2. Route file exists: `apps/backend/src/routes/canva-oauth.ts`
3. Route handler exists: `router.get('/token', ...)`

## Most Common Fix

**Just restart the backend server!** The routes are there, they just need to be loaded.






