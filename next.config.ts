/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow large PDF uploads (up to 200MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '200mb',
    },
  },
};

export default nextConfig;
