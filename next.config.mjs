/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  webpack: (config) => {
    // Copia el worker de pdf.js al output del bundle para que
    // `new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url)`
    // pueda resolverse sin depender de ningún CDN externo.
    config.resolve.alias.canvas = false
    return config
  },
  turbopack:{},                         
}

export default nextConfig
