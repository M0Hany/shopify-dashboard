import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const isDockerBuild = process.env.DOCKER_BUILD_LIGHT === 'true';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    // Lower-memory build profile for small servers (e.g. 1GB droplets).
    minify: isDockerBuild ? false : 'esbuild',
    reportCompressedSize: !isDockerBuild,
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    watch: {
      usePolling: true
    },
    proxy: {
      '/api': {
        target: 'https://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  preview: {
    port: 5173,
    strictPort: true,
    host: true,
    allowedHosts: ['ocdcrochet.store', 'www.ocdcrochet.store']
  },
}) 
