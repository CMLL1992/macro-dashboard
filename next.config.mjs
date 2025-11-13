/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force dynamic rendering to avoid caching issues
  experimental: {
    // Disable static optimization for better cache control
  },
  // Headers to prevent caching
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
        ],
      },
    ]
  },
}

export default nextConfig
