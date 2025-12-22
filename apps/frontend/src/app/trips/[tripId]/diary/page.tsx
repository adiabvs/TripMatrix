'use client';

import { useAuth } from '@/lib/auth';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getTrip, generateDiary, getDiary, updateDiary, regenerateDesignData, deleteDiary } from '@/lib/api';
import type { Trip, TravelDiary } from '@tripmatrix/types';
import {
  Box,
  Container,
  Typography,
  Button,
  CircularProgress,
  Card,
  CardContent,
  Alert,
} from '@mui/material';
import {
  Book as BookIcon,
  Edit as EditIcon,
  VideoLibrary as VideoIcon,
  ArrowBack as ArrowBackIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import CanvaEmbeddedEditor from '@/components/CanvaEmbeddedEditor';

export default function DiaryPage() {
  const { user, loading: authLoading, getIdToken } = useAuth();
  const router = useRouter();
  const params = useParams();
  const tripId = params.tripId as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [diary, setDiary] = useState<TravelDiary | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (tripId && user) {
      loadData();
    }
  }, [tripId, user]);

  // Handle return from Canva after editing
  useEffect(() => {
    const canvaReturn = new URLSearchParams(window.location.search).get('canva_return');
    if (canvaReturn === 'success') {
      // Reload diary data to get updated design info
      if (tripId && user) {
        loadData();
      }
      // Remove query param
      const url = new URL(window.location.href);
      url.searchParams.delete('canva_return');
      url.searchParams.delete('diaryId');
      window.history.replaceState({}, '', url.toString());
    }
  }, [tripId, user]);

  useEffect(() => {
    if (user) {
      getIdToken().then(setAuthToken).catch(console.error);
    }
  }, [user, getIdToken]);

  const [showEditor, setShowEditor] = useState(false);

  const loadData = async () => {
    try {
      const token = await getIdToken();
      const [tripData, diaryData] = await Promise.all([
        getTrip(tripId, token).catch((err: any) => {
          // If trip not found, redirect to trips list
          if (err.message?.includes('not found') || err.message?.includes('404')) {
            router.push('/trips');
            return null;
          }
          throw err;
        }),
        getDiary(tripId, token).catch(() => null), // Diary might not exist yet
      ]);
      
      if (!tripData) {
        // Trip not found, redirect already handled
        return;
      }
      
      setTrip(tripData);
      setDiary(diaryData);
      
      // Show editor if diary exists
      if (diaryData) {
        setShowEditor(true);
      }
    } catch (error: any) {
      console.error('Failed to load data:', error);
      // If it's a "not found" error, redirect to trips list
      if (error.message?.includes('not found') || error.message?.includes('404')) {
        router.push('/trips');
      } else {
        setError(error.message || 'Failed to load data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDiary = async () => {
    if (!trip || trip.status !== 'completed') {
      alert('Trip must be completed before creating a diary');
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      const token = await getIdToken();
      const newDiary = await generateDiary(tripId, token);
      setDiary(newDiary);
      setShowEditor(true);
      
      // Auto-open Canva editor if design was created
      if (newDiary.canvaDesignId && newDiary.canvaEditorUrl) {
        // Redirect to Canva editor immediately after creating diary
        // Images are already uploaded to user's Canva account
        const editUrl = newDiary.canvaEditorUrl || `https://www.canva.com/design/${newDiary.canvaDesignId}/edit`;
        window.location.href = editUrl;
      }
    } catch (error: any) {
      console.error('Failed to generate diary:', error);
      setError(error.message || 'Failed to create diary');
      setGenerating(false);
    }
  };

  const handleDesignCreated = async (designId: string, designUrl: string) => {
    if (!diary) return;
    
    try {
      const token = await getIdToken();
      const updatedDiary = await updateDiary(diary.diaryId, {
        canvaDesignId: designId,
        canvaDesignUrl: designUrl,
        canvaEditorUrl: `https://www.canva.com/design/${designId}/edit`,
      }, token);
      setDiary(updatedDiary);
    } catch (error: any) {
      console.error('Failed to update diary with design:', error);
      setError(error.message || 'Failed to save design');
    }
  };

  const handleDesignUpdated = async (designId: string, designUrl: string) => {
    if (!diary) return;
    
    try {
      const token = await getIdToken();
      const updatedDiary = await updateDiary(diary.diaryId, {
        canvaDesignId: designId,
        canvaDesignUrl: designUrl,
        canvaEditorUrl: `https://www.canva.com/design/${designId}/edit`,
      }, token);
      setDiary(updatedDiary);
    } catch (error: any) {
      console.error('Failed to update diary with design:', error);
      setError(error.message || 'Failed to save design');
    }
  };

  const handleRegenerateDesignData = async () => {
    if (!diary) return;

    setGenerating(true);
    setError(null);
    try {
      const token = await getIdToken();
      const updatedDiary = await regenerateDesignData(diary.diaryId, token);
      setDiary(updatedDiary);
    } catch (error: any) {
      console.error('Failed to regenerate design data:', error);
      setError(error.message || 'Failed to regenerate design data');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteDiary = async () => {
    if (!diary) return;
    
    if (!confirm('Are you sure you want to delete this diary? This action cannot be undone.')) {
      return;
    }

    try {
      setGenerating(true);
      setError(null);
      const token = await getIdToken();
      await deleteDiary(diary.diaryId, token);
      setDiary(null);
      setShowEditor(false);
      setError(null);
    } catch (error: any) {
      console.error('Failed to delete diary:', error);
      setError(error.message || 'Failed to delete diary');
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerateDiary = async () => {
    if (!diary) return;
    
    if (!confirm('This will delete the current diary and create a new one. Are you sure?')) {
      return;
    }

    try {
      setGenerating(true);
      setError(null);
      const token = await getIdToken();
      
      // Delete existing diary
      await deleteDiary(diary.diaryId, token);
      
      // Generate new diary
      const newDiary = await generateDiary(tripId, token);
      setDiary(newDiary);
      setShowEditor(true);
      
      // Auto-open Canva editor if design was created
      if (newDiary.canvaDesignId && newDiary.canvaEditorUrl) {
        const editUrl = newDiary.canvaEditorUrl || `https://www.canva.com/design/${newDiary.canvaDesignId}/edit`;
        window.location.href = editUrl;
      }
    } catch (error: any) {
      console.error('Failed to regenerate diary:', error);
      setError(error.message || 'Failed to regenerate diary');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!diary) return;
    alert('Video generation feature coming soon!');
  };

  if (authLoading || loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!trip) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography>Trip not found</Typography>
      </Box>
    );
  }

  const isCreator = user?.uid === trip.creatorId;
  if (!isCreator && !trip.participants?.some(p => p.uid === user?.uid)) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography>You don't have permission to view this diary</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Container maxWidth="lg" sx={{ py: { xs: 3, sm: 4, md: 6 } }}>
        <Box sx={{ mb: 4 }}>
          <Button
            component={Link}
            href={`/trips/${tripId}`}
            startIcon={<ArrowBackIcon />}
            sx={{ mb: 2, textTransform: 'none' }}
          >
            Back to Trip
          </Button>
          <Typography variant="h4" component="h1" sx={{ mb: 1, fontWeight: 400 }}>
            Travel Diary
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {trip.title}
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {!diary ? (
          <Card sx={{ p: 4, textAlign: 'center' }}>
            <BookIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h5" component="h2" sx={{ mb: 2, fontWeight: 400 }}>
              No Diary Yet
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              {trip.status === 'completed'
                ? 'Create a beautiful travel diary from your completed trip using Canva'
                : 'Complete your trip first to create a travel diary'}
            </Typography>
            {trip.status === 'completed' && (
              <Button
                variant="contained"
                size="large"
                onClick={handleGenerateDiary}
                disabled={generating}
                startIcon={generating ? <CircularProgress size={20} /> : <BookIcon />}
                sx={{ textTransform: 'none' }}
              >
                {generating ? 'Creating...' : 'Create Travel Diary'}
              </Button>
            )}
          </Card>
        ) : (
          <Box>
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 400, mb: 1 }}>
                      {diary.title}
                    </Typography>
                    {diary.description && (
                      <Typography variant="body2" color="text.secondary">
                        {diary.description}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, ml: 2 }}>
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      onClick={handleDeleteDiary}
                      disabled={generating}
                      startIcon={generating ? <CircularProgress size={16} /> : <DeleteIcon />}
                      sx={{ textTransform: 'none' }}
                    >
                      Delete
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleRegenerateDiary}
                      disabled={generating}
                      startIcon={generating ? <CircularProgress size={16} /> : <RefreshIcon />}
                      sx={{ textTransform: 'none' }}
                    >
                      Regenerate
                    </Button>
                  </Box>
                </Box>
                {showEditor && (
                  <>
                    {diary.designData ? (
                      <CanvaEmbeddedEditor
                        diaryId={diary.diaryId}
                        designId={diary.canvaDesignId}
                        designUrl={diary.canvaDesignUrl}
                        editUrl={diary.canvaEditorUrl}
                        onDesignCreated={handleDesignCreated}
                        onDesignUpdated={handleDesignUpdated}
                        tripTitle={diary.title}
                        tripId={tripId}
                        token={authToken}
                      />
                    ) : (
                      <Box>
                        <Alert severity="warning" sx={{ mb: 2 }}>
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            Design data not available. Click the button below to regenerate it.
                          </Typography>
                        </Alert>
                        <Button
                          variant="contained"
                          onClick={handleRegenerateDesignData}
                          disabled={generating}
                          startIcon={generating ? <CircularProgress size={20} /> : <RefreshIcon />}
                          sx={{ textTransform: 'none', mb: 3 }}
                        >
                          {generating ? 'Regenerating...' : 'Regenerate Design Data'}
                        </Button>
                        {/* Show Canva editor even without designData - user can still create designs */}
                        <Box sx={{ mt: 2 }}>
                          <CanvaEmbeddedEditor
                            diaryId={diary.diaryId}
                            designId={diary.canvaDesignId}
                            designUrl={diary.canvaDesignUrl}
                            editUrl={diary.canvaEditorUrl}
                            onDesignCreated={handleDesignCreated}
                            onDesignUpdated={handleDesignUpdated}
                            tripTitle={diary.title}
                            tripId={tripId}
                            token={authToken}
                          />
                        </Box>
                      </Box>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {diary.videoUrl && (
              <Card>
                <CardContent sx={{ p: 4 }}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 400 }}>
                    Travel Diary Video
                  </Typography>
                  <video
                    src={diary.videoUrl}
                    controls
                    style={{ width: '100%', maxWidth: '100%', borderRadius: '8px' }}
                  />
                </CardContent>
              </Card>
            )}
          </Box>
        )}
      </Container>
    </Box>
  );
}
