'use client';

import { useEffect, useState, useRef } from 'react';
import { 
  Box, 
  Button, 
  Alert, 
  Typography, 
  CircularProgress, 
  Dialog, 
  DialogContent,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Edit as EditIcon,
  Download as DownloadIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

interface CanvaEmbeddedEditorProps {
  diaryId?: string;
  designId?: string;
  designUrl?: string;
  onDesignCreated?: (designId: string, designUrl: string) => void;
  tripTitle: string;
  token?: string | null;
}

export default function CanvaEmbeddedEditor({
  diaryId,
  designId,
  designUrl,
  onDesignCreated,
  tripTitle,
  token,
}: CanvaEmbeddedEditorProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editorUrl, setEditorUrl] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const oauthWindowRef = useRef<Window | null>(null);

  // Check if user is authenticated with Canva
  useEffect(() => {
    if (token) {
      checkCanvaAuth();
    }
  }, [token]);

  // Auto-open editor if designId is provided and user is authenticated
  useEffect(() => {
    if (designId && isAuthenticated && accessToken && !showEditor) {
      // Small delay to ensure everything is loaded
      const timer = setTimeout(() => {
        openEmbeddedEditor(designId, accessToken);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [designId, isAuthenticated, accessToken, showEditor]);

  // Listen for messages from Canva iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from Canva domain
      if (!event.origin.includes('canva.com')) {
        return;
      }

      console.log('Message from Canva:', event.data);

      // Handle design creation/update events
      if (event.data && event.data.type === 'designCreated' && event.data.designId) {
        const { designId, designUrl } = event.data;
        if (onDesignCreated) {
          onDesignCreated(designId, designUrl || `https://www.canva.com/design/${designId}/view`);
        }
        // Update local state
        setShowEditor(false);
      } else if (event.data && event.data.type === 'designUpdated' && event.data.designId) {
        const { designId, designUrl } = event.data;
        if (onDesignCreated) {
          onDesignCreated(designId, designUrl || `https://www.canva.com/design/${designId}/view`);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [onDesignCreated]);

  const checkCanvaAuth = async () => {
    if (!token) {
      setCheckingAuth(false);
      setIsAuthenticated(false);
      return;
    }

    try {
      setCheckingAuth(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/canva/token`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        setIsAuthenticated(result.hasToken || false);
        if (result.hasToken) {
          // Get access token for embedded editor
          await getAccessToken();
        }
      } else if (response.status === 404) {
        // Token doesn't exist - user hasn't connected Canva yet
        setIsAuthenticated(false);
      } else {
        console.error('Failed to check Canva auth:', response.status, response.statusText);
        setIsAuthenticated(false);
      }
    } catch (err: any) {
      console.error('Failed to check Canva auth:', err);
      // Don't show error for 404 - it just means user hasn't connected yet
      if (!err.message?.includes('404')) {
        setError(`Failed to check Canva connection: ${err.message}`);
      }
      setIsAuthenticated(false);
    } finally {
      setCheckingAuth(false);
    }
  };

  const getAccessToken = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/canva/access-token`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        if (result.accessToken) {
          setAccessToken(result.accessToken);
        }
      }
    } catch (err) {
      console.error('Failed to get access token:', err);
    }
  };

  const handleConnectCanva = () => {
    // Open OAuth in popup window instead of redirect
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      '',
      'canva-oauth',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    if (!popup) {
      setError('Popup blocked. Please allow popups for this site.');
      return;
    }

    oauthWindowRef.current = popup;

    // Get OAuth URL
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    fetch(`${apiUrl}/api/canva/auth${diaryId ? `?diaryId=${diaryId}` : ''}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((result) => {
        if (result.success && result.authUrl) {
          popup.location.href = result.authUrl;

          // Listen for OAuth completion
          const checkInterval = setInterval(() => {
            try {
              if (popup.closed) {
                clearInterval(checkInterval);
                // Check if auth was successful
                setTimeout(() => {
                  checkCanvaAuth();
                }, 1000);
              } else {
                // Check if popup has redirected to our callback
                try {
                  const popupUrl = popup.location.href;
                  if (popupUrl.includes('/api/canva/callback') || popupUrl.includes('canva_auth=success')) {
                    popup.close();
                    clearInterval(checkInterval);
                    setTimeout(() => {
                      checkCanvaAuth();
                    }, 1000);
                  }
                } catch (e) {
                  // Cross-origin error is expected, continue polling
                }
              }
            } catch (e) {
              // Popup might be on different origin
            }
          }, 500);
        } else {
          popup.close();
          setError(result.error || 'Failed to get authorization URL');
        }
      })
      .catch((err) => {
        popup.close();
        console.error('Failed to connect Canva:', err);
        setError(err.message || 'Failed to connect with Canva');
      });
  };

  const handleCreateDesign = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Open embedded editor directly (no need to create design first)
      // The embedded editor will handle design creation
      openEmbeddedEditor(null, accessToken);
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to open editor:', err);
      setError(err.message || 'Failed to open editor');
      setLoading(false);
    }
  };

  const openEmbeddedEditor = async (designIdToEdit: string | null, token: string | null) => {
    if (!token) {
      setError('Access token not available. Please reconnect with Canva.');
      return;
    }

    // Try using Canva's standard edit URL in iframe
    // If Canva blocks iframe (X-Frame-Options), we'll fall back to new window
    if (designIdToEdit) {
      // First, try iframe embedding
      const embedUrl = `https://www.canva.com/design/${designIdToEdit}/edit`;
      setEditorUrl(embedUrl);
      setShowEditor(true);
      
      // Check if iframe loads successfully after a delay
      setTimeout(() => {
        if (iframeRef.current) {
          try {
            // Try to access iframe content - if blocked, will throw error
            const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
            if (!iframeDoc) {
              // Iframe is blocked, open in new window instead
              console.warn('Canva iframe embedding blocked, opening in new window');
              setShowEditor(false);
              window.open(embedUrl, '_blank', 'noopener,noreferrer');
            }
          } catch (e) {
            // Cross-origin error means iframe is blocked
            console.warn('Canva iframe embedding blocked by X-Frame-Options, opening in new window');
            setShowEditor(false);
            window.open(embedUrl, '_blank', 'noopener,noreferrer');
          }
        }
      }, 2000);
    } else {
      setError('Please generate a diary first to create a design.');
    }
  };

  const handleEditDesign = () => {
    if (designId && accessToken) {
      openEmbeddedEditor(designId, accessToken);
    } else if (designId) {
      // Fallback: open in new tab if embedded editor not available
      window.open(`https://www.canva.com/design/${designId}/edit`, '_blank', 'noopener,noreferrer');
    } else {
      setError('Design ID not available');
    }
  };

  // Auto-open editor if designId is provided and user is authenticated
  useEffect(() => {
    if (designId && isAuthenticated && accessToken && !showEditor) {
      // Small delay to ensure everything is loaded
      const timer = setTimeout(() => {
        openEmbeddedEditor(designId, accessToken);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [designId, isAuthenticated, accessToken]);

  const handleCloseEditor = () => {
    setShowEditor(false);
    setEditorUrl(null);
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
              Connect your Canva account to create and edit travel diary designs directly in the app.
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
                disabled={loading || !accessToken}
                sx={{ textTransform: 'none' }}
              >
                {loading ? 'Opening...' : 'Create Travel Diary in Canva (Embedded)'}
              </Button>
            ) : (
              <>
                <Button
                  variant="contained"
                  startIcon={<EditIcon />}
                  onClick={handleEditDesign}
                  disabled={!accessToken}
                  sx={{ textTransform: 'none' }}
                >
                  Edit in Canva (Embedded)
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

          {designUrl && !showEditor && (
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
                : 'Your design is ready! Click "Edit in Canva (Embedded)" to edit directly in the app.'}
            </Typography>
          </Alert>
        </Box>
      )}

      {/* Embedded Editor Dialog - Full Screen on Mobile */}
      <Dialog
        open={showEditor}
        onClose={handleCloseEditor}
        maxWidth={false}
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            height: { xs: '100vh', sm: '90vh' },
            maxHeight: { xs: '100vh', sm: '90vh' },
            width: { xs: '100%', sm: '95%', md: '90%' },
            maxWidth: { xs: '100%', md: '1400px' },
            margin: { xs: 0, sm: 'auto' },
            borderRadius: { xs: 0, sm: 1 },
          },
        }}
      >
        <DialogContent 
          sx={{ 
            p: 0, 
            height: '100%', 
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Close Button - Mobile Friendly */}
          <Box
            sx={{
              position: 'absolute',
              top: { xs: 8, sm: 12 },
              right: { xs: 8, sm: 12 },
              zIndex: 1000,
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              borderRadius: '50%',
              boxShadow: 2,
            }}
          >
            <Button
              onClick={handleCloseEditor}
              sx={{
                minWidth: 'auto',
                width: { xs: 36, sm: 40 },
                height: { xs: 36, sm: 40 },
                padding: 0,
              }}
            >
              <CloseIcon sx={{ fontSize: { xs: 20, sm: 24 } }} />
            </Button>
          </Box>

          {/* Canva Editor Iframe */}
          {editorUrl && (
            <Box 
              sx={{ 
                width: '100%', 
                height: '100%', 
                position: 'relative',
                flex: 1,
                overflow: 'hidden',
              }}
            >
              <iframe
                ref={iframeRef}
                src={editorUrl}
                width="100%"
                height="100%"
                frameBorder="0"
                allowFullScreen
                allow="clipboard-read; clipboard-write; camera; microphone; geolocation; autoplay"
                style={{ 
                  border: 'none',
                  display: 'block',
                  width: '100%',
                  height: '100%',
                  minHeight: isMobile ? '100vh' : '600px',
                }}
                title="Canva Embedded Editor"
                loading="lazy"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-downloads"
              />
              
              {/* Info Banner - Hidden on Mobile */}
              <Alert 
                severity="info" 
                sx={{ 
                  position: 'absolute', 
                  bottom: { xs: 0, sm: 16 }, 
                  left: { xs: 0, sm: 16 }, 
                  right: { xs: 0, sm: 16 },
                  zIndex: 1000,
                  maxWidth: { xs: '100%', sm: 'calc(100% - 32px)' },
                  display: { xs: 'none', sm: 'flex' },
                  borderRadius: { xs: 0, sm: 1 },
                }}
              >
                <Typography variant="body2" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                  Editing your travel diary in Canva. Changes are saved automatically.
                </Typography>
              </Alert>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

