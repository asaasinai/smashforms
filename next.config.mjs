/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    '/api/**': ['./src/generated/prisma/*.node', './src/generated/prisma/*.so*'],
  },
};

export default nextConfig;
