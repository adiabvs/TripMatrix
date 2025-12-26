'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Button, Alert, Typography, CircularProgress } from '@mui/material';
import {
  Edit as EditIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

declare global {
  interface Window {
    Canva?: {
      DesignButton?: {
        initialize: (config: { apiKey: string }) => Promise<{
          createDesign: (config: { design: { type: string } }) => Promise<{ designId: string; designUrl?: string } | void>;
          editDesign: (config: { designId: string }) => Promise<{ designId: string; designUrl?: string } | void>;
        }>;
      };
    };
  }
}

interface CanvaEditorProps {
  apiKey: string;
  designId?: string;
  designUrl?: string;
  onDesignCreated?: (designId: string, designUrl: string) => void;
  onDesignUpdated?: (designId: string, designUrl: string) => void;
  tripTitle: string;
  tripDescription?: string;
  places: Array<{
    name: string;
    description: string;
    rating?: number;
    images: string[];
    modeOfTravel?: string;
  }>;
  coverImage?: string;
}

export default function CanvaEditor({
  apiKey,
  designId,
  designUrl,
  onDesignCreated,
  onDesignUpdated,
  tripTitle,
  tripDescription,
  places,
  coverImage,
}: CanvaEditorProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const canvaButtonRef = useRef<any>(null);
  const initializedRef = useRef(false);

  // Validate API key
  useEffect(() => {
    if (!apiKey || apiKey.trim() === '') {
      setError('Canva API key is not configured. Please set NEXT_PUBLIC_CANVA_API_KEY in your environment variables.');
      setLoading(false);
      return;
    }
  }, [apiKey]);

  // Load Canva Embed SDK
  useEffect(() => {
    if (typeof window === 'undefined' || !apiKey || apiKey.trim() === '') {
      return;
    }

    // Check if SDK is already loaded
    if (window.Canva && window.Canva.DesignButton && typeof window.Canva.DesignButton.initialize === 'function') {
      console.log('Canva SDK already loaded');
      setSdkLoaded(true);
      setLoading(false);
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src*="sdk.canva.com/designbutton"]');
    if (existingScript) {
      console.log('Canva SDK script already exists, waiting for load...');
      existingScript.addEventListener('load', () => {
        if (window.Canva && window.Canva.DesignButton) {
          setSdkLoaded(true);
          setLoading(false);
        }
      });
      return;
    }

    // Load the SDK script (using v2 API)
    console.log('Loading Canva Embed SDK...');
    const script = document.createElement('script');
    script.src = 'https://sdk.canva.com/designbutton/v2/api.js';
    script.async = true;
    script.onload = () => {
      console.log('Canva SDK script loaded');
      // Wait a bit for the SDK to initialize
      setTimeout(() => {
        if (window.Canva && window.Canva.DesignButton && typeof window.Canva.DesignButton.initialize === 'function') {
          console.log('Canva SDK is ready');
          setSdkLoaded(true);
          setLoading(false);
        } else {
          console.error('Canva SDK loaded but DesignButton not available', {
            hasCanva: !!window.Canva,
            hasDesignButton: !!(window.Canva?.DesignButton),
            hasInitialize: !!(window.Canva?.DesignButton?.initialize),
          });
          setError('Canva SDK loaded but DesignButton API not available. Please check your API key and SDK version.');
          setLoading(false);
        }
      }, 200);
    };
    script.onerror = (error) => {
      console.error('Failed to load Canva Embed SDK script:', error);
      setError('Failed to load Canva Embed SDK. Please check your internet connection and Content Security Policy settings.');
      setLoading(false);
    };
    
    // Listen for network errors
    window.addEventListener('error', (event) => {
      if (event.message?.includes('canva') || event.filename?.includes('canva')) {
        console.error('Canva SDK error:', event);
        if (event.message?.includes('403') || event.filename?.includes('403')) {
          setError('Canva API returned 403 Forbidden. This usually means: 1) Your API key is invalid or expired, 2) Your domain is not whitelisted in Canva Developer Console, 3) Your API key doesn\'t have the required permissions. Please check your Canva Developer Console settings.');
        }
      }
    }, true);
    document.head.appendChild(script);

    return () => {
      // Don't remove script on unmount as it might be used by other components
    };
  }, [apiKey]);

  // Initialize Canva API when SDK is loaded
  useEffect(() => {
    if (!sdkLoaded || !apiKey || apiKey.trim() === '') {
      return;
    }

    if (!window.Canva || !window.Canva.DesignButton || typeof window.Canva.DesignButton.initialize !== 'function') {
      console.error('Canva SDK not available:', { 
        Canva: !!window.Canva, 
        DesignButton: !!(window.Canva?.DesignButton),
        initialize: typeof window.Canva?.DesignButton?.initialize,
      });
      setInitError('Canva SDK not properly initialized');
      return;
    }

    if (initializedRef.current) {
      console.log('Already initialized');
      return;
    }

    // Initialize the Canva API
    console.log('Initializing Canva DesignButton API with API key:', apiKey.substring(0, 10) + '...');
    initializedRef.current = true;

    window.Canva.DesignButton.initialize({ apiKey })
      .then((api) => {
        console.log('Canva API initialized successfully');
        canvaButtonRef.current = api;
        setInitError(null);
      })
      .catch((err: any) => {
        console.error('Failed to initialize Canva API:', err);
        console.error('Error details:', {
          message: err.message,
          name: err.name,
          stack: err.stack,
          apiKeyPrefix: apiKey.substring(0, 10) + '...',
        });
        
        let errorMessage = 'Failed to initialize Canva API. ';
        if (err.message?.includes('403') || err.status === 403) {
          errorMessage += '403 Forbidden error. This usually means:\n';
          errorMessage += '1. Your API key is invalid or expired\n';
          errorMessage += '2. Your domain is not whitelisted in Canva Developer Console\n';
          errorMessage += '3. Your API key doesn\'t have DesignButton permissions\n';
          errorMessage += 'Please check your Canva Developer Console settings.';
        } else if (err.message?.includes('401') || err.status === 401) {
          errorMessage += '401 Unauthorized. Your API key is invalid. Please check your API key.';
        } else {
          errorMessage += err.message || 'Please check your API key and Canva Developer Console settings.';
        }
        
        setInitError(errorMessage);
        initializedRef.current = false; // Allow retry
      });
  }, [sdkLoaded, apiKey]);

  const handleCreateDesign = async () => {
    if (!canvaButtonRef.current) {
      const errorMsg = initError || 'Canva editor not initialized. Please check that your API key is correct and the SDK loaded successfully.';
      setError(errorMsg);
      console.error('Cannot create design:', {
        hasApi: !!canvaButtonRef.current,
        sdkLoaded,
        hasCanva: !!window.Canva,
        hasDesignButton: !!(window.Canva?.DesignButton),
        initError,
      });
      return;
    }

    try {
      console.log('Opening Canva editor to create new design...');
      // Open Canva editor to create a new design
      // The API expects a design object with a type property
      const result = await canvaButtonRef.current.createDesign({
        design: {
          type: 'Presentation', // Options: 'Poster', 'Presentation', 'SocialMedia', etc.
        },
      });
      console.log('Canva editor opened:', result);
      
      // Handle the result - it might contain design ID and URL
      if (result && result.designId) {
        const designUrl = `https://www.canva.com/design/${result.designId}/view`;
        if (onDesignCreated) {
          onDesignCreated(result.designId, designUrl);
        }
      }
    } catch (err: any) {
      console.error('Failed to open Canva editor:', err);
      console.error('Error details:', {
        message: err.message,
        stack: err.stack,
        name: err.name,
      });
      setError(err.message || 'Failed to open Canva editor. Please check the Canva API documentation.');
    }
  };

  const handleEditDesign = async () => {
    if (!canvaButtonRef.current || !designId) {
      setError('Design ID not available or Canva API not initialized');
      return;
    }

    try {
      console.log('Opening Canva editor to edit design:', designId);
      // Open Canva editor to edit existing design
      const result = await canvaButtonRef.current.editDesign({ designId });
      console.log('Canva editor opened for editing:', result);
      
      // Handle the result - it might contain updated design ID and URL
      if (result && result.designId) {
        const designUrl = result.designUrl || `https://www.canva.com/design/${result.designId}/view`;
        if (onDesignUpdated) {
          onDesignUpdated(result.designId, designUrl);
        }
      }
    } catch (err: any) {
      console.error('Failed to open Canva editor:', err);
      console.error('Error details:', {
        message: err.message,
        stack: err.stack,
        name: err.name,
        designId,
      });
      setError(err.message || 'Failed to open Canva editor for editing');
    }
  };

  const handleDownload = () => {
    if (!designUrl) {
      setError('Design URL not available');
      return;
    }
    window.open(designUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <CircularProgress />
        <Typography variant="body2" sx={{ ml: 2 }}>
          Loading Canva editor...
        </Typography>
      </Box>
    );
  }

  // Show error if API key is missing or SDK failed to load
  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ mb: 1, fontWeight: 'bold' }}>
          {error}
        </Typography>
        {error.includes('API key') && (
          <Typography variant="body2" component="div">
            <strong>To fix this:</strong>
            <ol style={{ marginTop: 8, marginBottom: 8, paddingLeft: 24 }}>
              <li>Get your Canva API key from <a href="https://www.canva.dev/" target="_blank" rel="noopener noreferrer">Canva Developer Platform</a></li>
              <li>Add it to your <code>.env.local</code> file: <code>NEXT_PUBLIC_CANVA_API_KEY=your_key_here</code></li>
              <li>Restart your development server</li>
            </ol>
          </Typography>
        )}
      </Alert>
    );
  }

  // Show initialization error separately
  if (initError && !loading) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ mb: 1 }}>
          {initError}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          onClick={() => {
            initializedRef.current = false;
            setInitError(null);
            // Force re-initialization
            if (window.Canva && window.Canva.DesignButton && typeof window.Canva.DesignButton.initialize === 'function') {
              window.Canva.DesignButton.initialize({ apiKey })
                .then((api) => {
                  console.log('Canva API re-initialized successfully');
                  canvaButtonRef.current = api;
                  setInitError(null);
                })
                .catch((err: any) => {
                  console.error('Failed to re-initialize Canva API:', err);
                  setInitError(err.message || 'Failed to initialize Canva API');
                });
            }
          }}
          sx={{ mt: 1, textTransform: 'none' }}
        >
          Retry Initialization
        </Button>
      </Alert>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        {!designId ? (
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={handleCreateDesign}
            sx={{ textTransform: 'none' }}
          >
            Create Travel Diary in Canva
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
                onClick={handleDownload}
                sx={{ textTransform: 'none' }}
              >
                View Design
              </Button>
            )}
          </>
        )}
      </Box>

      {/* Note: Canva v2 API doesn't use a button container - it opens a modal directly */}
      {!initError && canvaButtonRef.current && (
        <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Canva editor is ready. Click the buttons above to create or edit your design.
          </Typography>
        </Box>
      )}

      {/* Design preview info */}
      {designUrl && (
        <Box sx={{ mt: 3 }}>
          <Alert severity="info">
            <Typography variant="body2">
              Canva designs cannot be embedded in iframes. Click &quot;View Design&quot; to open in a new tab.
            </Typography>
          </Alert>
        </Box>
      )}

      <Alert severity="info" sx={{ mt: 2 }}>
        <Typography variant="body2">
          {!designId
            ? 'Click "Create Travel Diary in Canva" to start designing your travel diary. You can add photos, text, and customize the layout!'
            : 'Click "Edit in Canva" to modify your travel diary design. All changes will be saved automatically.'}
        </Typography>
      </Alert>

      {/* Design data preview (for debugging) */}
      {process.env.NODE_ENV === 'development' && (
        <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
          <Typography variant="caption" sx={{ display: 'block', mb: 1, fontWeight: 'bold' }}>
            Design Data (Debug):
          </Typography>
          <Typography variant="caption" component="pre" sx={{ fontSize: '0.75rem', overflow: 'auto' }}>
            {JSON.stringify(
              {
                tripTitle,
                tripDescription,
                coverImage,
                placesCount: places.length,
                places: places.map((p) => ({
                  name: p.name,
                  hasDescription: !!p.description,
                  hasImages: p.images.length > 0,
                  rating: p.rating,
                  modeOfTravel: p.modeOfTravel,
                })),
              },
              null,
              2
            )}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

