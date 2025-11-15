/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Uncomment and update if deploying to a subdirectory
  // basePath: process.env.NODE_ENV === 'production' ? '/swifto-trip-pay-calculator' : '',
  // assetPrefix: process.env.NODE_ENV === 'production' ? '/swifto-trip-pay-calculator' : '',
}

module.exports = nextConfig
