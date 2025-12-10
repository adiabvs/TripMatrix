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
  // Production optimizations
  output: 'standalone',
};

module.exports = nextConfig;

