'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import {
  Avatar,
  Badge,
  Box,
} from '@mui/material';
import { getUnreadNotificationCount } from '@/lib/api';

export default function UserMenu() {
  const { user, getIdToken } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const loadUnreadCount = async () => {
      if (user) {
        try {
          const token = await getIdToken();
          const count = await getUnreadNotificationCount(token);
          setUnreadCount(count);
        } catch (error) {
          console.error('Failed to load notification count:', error);
        }
      }
    };

    loadUnreadCount();
    // Refresh count every 30 seconds
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [user, getIdToken]);

  if (!user) {
    return null;
  }

  return (
    <Box>
      <Link href="/profile" style={{ textDecoration: 'none' }}>
        {unreadCount > 0 ? (
          <Badge
            badgeContent={unreadCount > 9 ? '9+' : unreadCount}
            color="error"
            overlap="circular"
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            sx={{
              '& .MuiBadge-badge': {
                fontSize: '0.65rem',
                minWidth: '18px',
                height: '18px',
                padding: '0 4px',
              },
            }}
          >
            <Avatar
              src={user.photoUrl || undefined}
              sx={{ width: 24, height: 24, cursor: 'pointer' }}
            >
              {!user.photoUrl && user.name.charAt(0).toUpperCase()}
            </Avatar>
          </Badge>
        ) : (
          <Avatar
            src={user.photoUrl || undefined}
            sx={{ width: 24, height: 24, cursor: 'pointer' }}
          >
            {!user.photoUrl && user.name.charAt(0).toUpperCase()}
          </Avatar>
        )}
      </Link>
    </Box>
  );
}
