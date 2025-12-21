'use client';

import { useEffect, useState } from 'react';
import { Box, Button, Alert, Typography, CircularProgress } from '@mui/material';
import {
  Edit as EditIcon,
  Download as DownloadIcon,
  Link as LinkIcon,
} from '@mui/icons-material';

interface CanvaOAuthEditorProps {
  diaryId?: string;
  designId?: string;
  designUrl?: string;
  onDesignCreated?: (designId: string, designUrl: string) => void;
  tripTitle: string;
  token?: string | null;
}

export default function CanvaOAuthEditor({
  diaryId,
  designId,
  designUrl,
  onDesignCreated,
  tripTitle,
  token: propToken,
}: CanvaOAuthEditorProps) {
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(propToken || null);

  // Get auth token from context if not provided
  useEffect(() => {
    if (!token) {
      const getToken = async () => {
        try {
          const { useAuth } = await import('@/lib/auth');
          // Token will be passed via props from parent component
        } catch (err) {
          console.error('Failed to get auth:', err);
        }
      };
      getToken();
    }
  }, [token]);

  // Check if user is authenticated with Canva
  useEffect(() => {
    checkCanvaAuth();
  }, []);

  const checkCanvaAuth = async () => {
    try {
      setCheckingAuth(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/canva/token`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        setIsAuthenticated(result.hasToken);
      } else {
        setIsAuthenticated(false);
      }
    } catch (err: any) {
      console.error('Failed to check Canva auth:', err);
      setIsAuthenticated(false);
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleConnectCanva = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/canva/auth${diaryId ? `?diaryId=${diaryId}` : ''}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      const result = await response.json();
      
      if (result.success && result.authUrl) {
        // Redirect to Canva OAuth
        window.location.href = result.authUrl;
      } else {
        throw new Error(result.error || 'Failed to get authorization URL');
      }
    } catch (err: any) {
      console.error('Failed to connect Canva:', err);
      setError(err.message || 'Failed to connect with Canva');
      setLoading(false);
    }
  };

  const handleCreateDesign = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/canva/designs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          title: `${tripTitle} - Travel Diary`,
          type: 'PRESENTATION',
          diaryId,
        }),
      });

      const result = await response.json();
      
      if (result.success && result.data) {
        const { designId: newDesignId, designUrl: newDesignUrl } = result.data;
        if (onDesignCreated) {
          onDesignCreated(newDesignId, newDesignUrl);
        }
        // Open the design in Canva
        window.open(newDesignUrl, '_blank', 'noopener,noreferrer');
      } else {
        throw new Error(result.error || 'Failed to create design');
      }
    } catch (err: any) {
      console.error('Failed to create design:', err);
      setError(err.message || 'Failed to create design');
    } finally {
      setLoading(false);
    }
  };

  const handleEditDesign = () => {
    if (designUrl) {
      window.open(designUrl, '_blank', 'noopener,noreferrer');
    } else if (designId) {
      window.open(`https://www.canva.com/design/${designId}/edit`, '_blank', 'noopener,noreferrer');
    }
  };

  const handleViewDesign = () => {
    if (designUrl) {
      window.open(designUrl, '_blank', 'noopener,noreferrer');
    } else if (designId) {
      window.open(`https://www.canva.com/design/${designId}/view`, '_blank', 'noopener,noreferrer');
    }
  };

  if (checkingAuth) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <CircularProgress />
        <Typography variant="body2" sx={{ ml: 2 }}>
          Checking Canva connection...
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

      {!isAuthenticated ? (
        <Box>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Connect your Canva account to create and edit travel diary designs.
            </Typography>
          </Alert>
          <Button
            variant="contained"
            startIcon={<LinkIcon />}
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
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={handleViewDesign}
                  sx={{ textTransform: 'none' }}
                >
                  View Design
                </Button>
              </>
            )}
          </Box>

          {designUrl && (
            <Box
              sx={{
                mt: 3,
                width: '100%',
                minHeight: '400px',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <iframe
                src={designUrl.replace('/edit', '/view')}
                width="100%"
                height="600px"
                frameBorder="0"
                allowFullScreen
                style={{ border: 'none' }}
                title="Travel Diary Design"
              />
            </Box>
          )}

          <Alert severity="success" sx={{ mt: 2 }}>
            <Typography variant="body2">
              {!designId
                ? 'Connected to Canva! Click "Create Travel Diary in Canva" to start designing.'
                : 'Your design is ready! Click "Edit in Canva" to make changes.'}
            </Typography>
          </Alert>
        </Box>
      )}
    </Box>
  );
}

