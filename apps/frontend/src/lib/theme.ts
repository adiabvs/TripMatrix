'use client';

import { createTheme } from '@mui/material/styles';

// Material Design 3 theme configuration
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#6750A4', // M3 Primary Purple
      light: '#EADDFF',
      dark: '#21005D',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#625B71',
      light: '#E8DEF8',
      dark: '#1D192B',
      contrastText: '#FFFFFF',
    },
    error: {
      main: '#BA1A1A',
      light: '#FFDAD6',
      dark: '#410002',
      contrastText: '#FFFFFF',
    },
    warning: {
      main: '#7D5260',
      light: '#FFDAD6',
      dark: '#31111D',
      contrastText: '#FFFFFF',
    },
    info: {
      main: '#006874',
      light: '#B2EBF2',
      dark: '#001F24',
      contrastText: '#FFFFFF',
    },
    success: {
      main: '#006C4C',
      light: '#B2F5EA',
      dark: '#002114',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#FFFBFE',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1C1B1F',
      secondary: '#49454F',
    },
  },
  typography: {
    fontFamily: [
      'Roboto',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: {
      fontSize: '2rem',
      fontWeight: 400,
      lineHeight: 1.2,
      letterSpacing: 0,
      '@media (max-width:600px)': {
        fontSize: '1.5rem',
      },
    },
    h2: {
      fontSize: '1.75rem',
      fontWeight: 400,
      lineHeight: 1.25,
      letterSpacing: 0,
      '@media (max-width:600px)': {
        fontSize: '1.375rem',
      },
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 400,
      lineHeight: 1.3,
      letterSpacing: 0,
      '@media (max-width:600px)': {
        fontSize: '1.25rem',
      },
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 400,
      lineHeight: 1.35,
      letterSpacing: 0,
      '@media (max-width:600px)': {
        fontSize: '1.125rem',
      },
    },
    h5: {
      fontSize: '1.125rem',
      fontWeight: 400,
      lineHeight: 1.4,
      letterSpacing: 0,
      '@media (max-width:600px)': {
        fontSize: '1rem',
      },
    },
    h6: {
      fontSize: '0.9375rem',
      fontWeight: 500,
      lineHeight: 1.5,
      letterSpacing: 0.15,
      '@media (max-width:600px)': {
        fontSize: '0.875rem',
      },
    },
    body1: {
      fontSize: '0.9375rem',
      fontWeight: 400,
      lineHeight: 1.5,
      letterSpacing: 0.15,
      '@media (max-width:600px)': {
        fontSize: '0.875rem',
      },
    },
    body2: {
      fontSize: '0.8125rem',
      fontWeight: 400,
      lineHeight: 1.43,
      letterSpacing: 0.25,
      '@media (max-width:600px)': {
        fontSize: '0.75rem',
      },
    },
    button: {
      fontSize: '0.875rem',
      fontWeight: 500,
      lineHeight: 1.75,
      letterSpacing: 0.1,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          padding: '8px 20px',
          textTransform: 'none',
          fontWeight: 500,
          boxShadow: 'none',
          fontSize: '0.875rem',
          '@media (max-width:600px)': {
            padding: '6px 16px',
            fontSize: '0.8125rem',
          },
          '&:hover': {
            boxShadow: 'none',
          },
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.12), 0px 1px 2px rgba(0, 0, 0, 0.24)',
          },
        },
        outlined: {
          borderWidth: 1,
          '&:hover': {
            borderWidth: 1,
          },
        },
        sizeLarge: {
          padding: '10px 24px',
          fontSize: '0.9375rem',
          '@media (max-width:600px)': {
            padding: '8px 20px',
            fontSize: '0.875rem',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.12), 0px 1px 2px rgba(0, 0, 0, 0.24)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          minHeight: '64px !important',
          '@media (max-width:600px)': {
            minHeight: '56px !important',
            paddingLeft: '12px !important',
            paddingRight: '12px !important',
          },
        },
      },
    },
    MuiContainer: {
      styleOverrides: {
        root: {
          '@media (max-width:600px)': {
            paddingLeft: '16px',
            paddingRight: '16px',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            fontSize: '0.9375rem',
            '@media (max-width:600px)': {
              fontSize: '16px', // Prevents zoom on iOS
            },
            '& fieldset': {
              borderColor: 'rgba(0, 0, 0, 0.12)',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(0, 0, 0, 0.23)',
            },
            '&.Mui-focused fieldset': {
              borderWidth: '1px',
            },
          },
          '& .MuiInputLabel-root': {
            fontSize: '0.9375rem',
            '@media (max-width:600px)': {
              fontSize: '16px', // Prevents zoom on iOS
            },
          },
          '& .MuiInputBase-input': {
            padding: '14px 16px',
            '@media (max-width:600px)': {
              padding: '12px 14px',
            },
          },
        },
      },
    },
  },
});

