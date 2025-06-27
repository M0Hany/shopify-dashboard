import { defineConfig } from 'vite' 
import react from '@vitejs/plugin-react' 
 
// https://vitejs.dev/config/ 
export default defineConfig({ 
  plugins: [react()], 
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
  define: { 
    'process.env.VITE_API_URL': JSON.stringify(process.env.NODE_ENV === 'production' 
      ? 'https://ocdcrochet.store'
      : 'https://localhost:3000')
  } 
}) 
