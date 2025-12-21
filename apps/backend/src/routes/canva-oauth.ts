import express from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { getFirestore } from '../config/firebase.js';
import {
  getCanvaAuthUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  createCanvaDesign,
} from '../services/canvaOAuthService.js';

const router = express.Router();

function getDb() {
  return getFirestore();
}

/**
 * Get Canva OAuth configuration
 */
function getCanvaConfig(): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId = process.env.CANVA_CLIENT_ID;
  const clientSecret = process.env.CANVA_CLIENT_SECRET;
  const redirectUri = process.env.CANVA_REDIRECT_URI || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/canva/callback`;

  if (!clientId || !clientSecret) {
    throw new Error('Canva OAuth credentials not configured. Please set CANVA_CLIENT_ID and CANVA_CLIENT_SECRET.');
  }

  return { clientId, clientSecret, redirectUri };
}

/**
 * Initiate OAuth flow - redirect to Canva authorization
 */
router.get('/auth', async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.uid!;
    const { diaryId } = req.query;

    if (!uid) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const config = getCanvaConfig();
    
    // Generate state parameter for security (include user ID and diary ID)
    const state = Buffer.from(JSON.stringify({ uid, diaryId: diaryId || null })).toString('base64');
    
    // Store state in session/cookie for verification (or use database)
    const db = getDb();
    await db.collection('canvaOAuthStates').doc(state).set({
      uid,
      diaryId: diaryId || null,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    const authUrl = getCanvaAuthUrl(config, state);
    
    res.json({
      success: true,
      authUrl,
    });
  } catch (error: any) {
    console.error('Failed to initiate Canva OAuth:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to initiate OAuth flow',
    });
  }
});

/**
 * OAuth callback - exchange code for token
 */
router.get('/callback', async (req: AuthenticatedRequest, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/trips?canva_error=${encodeURIComponent(error as string)}`);
    }

    if (!code || !state) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/trips?canva_error=missing_code_or_state`);
    }

    // Verify state
    const db = getDb();
    const stateDoc = await db.collection('canvaOAuthStates').doc(state as string).get();
    
    if (!stateDoc.exists) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/trips?canva_error=invalid_state`);
    }

    const stateData = stateDoc.data()!;
    const uid = stateData.uid;
    const diaryId = stateData.diaryId;

    // Check if state expired
    if (new Date(stateData.expiresAt.toDate()) < new Date()) {
      await db.collection('canvaOAuthStates').doc(state as string).delete();
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/trips?canva_error=state_expired`);
    }

    // Exchange code for token
    const config = getCanvaConfig();
    const tokenResponse = await exchangeCodeForToken(config, code as string);

    // Store tokens in database (associated with user)
    await db.collection('canvaTokens').doc(uid).set({
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token || null,
      expiresAt: new Date(Date.now() + (tokenResponse.expires_in * 1000)),
      scope: tokenResponse.scope,
      updatedAt: new Date(),
    });

    // Clean up state
    await db.collection('canvaOAuthStates').doc(state as string).delete();

    // Redirect to frontend
    if (diaryId) {
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/trips/${diaryId}/diary?canva_auth=success`);
    } else {
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/trips?canva_auth=success`);
    }
  } catch (error: any) {
    console.error('Failed to handle OAuth callback:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/trips?canva_error=${encodeURIComponent(error.message || 'oauth_failed')}`);
  }
});

/**
 * Get user's Canva access token (for embedded editor)
 */
router.get('/access-token', async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.uid!;

    const db = getDb();
    const tokenDoc = await db.collection('canvaTokens').doc(uid).get();

    if (!tokenDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Canva not connected. Please authorize with Canva first.',
      });
    }

    let tokenData = tokenDoc.data()!;
    
    // Check if token expired and refresh if needed
    if (new Date(tokenData.expiresAt.toDate()) < new Date()) {
      if (tokenData.refreshToken) {
        try {
          const config = getCanvaConfig();
          const newToken = await refreshAccessToken(config, tokenData.refreshToken);
          
          await db.collection('canvaTokens').doc(uid).update({
            accessToken: newToken.access_token,
            refreshToken: newToken.refresh_token || tokenData.refreshToken,
            expiresAt: new Date(Date.now() + (newToken.expires_in * 1000)),
            updatedAt: new Date(),
          });

          tokenData = {
            ...tokenData,
            accessToken: newToken.access_token,
            expiresAt: new Date(Date.now() + (newToken.expires_in * 1000)),
          };
        } catch (refreshError: any) {
          await db.collection('canvaTokens').doc(uid).delete();
          return res.status(401).json({
            success: false,
            error: 'Token expired and refresh failed. Please re-authorize with Canva.',
          });
        }
      } else {
        await db.collection('canvaTokens').doc(uid).delete();
        return res.status(401).json({
          success: false,
          error: 'Token expired. Please re-authorize with Canva.',
        });
      }
    }

    res.json({
      success: true,
      accessToken: tokenData.accessToken,
      expiresAt: tokenData.expiresAt.toDate(),
    });
  } catch (error: any) {
    console.error('Failed to get Canva access token:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get Canva access token',
    });
  }
});

