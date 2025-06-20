import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  typescript: {
    tsconfigPath: './tsconfig.json',
  },
  eslint: {
    dirs: ['src'],
  },
  // Turbo disabled to prevent build manifest issues
  // turbopack: {
  //   rules: {
  //     '*.svg': {
  //       loaders: ['@svgr/webpack'],
  //       as: '*.js',
  //     },
  //   },
  // },
  images: {
    formats: ['image/webp', 'image/avif'],
  },
  // Optimize for Vercel deployment
  output: 'standalone',
}

export default nextConfig 