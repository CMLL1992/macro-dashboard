/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile packages outside app/ and lib/ for Next.js
  transpilePackages: ['packages'],
  // Headers to prevent caching
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          },
        ],
      },
    ]
  },
  // Disable static page generation for dynamic routes to avoid build errors
  output: 'standalone',
  typescript: {
    // Don't fail build on type errors during build (they're checked separately)
    ignoreBuildErrors: false,
  },
}

export default nextConfig
