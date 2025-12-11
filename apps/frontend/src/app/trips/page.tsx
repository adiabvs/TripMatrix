'use client';

import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getUserTrips } from '@/lib/api';
import type { Trip } from '@tripmatrix/types';
import Link from 'next/link';
import { format } from 'date-fns';
import { toDate } from '@/lib/dateUtils';
import UserMenu from '@/components/UserMenu';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  Button,
  CircularProgress,
  Card,
  CardMedia,
  CardContent,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Explore as ExploreIcon,
  Home as HomeIcon,
} from '@mui/icons-material';

export default function TripsPage() {
  const { user, loading: authLoading, getIdToken } = useAuth();
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      loadTrips();
    }
  }, [user]);

  const loadTrips = async () => {
    try {
      const token = await getIdToken();
      const userTrips = await getUserTrips(token);
      setTrips(userTrips);
    } catch (error) {
      console.error('Failed to load trips:', error);
    } finally {
      setLoading(false);
    }
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

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'background.paper' }}>
        <Toolbar sx={{ justifyContent: 'space-between', maxWidth: 'xl', width: '100%', mx: 'auto' }}>
          <Link href="/trips" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Typography variant="h5" component="div" sx={{ fontWeight: 500, color: 'text.primary' }}>
              TripMatrix
            </Typography>
          </Link>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 }, flexWrap: 'wrap' }}>
            <Button
              component={Link}
              href="/trips/public"
              startIcon={<ExploreIcon />}
              sx={{ 
                color: 'text.primary', 
                textTransform: 'none',
                display: { xs: 'none', sm: 'flex' },
              }}
            >
              Explore
            </Button>
            <Button
              component={Link}
              href="/trips/new"
              variant="contained"
              startIcon={<AddIcon />}
              sx={{ textTransform: 'none' }}
            >
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>New Trip</Box>
              <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>New</Box>
            </Button>
            <UserMenu />
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: { xs: 3, sm: 4, md: 6 } }}>
        <Box sx={{ mb: { xs: 3, sm: 4 } }}>
          <Typography variant="h3" component="h1" sx={{ mb: 1, fontWeight: 400 }}>
            My Trips
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Your travel stories and adventures
          </Typography>
        </Box>

        {trips.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 10 }}>
            <Box
              sx={{
                width: 96,
                height: 96,
                mx: 'auto',
                mb: 3,
                borderRadius: '50%',
                bgcolor: 'grey.100',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AddIcon sx={{ fontSize: 48, color: 'grey.400' }} />
            </Box>
            <Typography variant="h6" sx={{ mb: 1 }}>
              No trips yet
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Start your first adventure and create beautiful travel stories
            </Typography>
            <Button
              component={Link}
              href="/trips/new"
              variant="contained"
              size="large"
              startIcon={<AddIcon />}
              sx={{ textTransform: 'none' }}
            >
              Create Your First Trip
            </Button>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(3, 1fr)',
              },
              gap: { xs: 2, sm: 2.5, md: 3 },
            }}
          >
            {trips.map((trip) => (
              <Box key={trip.tripId}>
                <Card
                  component={Link}
                  href={`/trips/${trip.tripId}`}
                  sx={{
                    textDecoration: 'none',
                    color: 'inherit',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: { xs: 'none', sm: 'translateY(-4px)' },
                      boxShadow: { xs: 'none', sm: '0px 4px 12px rgba(0, 0, 0, 0.15)' },
                    },
                  }}
                >
                  <Box sx={{ position: 'relative', aspectRatio: '4/3', overflow: 'hidden' }}>
                    {trip.coverImage ? (
                      <CardMedia
                        component="img"
                        image={trip.coverImage}
                        alt={trip.title}
                        sx={{
                          height: '100%',
                          objectFit: 'cover',
                          transition: 'transform 0.5s',
                          '&:hover': {
                            transform: 'scale(1.05)',
                          },
                        }}
                      />
                    ) : (
                      <Box
                        sx={{
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: 'primary.light',
                        }}
                      >
                        <HomeIcon sx={{ fontSize: 64, color: 'grey.400' }} />
                      </Box>
                    )}
                    <Chip
                      label={trip.status === 'completed' ? 'Completed' : 'Active'}
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        bgcolor: trip.status === 'completed' ? 'success.main' : 'primary.main',
                        color: 'white',
                        fontWeight: 500,
                      }}
                    />
                  </Box>
                  <CardContent sx={{ flexGrow: 1, p: { xs: 2, sm: 2.5 } }}>
                    <Typography variant="h6" component="h3" sx={{ mb: 1, fontWeight: 500 }}>
                      {trip.title}
                    </Typography>
                    {trip.description && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mb: 1.5,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {trip.description}
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', gap: { xs: 1.5, sm: 2 }, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Typography variant="caption" color="text.secondary">
                        {format(toDate(trip.startTime), 'MMM yyyy')}
                      </Typography>
                      {trip.totalDistance && (
                        <Typography variant="caption" color="text.secondary">
                          {(trip.totalDistance / 1000).toFixed(0)} km
                        </Typography>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            ))}
          </Box>
        )}
      </Container>
    </Box>
  );
}
