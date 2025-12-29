'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Box,
  Badge,
} from '@mui/material';
import {
  AccountCircle as ProfileIcon,
  Logout as LogoutIcon,
  ExpandMore as ExpandMoreIcon,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import { getUnreadNotificationCount } from '@/lib/api';

export default function UserMenu() {
  const { user, signOut, getIdToken } = useAuth();
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSignOut = async () => {
    try {
      router.replace('/');
      await signOut();
      handleClose();
    } catch (error) {
      console.error('Failed to sign out:', error);
      router.replace('/');
      handleClose();
    }
  };

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
      <IconButton
        onClick={handleClick}
        size="small"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 0,
          color: 'white',
          minWidth: 'auto',
        }}
      >
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
              sx={{ width: 24, height: 24 }}
            >
              {!user.photoUrl && user.name.charAt(0).toUpperCase()}
            </Avatar>
          </Badge>
        ) : (
          <Avatar
            src={user.photoUrl || undefined}
            sx={{ width: 24, height: 24 }}
          >
            {!user.photoUrl && user.name.charAt(0).toUpperCase()}
          </Avatar>
        )}
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        onClick={handleClose}
        transformOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'top' }}
        PaperProps={{
          sx: {
            mb: 1.5,
            minWidth: 200,
            borderRadius: 2,
            boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.12)',
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
            {user.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user.email}
          </Typography>
        </Box>
        <Divider />
        <MenuItem
          component={Link}
          href="/notifications"
          onClick={handleClose}
        >
          <ListItemIcon>
            <Badge badgeContent={unreadCount} color="error">
              <NotificationsIcon fontSize="small" />
            </Badge>
          </ListItemIcon>
          <ListItemText>
            Notifications
            {unreadCount > 0 && (
              <Typography variant="caption" color="error" sx={{ ml: 1 }}>
                ({unreadCount})
              </Typography>
            )}
          </ListItemText>
        </MenuItem>
        <MenuItem
          component={Link}
          href="/profile"
          onClick={handleClose}
        >
          <ListItemIcon>
            <ProfileIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Profile</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleSignOut} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" sx={{ color: 'error.main' }} />
          </ListItemIcon>
          <ListItemText>Sign Out</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
}
