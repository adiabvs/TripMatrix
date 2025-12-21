# Fix 404 Error for Canva Routes

## Problem
Getting `404 (Not Found)` when calling `/api/canva/token`

## Solution

### Step 1: Restart Backend Server

The new Canva routes need the backend server to be restarted:

```bash
# Stop the current backend server (Ctrl+C)
# Then restart it
cd apps/backend
pnpm dev
```

### Step 2: Verify Routes Are Registered

Check that the routes are imported in `apps/backend/src/index.ts`:

```typescript
import canvaOAuthRoutes from './routes/canva-oauth.js';
// ...
app.use('/api/canva', authenticateToken, canvaOAuthRoutes);
```

### Step 3: Verify Route Exists

The route should be at: `GET /api/canva/token`

You can test it with:
```bash
curl http://localhost:3001/api/canva/token \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Step 4: Check Backend Logs

When you start the backend, you should see:
```
🚀 Backend server running on port 3001
```

If you see errors about missing modules, the routes might not be compiled. Run:
```bash
cd apps/backend
pnpm build
```

## Quick Fix

1. **Stop backend server** (if running)
2. **Restart it:**
   ```bash
   cd apps/backend
   pnpm dev
   ```
3. **Refresh frontend** (hard refresh: Ctrl+Shift+R)
4. **Try again**

## Verify It's Working

After restarting, the route should return:
- `404` if user hasn't connected Canva (expected)
- `401` if token is invalid
- `200` with `{ success: true, hasToken: true }` if connected

The 404 error you're seeing is likely because:
1. Backend server wasn't restarted after adding new routes
2. Routes weren't compiled (if using build mode)
3. Server crashed and needs restart

**Most common fix: Just restart the backend server!**




