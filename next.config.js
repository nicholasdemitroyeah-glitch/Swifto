/** @type {import('next').NextConfig} */
const computedBasePath = process.env.NODE_ENV === 'production' ? '/Swifto' : '';

const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  images: {
    unoptimized: true,
  },
  basePath: computedBasePath,
  assetPrefix: computedBasePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: computedBasePath,
  },
};

module.exports = nextConfig;
