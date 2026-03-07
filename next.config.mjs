/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    '/api/**': ['./src/generated/prisma/**/*'],
  },
};

export default nextConfig;
