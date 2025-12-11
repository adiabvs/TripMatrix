'use client';

import { useAuth } from '@/lib/auth';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getTrip, generateDiary, getDiary, updateDiary } from '@/lib/api';
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
} from '@mui/icons-material';
import AdobeExpressEditor from '@/components/AdobeExpressEditor';

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
  const [showEditor, setShowEditor] = useState(false);

  const adobeExpressClientId = process.env.NEXT_PUBLIC_ADOBE_EXPRESS_CLIENT_ID || '';

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

  const loadData = async () => {
    try {
      const token = await getIdToken();
      const [tripData, diaryData] = await Promise.all([
        getTrip(tripId, token),
        getDiary(tripId, token).catch(() => null), // Diary might not exist yet
      ]);
      setTrip(tripData);
      setDiary(diaryData);
    } catch (error: any) {
      console.error('Failed to load data:', error);
      setError(error.message || 'Failed to load data');
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
    } catch (error: any) {
      console.error('Failed to generate diary:', error);
      setError(error.message || 'Failed to create diary');
    } finally {
      setGenerating(false);
    }
  };

  const handleDesignSave = async (designId: string, editorUrl: string) => {
    if (!diary) return;

    try {
      const token = await getIdToken();
      const updatedDiary = await updateDiary(
        diary.diaryId,
        {
          adobeExpressDesignId: designId,
          adobeExpressEditorUrl: editorUrl,
        },
        token
      );
      setDiary(updatedDiary);
      alert('Diary saved successfully!');
    } catch (error: any) {
      console.error('Failed to save diary:', error);
      alert('Failed to save diary: ' + error.message);
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
                ? 'Create a beautiful travel diary from your completed trip using Adobe Express'
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
            {showEditor || diary.adobeExpressDesignId ? (
              <Card sx={{ mb: 3 }}>
                <CardContent sx={{ p: 0 }}>
                  <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="h6" sx={{ fontWeight: 400 }}>
                        {diary.title}
                      </Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => setShowEditor(!showEditor)}
                        startIcon={<EditIcon />}
                        sx={{ textTransform: 'none' }}
                      >
                        {showEditor ? 'Hide Editor' : 'Edit Diary'}
                      </Button>
                    </Box>
                  </Box>
                  {showEditor && (
                    <Box sx={{ p: 3 }}>
                      {adobeExpressClientId ? (
                        <AdobeExpressEditor
                          clientId={adobeExpressClientId}
                          designId={diary.adobeExpressDesignId}
                          onDesignSave={handleDesignSave}
                          onError={(err) => setError(err.message)}
                        />
                      ) : (
                        <Alert severity="warning">
                          Adobe Express Client ID not configured. Please set NEXT_PUBLIC_ADOBE_EXPRESS_CLIENT_ID in your environment variables.
                        </Alert>
                      )}
                    </Box>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card sx={{ mb: 3 }}>
                <CardContent sx={{ p: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <BookIcon sx={{ fontSize: 48, color: 'primary.main' }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h5" component="h2" sx={{ fontWeight: 400 }}>
                        {diary.title}
                      </Typography>
                      {diary.description && (
                        <Typography variant="body2" color="text.secondary">
                          {diary.description}
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Button
                      variant="contained"
                      startIcon={<EditIcon />}
                      onClick={() => setShowEditor(true)}
                      sx={{ textTransform: 'none' }}
                    >
                      Create/Edit Diary in Adobe Express
                    </Button>

                    <Button
                      variant="outlined"
                      startIcon={<VideoIcon />}
                      onClick={handleGenerateVideo}
                      disabled={true}
                      sx={{ textTransform: 'none' }}
                    >
                      Generate Video (Coming Soon)
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            )}

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
