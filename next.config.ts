import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    // Empty config to silence the warning
    // Turbopack handles most of these externals automatically
  },
  typescript: {
    ignoreBuildErrors: false,
  },
}

export default nextConfig
