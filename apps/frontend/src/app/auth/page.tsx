'use client';

import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  Box,
  Container,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
} from '@mui/material';
import { FaGoogle } from 'react-icons/fa';

export default function AuthPage() {
  const { signIn, user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push('/trips');
    }
  }, [user, router]);

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
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        backgroundImage: 'linear-gradient(135deg, #EADDFF 0%, #FFFBFE 100%)',
      }}
    >
      <Container maxWidth="sm" sx={{ px: { xs: 2, sm: 3 } }}>
        <Card elevation={0} sx={{ borderRadius: 4 }}>
          <CardContent sx={{ p: { xs: 4, sm: 5, md: 6 } }}>
            <Typography variant="h4" component="h1" align="center" sx={{ mb: { xs: 2, sm: 3 }, fontWeight: 400 }}>
              Welcome to TripMatrix
            </Typography>
            <Typography variant="body1" align="center" color="text.secondary" sx={{ mb: { xs: 3, sm: 4 } }}>
              Sign in with your Google account to start tracking your trips
            </Typography>
            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={signIn}
              startIcon={<FaGoogle />}
              sx={{
                textTransform: 'none',
                py: 1.5,
                bgcolor: '#4285F4',
                '&:hover': {
                  bgcolor: '#357AE8',
                },
              }}
            >
              Sign in with Google
            </Button>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
