import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/shopify-dashboard/' : '/',
  define: {
    'process.env.VITE_API_URL': JSON.stringify('https://backend-5gdom4js0-medohany68-gmailcoms-projects.vercel.app')
  }
})
