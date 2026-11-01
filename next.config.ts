import type { NextConfig } from "next";
import { courseCoverRemotePatterns } from './src/lib/images/course-cover'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: courseCoverRemotePatterns(),
    // Covers use new UUID filenames when replaced, so old variants can remain
    // cached without showing an outdated image after an administrator edits it.
    minimumCacheTTL: 60 * 60 * 24 * 7,
    maximumRedirects: 0,
  },
  experimental: {
    serverActions: {
      // Receipt validation allows a 10 MiB image. Leave room for multipart
      // boundaries and Server Action metadata around that file.
      bodySizeLimit: '12mb',
    },
  },
  async headers() {
    return [
      {
        source: '/course-covers/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
};

export default nextConfig;