/**
 * Get user's Canva access token (if authenticated)
 */
router.get('/token', async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.uid!;

    const db = getDb();
    const tokenDoc = await db.collection('canvaTokens').doc(uid).get();

    if (!tokenDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Canva not connected. Please authorize with Canva first.',
      });
    }

    const tokenData = tokenDoc.data()!;
    
    // Check if token expired
    if (new Date(tokenData.expiresAt.toDate()) < new Date()) {
      // Try to refresh
      if (tokenData.refreshToken) {
        try {
          const config = getCanvaConfig();
          const newToken = await refreshAccessToken(config, tokenData.refreshToken);
          
          await db.collection('canvaTokens').doc(uid).update({
            accessToken: newToken.access_token,
            refreshToken: newToken.refresh_token || tokenData.refreshToken,
            expiresAt: new Date(Date.now() + (newToken.expires_in * 1000)),
            updatedAt: new Date(),
          });

          return res.json({
            success: true,
            hasToken: true,
            expiresAt: new Date(Date.now() + (newToken.expires_in * 1000)),
          });
        } catch (refreshError: any) {
          // Refresh failed, user needs to re-authorize
          await db.collection('canvaTokens').doc(uid).delete();
          return res.status(401).json({
            success: false,
            error: 'Token expired and refresh failed. Please re-authorize with Canva.',
          });
        }
      } else {
        // No refresh token, user needs to re-authorize
        await db.collection('canvaTokens').doc(uid).delete();
        return res.status(401).json({
          success: false,
          error: 'Token expired. Please re-authorize with Canva.',
        });
      }
    }

    res.json({
      success: true,
      hasToken: true,
      expiresAt: tokenData.expiresAt.toDate(),
    });
  } catch (error: any) {
    console.error('Failed to get Canva token:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get Canva token',
    });
  }
});

/**
 * Create a design using Canva Connect API
 */
router.post('/designs', async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.uid!;
    const { title, type, diaryId } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required',
      });
    }

    // Get access token
    const db = getDb();
    const tokenDoc = await db.collection('canvaTokens').doc(uid).get();

    if (!tokenDoc.exists) {
      return res.status(401).json({
        success: false,
        error: 'Canva not connected. Please authorize with Canva first.',
      });
    }

    let tokenData = tokenDoc.data()!;
    let accessToken = tokenData.accessToken;

    // Check if token expired and refresh if needed
    if (new Date(tokenData.expiresAt.toDate()) < new Date()) {
      if (tokenData.refreshToken) {
        const config = getCanvaConfig();
        const newToken = await refreshAccessToken(config, tokenData.refreshToken);
        accessToken = newToken.access_token;
        
        await db.collection('canvaTokens').doc(uid).update({
          accessToken: newToken.access_token,
          refreshToken: newToken.refresh_token || tokenData.refreshToken,
          expiresAt: new Date(Date.now() + (newToken.expires_in * 1000)),
          updatedAt: new Date(),
        });
      } else {
        return res.status(401).json({
          success: false,
          error: 'Token expired. Please re-authorize with Canva.',
        });
      }
    }

    // Create design
    const design = await createCanvaDesign(accessToken, {
      title,
      type: type || 'PRESENTATION',
    });

    // If diaryId provided, update diary with design info
    if (diaryId) {
      await db.collection('travelDiaries').doc(diaryId).update({
        canvaDesignId: design.designId,
        canvaDesignUrl: design.designUrl,
        canvaEditorUrl: design.designUrl,
        updatedAt: new Date(),
      });
    }

    res.json({
      success: true,
      data: design,
    });
  } catch (error: any) {
    console.error('Failed to create Canva design:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create design',
    });
  }
});

export default router;

