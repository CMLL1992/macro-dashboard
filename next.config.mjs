/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable static page generation completely
  output: 'standalone',
  // Headers to prevent all caching
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
    ]
  },
  // Disable static optimization
  experimental: {
    dynamicIO: true,
  },
}

export default nextConfig
