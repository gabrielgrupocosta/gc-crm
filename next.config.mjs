/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const defaultBackendUrl = process.env.NODE_ENV === 'production'
      ? 'https://gc-crm.onrender.com'
      : 'http://localhost:3333';
    const backendUrl = (process.env.BACKEND_URL || defaultBackendUrl).replace(/\/$/, '');

    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
}

export default nextConfig
