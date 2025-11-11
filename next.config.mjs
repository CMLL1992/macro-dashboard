/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  // Exclude apps/web from build (incomplete monorepo structure)
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Asegurar que better-sqlite3 solo se use en el servidor
      config.externals = config.externals || [];
      config.externals.push('better-sqlite3');
    }
    // Exclude apps/web from compilation
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    return config;
  },
  env: {
    // Expose test flags to client (safe, no secrets)
    NEXT_PUBLIC_ENABLE_TELEGRAM_TESTS: process.env.ENABLE_TELEGRAM_TESTS || 'false',
    NEXT_PUBLIC_TELEGRAM_TEST_CHAT_ID: process.env.TELEGRAM_TEST_CHAT_ID || '',
    NEXT_PUBLIC_DRY_RUN_TELEGRAM: process.env.DRY_RUN_TELEGRAM || 'false',
    NEXT_PUBLIC_NODE_ENV: process.env.NODE_ENV || 'development',
  },
};

export default nextConfig;


