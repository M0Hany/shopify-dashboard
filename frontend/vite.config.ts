import { defineConfig } from 'vite' 
import react from '@vitejs/plugin-react' 
 
// https://vitejs.dev/config/ 
export default defineConfig({ 
  plugins: [react()], 
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  preview: {
    port: 5173,
    strictPort: true,
    host: true
  },
  define: { 
    'process.env.VITE_API_URL': JSON.stringify(process.env.NODE_ENV === 'production' 
      ? 'http://165.22.25.137:3000'
      : 'http://localhost:3000')
  } 
}) 
