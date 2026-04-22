/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  basePath: '/Mandoobi',
  assetPrefix: '/Mandoobi',
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig;
