/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://iqpjpvwfqmykbebtqcpn.supabase.co').replace(/\/$/, '');

    return [
      {
        source: '/api/:path*',
        destination: `${supabaseUrl}/functions/v1/crm-api/:path*`,
      },
    ];
  },
}

export default nextConfig
