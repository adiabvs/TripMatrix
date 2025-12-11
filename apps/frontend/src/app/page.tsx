'use client';

import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getPublicTrips } from '@/lib/api';
import type { Trip } from '@tripmatrix/types';
import { format } from 'date-fns';
import { toDate } from '@/lib/dateUtils';
import UserMenu from '@/components/UserMenu';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  TextField,
  InputAdornment,
  Card,
  CardMedia,
  CardContent,
  Chip,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  Home as HomeIcon,
  Add as AddIcon,
  Login as LoginIcon,
  Explore as ExploreIcon,
} from '@mui/icons-material';

export default function Home() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredTrips, setFilteredTrips] = useState<Trip[]>([]);

  useEffect(() => {
    loadPublicTrips();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const filtered = trips.filter((trip) => {
        if (trip.title.toLowerCase().includes(query)) return true;
        if (trip.description?.toLowerCase().includes(query)) return true;
        return false;
      });
      setFilteredTrips(filtered);
    } else {
      setFilteredTrips(trips.slice(0, 5));
    }
  }, [searchQuery, trips]);

  const loadPublicTrips = async () => {
    try {
      const publicTrips = await getPublicTrips();
      console.log('Loaded public trips:', publicTrips.length);
      const sorted = publicTrips.sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime;
      });
      setTrips(sorted);
      setFilteredTrips(sorted.slice(0, 5));
    } catch (error) {
      console.error('Failed to load public trips:', error);
      alert('Failed to load public trips. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
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
          <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Typography variant="h5" component="div" sx={{ fontWeight: 500, color: 'text.primary' }}>
              TripMatrix
            </Typography>
          </Link>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 }, flexWrap: 'wrap' }}>
            {user ? (
              <>
                <Button
                  component={Link}
                  href="/trips"
                  startIcon={<HomeIcon />}
                  sx={{ 
                    color: 'text.primary', 
                    textTransform: 'none',
                    display: { xs: 'none', sm: 'flex' },
                  }}
                >
                  My Trips
                </Button>
                <Button
                  component={Link}
                  href="/trips/new"
                  variant="contained"
                  startIcon={<AddIcon />}
                  sx={{ textTransform: 'none' }}
                >
                  <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Create Trip</Box>
                  <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>New</Box>
                </Button>
              </>
            ) : (
              <Button
                component={Link}
                href="/auth"
                startIcon={<LoginIcon />}
                variant="outlined"
                sx={{ textTransform: 'none' }}
              >
                Sign In
              </Button>
            )}
            <UserMenu />
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: { xs: 3, sm: 4, md: 6 } }}>
        <Box sx={{ textAlign: 'center', mb: { xs: 4, sm: 5, md: 6 } }}>
          <Typography variant="h2" component="h1" sx={{ mb: 1.5, fontWeight: 400 }}>
            Discover Amazing Trips
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: { xs: 3, sm: 4 } }}>
            Explore travel stories from around the world
          </Typography>

          <Box sx={{ maxWidth: 600, mx: 'auto', px: { xs: 1 } }}>
            <TextField
              fullWidth
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by location, user, or trip name..."
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: { xs: 20, sm: 24 } }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 8,
                  bgcolor: 'background.paper',
                },
              }}
            />
          </Box>
        </Box>

        <Box sx={{ mb: { xs: 3, sm: 4 } }}>
          <Typography variant="h5" component="h2" sx={{ mb: { xs: 2, sm: 3 }, fontWeight: 400 }}>
            {searchQuery ? `Search Results (${filteredTrips.length})` : `Featured Trips (${trips.length} total)`}
          </Typography>

          {filteredTrips.length === 0 ? (
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
                <SearchIcon sx={{ fontSize: 48, color: 'grey.400' }} />
              </Box>
              <Typography variant="h6" sx={{ mb: 1 }}>
                No trips found
              </Typography>
              <Typography color="text.secondary">Try a different search term</Typography>
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
              {filteredTrips.map((trip) => (
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
        </Box>

        {!searchQuery && trips.length > 5 && (
          <Box sx={{ textAlign: 'center', mt: { xs: 4, sm: 5, md: 6 } }}>
            <Button
              component={Link}
              href="/trips/public"
              endIcon={<ExploreIcon />}
              sx={{ textTransform: 'none' }}
            >
              View All {trips.length} Public Trips
            </Button>
          </Box>
        )}

        {!user && (
          <Box sx={{ mt: { xs: 5, sm: 6, md: 8 }, textAlign: 'center' }}>
            <Card sx={{ maxWidth: 600, mx: 'auto', p: { xs: 3, sm: 4 }, bgcolor: 'grey.50' }}>
              <Typography variant="h5" component="h3" sx={{ mb: 1.5, fontWeight: 500 }}>
                Start Your Own Journey
              </Typography>
              <Typography color="text.secondary" sx={{ mb: { xs: 2.5, sm: 3 } }}>
                Sign in to create and share your travel stories
              </Typography>
              <Button
                component={Link}
                href="/auth"
                variant="contained"
                size="large"
                sx={{ textTransform: 'none' }}
              >
                Get Started
              </Button>
            </Card>
          </Box>
        )}
      </Container>
    </Box>
  );
}
