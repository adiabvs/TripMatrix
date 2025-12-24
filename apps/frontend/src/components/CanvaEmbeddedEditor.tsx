'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Box, 
  Button, 
  Alert, 
  Typography, 
  CircularProgress 
} from '@mui/material';
import {
  Edit as EditIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { createNavigateToCanvaUrl, type CorrelationState } from '@/lib/canva-return';
import { checkCanvaAuth, connectCanva } from '@/lib/canva-auth';

interface CanvaEmbeddedEditorProps {
  diaryId?: string;
  designId?: string;
  designUrl?: string;
  editUrl?: string;
  onDesignCreated?: (designId: string, designUrl: string) => void;
  onDesignUpdated?: (designId: string, designUrl: string) => void;
  tripTitle: string;
  tripId?: string;
  token?: string | null;
}

export default function CanvaEmbeddedEditor({
  diaryId,
  designId,
  designUrl,
  editUrl,
  onDesignCreated,
  onDesignUpdated,
  tripTitle,
  tripId,
  token,
}: CanvaEmbeddedEditorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check authorization status
  useEffect(() => {
    if (token) {
      checkAuthorization();
    } else {
      setCheckingAuth(false);
      setLoading(false);
    }
  }, [token]);

  // Note: Auto-open is handled by redirecting in handleGenerateDiary
  // This component is shown when user returns from Canva

  // Handle return from Canva
  useEffect(() => {
    const canvaAuth = searchParams?.get('canva_auth');
    const canvaError = searchParams?.get('canva_error');
    const canvaReturn = searchParams?.get('canva_return');
    
    if (canvaAuth === 'success') {
      checkAuthorization();
      // Remove query param
      router.replace(window.location.pathname);
    } else if (canvaReturn === 'success') {
      // User returned from editing in Canva - refresh authorization and design info
      checkAuthorization();
      // Remove query param
      router.replace(window.location.pathname);
    } else if (canvaError) {
      setError(`Canva authorization failed: ${canvaError}`);
      setCheckingAuth(false);
      setLoading(false);
      // Remove query param
      router.replace(window.location.pathname);
    }
  }, [searchParams, router]);

  const checkAuthorization = async () => {
    try {
      setCheckingAuth(true);
      const status = await checkCanvaAuth(token);
      setIsAuthorized(status.status);
    } catch (err: any) {
      console.error('Failed to check Canva auth:', err);
      setIsAuthorized(false);
    } finally {
      setCheckingAuth(false);
      setLoading(false);
    }
  };

  const handleConnectCanva = async () => {
    try {
      setLoading(true);
      setError(null);
      await connectCanva(token, diaryId);
      // The OAuth flow will redirect, so we don't need to do anything else
    } catch (err: any) {
      console.error('Failed to connect Canva:', err);
      setError(err.message || 'Failed to connect with Canva');
      setLoading(false);
    }
  };

  const handleCreateDesign = async () => {
    if (!isAuthorized) {
      setError('Please connect to Canva first');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Create design via API
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/canva/designs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: tripTitle || 'Travel Diary',
          type: 'PRESENTATION',
          diaryId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create design');
      }

      const result = await response.json();
      const { designId: newDesignId, editUrl: newEditUrl } = result.data;

      // Navigate to Canva with correlation state
      const correlationState: CorrelationState = {
        originPage: 'diary',
        returnTo: window.location.pathname,
        diaryId,
        tripId,
      };

      const canvaUrl = createNavigateToCanvaUrl({
        editUrl: newEditUrl,
        correlationState,
      });

      // Redirect to Canva (following starter kit pattern)
      window.location.assign(canvaUrl.toString());
    } catch (err: any) {
      console.error('Failed to create design:', err);
      setError(err.message || 'Failed to create design');
      setLoading(false);
    }
  };

  const handleEditDesign = useCallback(() => {
    if (!isAuthorized) {
      setError('Please connect to Canva first');
      return;
    }

    if (!editUrl && !designId) {
      setError('No design to edit');
      return;
    }

    const editUrlToUse = editUrl || (designId ? `https://www.canva.com/design/${designId}/edit` : null);
    
    if (!editUrlToUse) {
      setError('Design URL not available');
      return;
    }

    // Navigate to Canva with correlation state
    const correlationState: CorrelationState = {
      originPage: 'diary',
      returnTo: window.location.pathname,
      diaryId,
      tripId,
    };

    const canvaUrl = createNavigateToCanvaUrl({
      editUrl: editUrlToUse,
      correlationState,
    });

    // Redirect to Canva (following starter kit pattern)
    window.location.assign(canvaUrl.toString());
  }, [isAuthorized, editUrl, designId, diaryId, tripId]);

  if (checkingAuth || loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <CircularProgress size={24} />
        <Typography sx={{ ml: 2 }}>
          {checkingAuth ? 'Checking Canva connection...' : 'Loading...'}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {!isAuthorized ? (
        <Box>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Connect your Canva account to create and edit travel diary designs.
            </Typography>
          </Alert>
          <Button
            variant="contained"
            onClick={handleConnectCanva}
            disabled={loading}
            sx={{ textTransform: 'none' }}
          >
            {loading ? 'Connecting...' : 'Connect with Canva'}
          </Button>
        </Box>
      ) : (
        <Box>
          <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            {!designId ? (
              <Button
                variant="contained"
                startIcon={<EditIcon />}
                onClick={handleCreateDesign}
                disabled={loading}
                sx={{ textTransform: 'none' }}
              >
                {loading ? 'Creating...' : 'Create Travel Diary in Canva'}
              </Button>
            ) : (
              <>
                <Button
                  variant="contained"
                  startIcon={<EditIcon />}
                  onClick={handleEditDesign}
                  sx={{ textTransform: 'none' }}
                >
                  Edit in Canva
                </Button>
                {designUrl && (
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={() => window.open(designUrl, '_blank', 'noopener,noreferrer')}
                    sx={{ textTransform: 'none' }}
                  >
                    View Design
                  </Button>
                )}
              </>
            )}
          </Box>

          {designUrl && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="info">
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Your design is ready! Click the buttons above to edit or view your design.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Note: Canva designs cannot be embedded in iframes. Use the "View Design" button to open in a new tab.
                </Typography>
              </Alert>
            </Box>
          )}

          <Alert severity="success" sx={{ mt: 2 }}>
            <Typography variant="body2">
              {!designId
                ? 'Connected to Canva! Click "Create Travel Diary in Canva" to start designing.'
                : 'Your design is ready! Click "Edit in Canva" to edit your design.'}
            </Typography>
          </Alert>
        </Box>
      )}
    </Box>
  );
}
