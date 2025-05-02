import { defineConfig } from 'vite' 
import react from '@vitejs/plugin-react' 
 
// https://vitejs.dev/config/ 
export default defineConfig({ 
  plugins: [react()], 
  base: process.env.NODE_ENV === 'production' ? '/shopify-dashboard/' : '/', 
  define: { 
    'process.env.VITE_API_URL': process.env.NODE_ENV === 'production' 
      ? JSON.stringify('https://backend-7d9i3vd1i-medohany68-gmailcoms-projects.vercel.app')
      : JSON.stringify('http://localhost:3000')
  } 
}) 
