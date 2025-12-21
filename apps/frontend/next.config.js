/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
            value: "frame-ancestors 'self' https://www.canva.com https://canva.com; frame-src 'self' https://www.canva.com https://canva.com https://*.canva.com https://*.canva.tech; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.canva.com https://*.canva.com;",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

