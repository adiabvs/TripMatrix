# Canva Integration - Following Starter Kit Pattern

This document explains how the Canva integration has been updated to follow the pattern from `canva-connect-api-starter-kit`.

## Key Changes

### 1. OAuth 2.0 with PKCE (Proof Key for Code Exchange)

The OAuth flow now uses PKCE for enhanced security, following the starter kit pattern:

- **Code Verifier**: Random 96-byte value generated for each OAuth request
- **Code Challenge**: SHA256 hash of the code verifier (base64url encoded)
- **Code Challenge Method**: S256

**Backend Changes:**
- `apps/backend/src/services/canvaOAuthService.ts`:
  - Added `generatePKCE()` function
  - Updated `getCanvaAuthUrl()` to include `code_challenge` and `code_challenge_method`
  - Updated `exchangeCodeForToken()` to use `code_verifier`

- `apps/backend/src/routes/canva-oauth.ts`:
  - Generates PKCE values during OAuth initiation
  - Stores `codeVerifier` in database with state
  - Uses `codeVerifier` when exchanging code for token

### 2. Redirect to Canva (Not Iframe)

The frontend now redirects users to Canva instead of trying to embed in an iframe:

- **Before**: Attempted to embed Canva editor in iframe (blocked by X-Frame-Options)
- **After**: Redirects to Canva using `window.location.assign()` (following starter kit pattern)

**Frontend Changes:**
- `apps/frontend/src/components/CanvaEmbeddedEditor.tsx`:
  - Removed DesignButton SDK usage
  - Added redirect-based flow using `createNavigateToCanvaUrl()`
  - Handles return from Canva using correlation state

- `apps/frontend/src/lib/canva-return.ts`:
  - New utility for creating Canva navigation URLs
  - Encodes correlation state in URL for return navigation

- `apps/frontend/src/lib/canva-auth.ts`:
  - New utility for checking Canva authorization status
  - Handles OAuth connection flow

### 3. Correlation State Pattern

Following the starter kit pattern, we use `correlation_state` in the Canva URL to track where users should return:

```typescript
const correlationState: CorrelationState = {
  originPage: 'diary',
  returnTo: window.location.pathname,
  diaryId,
  tripId,
};

const canvaUrl = createNavigateToCanvaUrl({
  editUrl: editUrl,
  correlationState,
});
```

This allows Canva to redirect users back to the correct page after editing.

### 4. API Client Updates

Updated to use the correct Canva Connect API endpoints:

- **Base URLs**:
  - API: `https://api.canva.com/rest/v1` (or `BASE_CANVA_CONNECT_API_URL`)
  - Auth: `https://api.canva.com` (or `BASE_CANVA_CONNECT_AUTH_URL`)

- **Scopes**: Full set of scopes matching starter kit:
  - `asset:read`, `asset:write`
  - `brandtemplate:content:read`, `brandtemplate:meta:read`
  - `design:content:read`, `design:content:write`, `design:meta:read`
  - `profile:read`

### 5. Token Management

- Tokens stored in Firestore (`canvaTokens` collection)
- Automatic token refresh when expired
- Token validation using JWT decoding

## Environment Variables

Required environment variables:

```env
# Backend (.env)
CANVA_CLIENT_ID=your_client_id
CANVA_CLIENT_SECRET=your_client_secret
CANVA_REDIRECT_URI=http://localhost:3001/api/canva/callback
BACKEND_URL=http://localhost:3001
BASE_CANVA_CONNECT_API_URL=https://api.canva.com/rest/v1
BASE_CANVA_CONNECT_AUTH_URL=https://api.canva.com

# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Flow

1. **User clicks "Connect with Canva"**:
   - Frontend calls `/api/canva/auth`
   - Backend generates PKCE values and OAuth URL
   - User redirected to Canva

2. **User authorizes on Canva**:
   - Canva redirects to `/api/canva/callback` with code
   - Backend exchanges code for token (using code verifier)
   - Tokens stored in Firestore

3. **User creates/edits design**:
   - Frontend creates design via API (if new)
   - Frontend redirects to Canva with correlation state
   - User edits in Canva

4. **User returns from Canva**:
   - Canva redirects back with correlation state
   - Frontend handles return and updates diary

## Differences from Previous Implementation

1. **No iframe embedding**: Canva blocks iframe embedding, so we redirect instead
2. **PKCE instead of simple OAuth**: More secure OAuth flow
3. **Correlation state**: Tracks return navigation
4. **Full redirect flow**: Users leave the app to edit in Canva, then return

## Testing

1. Ensure environment variables are set
2. Start backend: `cd apps/backend && pnpm dev`
3. Start frontend: `cd apps/frontend && pnpm dev`
4. Navigate to a trip diary page
5. Click "Connect with Canva"
6. Authorize in Canva
7. Create or edit a design
8. Verify return navigation works

## Notes

- The redirect URI must match exactly what's configured in Canva Developer Platform
- Correlation state is base64 encoded in the URL
- Tokens are automatically refreshed when expired
- The flow follows the exact pattern from `canva-connect-api-starter-kit`

