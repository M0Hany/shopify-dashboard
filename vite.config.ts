import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
 
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/shopify-dashboard/' : '/',
  server: {
    port: 5173,
    strictPort: true,
  },
  define: {
    'process.env.VITE_API_URL': JSON.stringify(process.env.NODE_ENV === 'production' 
      ? 'https://backend-731zkkr7k-medohany68-gmailcoms-projects.vercel.app'
      : 'http://localhost:3000')
  }
}) 