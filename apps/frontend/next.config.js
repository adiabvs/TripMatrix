/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Optimize bundle size
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Enable experimental features for better performance
  experimental: {
    optimizePackageImports: ['@mui/material', '@mui/icons-material'],
  },
  images: {
    domains: [
      'firebasestorage.googleapis.com',
      'lh3.googleusercontent.com',
      'storage.googleapis.com',
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      },
    ],
  },
  // Allow embedding Canva
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self'; frame-src 'self' https://accounts.google.com https://*.firebaseapp.com https://*.firebaseapp.com/*; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://sdk.canva.com https://static.cloudflareinsights.com https://apis.google.com https://www.gstatic.com; connect-src 'self' http://localhost:* http://127.0.0.1:* https://localhost:* https://www.canva.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://accounts.google.com https://*.firebaseapp.com https://*.firebaseio.com https://firestore.googleapis.com https://*.firestore.googleapis.com https://*.up.railway.app https://tripmatrixbackend-production.up.railway.app;",   
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

