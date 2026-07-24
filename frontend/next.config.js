/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
      {
        source: '/socket.io',
        destination: 'http://localhost:3001/socket.io/',
      },
      {
        source: '/socket.io/',
        destination: 'http://localhost:3001/socket.io/',
      },
      {
        source: '/socket.io/:path*',
        destination: 'http://localhost:3001/socket.io/:path*',
      },
      {
        source: '/uploads/:path*',
        destination: 'http://localhost:3001/uploads/:path*',
      },
      {
        source: '/public/:path*',
        destination: 'http://localhost:3001/public/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
