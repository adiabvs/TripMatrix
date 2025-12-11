'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';

interface AdobeExpressEditorProps {
  clientId: string;
  designId?: string;
  onDesignSave?: (designId: string, editorUrl: string) => void;
  onError?: (error: Error) => void;
}

declare global {
  interface Window {
    CCEverywhere?: {
      initialize: (config: {
        clientId: string;
        appName: string;
        appVersion?: { major: number; minor: number };
        platformCategory?: 'web' | 'mobile';
      }) => Promise<{
        module?: any;
        editor?: any;
        [key: string]: any;
      }>;
      terminate?: () => void;
    };
    __adobeExpressSDKLoaded?: boolean;
    __adobeExpressSDKInitialized?: boolean;
    __adobeExpressInitializing?: boolean;
    __adobeExpressEditor?: any;
    __adobeExpressModule?: any;
  }
}

export default function AdobeExpressEditor({
  clientId,
  designId,
  onDesignSave,
  onError,
}: AdobeExpressEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sdkLoaded, setSdkLoaded] = useState(false);

  useEffect(() => {
    // Load Adobe Express Embed SDK only once globally
    if (window.__adobeExpressSDKLoaded && window.CCEverywhere) {
      setSdkLoaded(true);
      return;
    }

    // Check if script already exists
    const existingScript = document.querySelector('script[src="https://cc-embed.adobe.com/sdk/v4/CCEverywhere.js"]');
    if (existingScript) {
      // Script is loading or loaded, wait for it
      const checkInterval = setInterval(() => {
        if (window.CCEverywhere) {
          clearInterval(checkInterval);
          window.__adobeExpressSDKLoaded = true;
          setSdkLoaded(true);
        }
      }, 100);
      
      // Also check immediately in case it's already loaded
      if (window.CCEverywhere) {
        clearInterval(checkInterval);
        window.__adobeExpressSDKLoaded = true;
        setSdkLoaded(true);
      }
      
      return () => clearInterval(checkInterval);
    }

    // Load the script
    const script = document.createElement('script');
    script.src = 'https://cc-embed.adobe.com/sdk/v4/CCEverywhere.js';
    script.async = true;
    script.id = 'adobe-express-sdk-script'; // Add ID to make it easier to find
    script.onload = () => {
      window.__adobeExpressSDKLoaded = true;
      setSdkLoaded(true);
    };
    script.onerror = () => {
      setError('Failed to load Adobe Express SDK. Please check your internet connection and ensure the SDK URL is accessible.');
      setLoading(false);
    };
    document.body.appendChild(script);

    // Don't remove script on cleanup - it should persist for the page lifetime
  }, []);

  useEffect(() => {
    if (!sdkLoaded || !clientId || initializedRef.current) return;

    let isMounted = true;

    const initializeEditor = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!window.CCEverywhere) {
          throw new Error('Adobe Express SDK not loaded');
        }

        // Check if SDK is already initialized - wait a bit if initialization is in progress
        let editor;
        if (window.__adobeExpressSDKInitialized && window.__adobeExpressEditor) {
          // Reuse existing editor instance
          editor = window.__adobeExpressEditor;
        } else if (window.__adobeExpressInitializing) {
          // Wait for initialization to complete
          let attempts = 0;
          while (window.__adobeExpressInitializing && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
          }
          if (window.__adobeExpressEditor) {
            editor = window.__adobeExpressEditor;
          } else {
            throw new Error('SDK initialization timeout');
          }
        } else {
          // Initialize the SDK only once - set flag immediately to prevent concurrent initializations
          window.__adobeExpressInitializing = true;
          try {
            const initResult = await window.CCEverywhere.initialize({
              clientId,
              appName: 'TripMatrix',
              appVersion: { major: 1, minor: 0 },
              platformCategory: 'web',
            });
            
            // The SDK v4 might return 'module' or 'editor' - check both
            editor = initResult.editor || initResult.module || initResult;
            
            // Log the structure for debugging
            console.log('Adobe Express SDK initialized:', {
              hasEditor: !!initResult.editor,
              hasModule: !!initResult.module,
              keys: Object.keys(initResult),
            });
            
            window.__adobeExpressSDKInitialized = true;
            window.__adobeExpressEditor = editor;
            window.__adobeExpressModule = initResult.module || initResult;
          } catch (initError: any) {
            // If initialization fails because it's already initialized, try to get existing editor
            if (initError.message?.includes('SDK_ALREADY_INITIALIZED') || 
                initError.message?.includes('already initialized')) {
              // Wait a moment and check if editor is available
              await new Promise(resolve => setTimeout(resolve, 500));
              if (window.__adobeExpressEditor) {
                editor = window.__adobeExpressEditor;
                window.__adobeExpressSDKInitialized = true;
              } else {
                throw initError;
              }
            } else {
              throw initError;
            }
          } finally {
            window.__adobeExpressInitializing = false;
          }
        }

        if (!isMounted) return;

        // Mark as initialized to prevent re-initialization
        initializedRef.current = true;

        // Check what methods are available on the editor/module
        console.log('Editor object:', editor);
        console.log('Available methods:', Object.keys(editor || {}));

        // Launch editor - create new design or edit existing
        // Try different method names based on SDK version
        if (designId) {
          // Edit existing design
          if (typeof editor.editDesign === 'function') {
            editor.editDesign({
            projectId: designId,
            callbacks: {
              onCancel: () => {
                if (isMounted) {
                  setLoading(false);
                }
              },
              onPublish: (publishParams: { projectId: string; asset?: { data?: { url?: string } } }) => {
                if (isMounted && onDesignSave) {
                  onDesignSave(publishParams.projectId, publishParams.asset?.data?.url || '');
                  setLoading(false);
                }
              },
              onError: (err: Error | string) => {
                if (isMounted) {
                  const error = err instanceof Error ? err : new Error(String(err));
                  setError(error.message);
                  setLoading(false);
                  if (onError) {
                    onError(error);
                  }
                }
              },
            },
            outputParams: {
              outputType: 'url',
            },
            });
          } else if (typeof editor.edit === 'function') {
            editor.edit(designId, {
              onCancel: () => {
                if (isMounted) {
                  setLoading(false);
                }
              },
              onPublish: (publishParams: any) => {
                if (isMounted && onDesignSave) {
                  onDesignSave(publishParams.projectId || designId, publishParams.asset?.data?.url || '');
                  setLoading(false);
                }
              },
              onError: (err: any) => {
                if (isMounted) {
                  const error = err instanceof Error ? err : new Error(String(err));
                  setError(error.message);
                  setLoading(false);
                  if (onError) {
                    onError(error);
                  }
                }
              },
            });
          } else {
            throw new Error('editDesign or edit method not found on editor object. Available methods: ' + Object.keys(editor || {}).join(', '));
          }
        } else {
          // Create new design
          if (typeof editor.createDesign === 'function') {
            editor.createDesign({
            callbacks: {
              onCancel: () => {
                if (isMounted) {
                  setLoading(false);
                }
              },
              onPublish: (publishParams: { projectId: string; asset?: { data?: { url?: string } } }) => {
                if (isMounted && onDesignSave) {
                  onDesignSave(publishParams.projectId, publishParams.asset?.data?.url || '');
                  setLoading(false);
                }
              },
              onError: (err: Error | string) => {
                if (isMounted) {
                  const error = err instanceof Error ? err : new Error(String(err));
                  setError(error.message);
                  setLoading(false);
                  if (onError) {
                    onError(error);
                  }
                }
              },
            },
            outputParams: {
              outputType: 'url',
            },
            });
          } else if (typeof editor.create === 'function') {
            editor.create({
              onCancel: () => {
                if (isMounted) {
                  setLoading(false);
                }
              },
              onPublish: (publishParams: any) => {
                if (isMounted && onDesignSave) {
                  onDesignSave(publishParams.projectId, publishParams.asset?.data?.url || '');
                  setLoading(false);
                }
              },
              onError: (err: any) => {
                if (isMounted) {
                  const error = err instanceof Error ? err : new Error(String(err));
                  setError(error.message);
                  setLoading(false);
                  if (onError) {
                    onError(error);
                  }
                }
              },
            });
          } else {
            throw new Error('createDesign or create method not found on editor object. Available methods: ' + Object.keys(editor || {}).join(', '));
          }
        }
      } catch (err: any) {
        if (isMounted) {
          // Check if error is about SDK already being initialized
          if (err.message?.includes('SDK_ALREADY_INITIALIZED') || err.message?.includes('already initialized')) {
            // Try to use existing editor if available
            if (window.__adobeExpressEditor) {
              const editor = window.__adobeExpressEditor;
              setLoading(false);
              // Retry with existing editor
              setTimeout(() => {
                if (designId) {
                  editor.editDesign({
                    projectId: designId,
                    callbacks: {
                      onCancel: () => setLoading(false),
                      onPublish: (publishParams: { projectId: string; asset?: { data?: { url?: string } } }) => {
                        if (onDesignSave) {
                          onDesignSave(publishParams.projectId, publishParams.asset?.data?.url || '');
                        }
                        setLoading(false);
                      },
                      onError: (err: Error | string) => {
                        const error = err instanceof Error ? err : new Error(String(err));
                        setError(error.message);
                        setLoading(false);
                        if (onError) onError(error);
                      },
                    },
                    outputParams: { outputType: 'url' },
                  });
                } else {
                  editor.createDesign({
                    callbacks: {
                      onCancel: () => setLoading(false),
                      onPublish: (publishParams: { projectId: string; asset?: { data?: { url?: string } } }) => {
                        if (onDesignSave) {
                          onDesignSave(publishParams.projectId, publishParams.asset?.data?.url || '');
                        }
                        setLoading(false);
                      },
                      onError: (err: Error | string) => {
                        const error = err instanceof Error ? err : new Error(String(err));
                        setError(error.message);
                        setLoading(false);
                        if (onError) onError(error);
                      },
                    },
                    outputParams: { outputType: 'url' },
                  });
                }
              }, 100);
              return;
            }
          }
          const errorMessage = err.message || 'Failed to initialize Adobe Express editor';
          setError(errorMessage);
          setLoading(false);
          if (onError) {
            onError(new Error(errorMessage));
          }
        }
      }
    };

    initializeEditor();

    return () => {
      isMounted = false;
    };
  }, [sdkLoaded, clientId, designId, onDesignSave, onError]);

  if (!clientId) {
    return (
      <Alert severity="warning">
        Adobe Express Client ID not configured. Please set NEXT_PUBLIC_ADOBE_EXPRESS_CLIENT_ID in your environment variables.
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ width: '100%', height: '100%', minHeight: '600px', position: 'relative' }}>
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <CircularProgress />
          <Typography variant="body2" color="text.secondary">
            Loading Adobe Express Editor...
          </Typography>
        </Box>
      )}
      <Box
        ref={containerRef}
        id="adobe-express-editor"
        sx={{
          width: '100%',
          height: '100%',
          minHeight: '600px',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
        }}
      />
    </Box>
  );
}

