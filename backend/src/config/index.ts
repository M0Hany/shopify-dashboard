import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface Config {
  port: number;
  shopify: {
    apiKey: string;
    apiSecret: string;
    storeUrl: string;
  };
  auth0: {
    domain: string;
    audience: string;
  };
  allowedOrigins: string[];
  rateLimit: {
    windowMs: number;
    max: number;
  };
}

export function getConfig(): Config {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    shopify: {
      apiKey: process.env.SHOPIFY_API_KEY || '',
      apiSecret: process.env.SHOPIFY_API_SECRET || '',
      storeUrl: process.env.SHOPIFY_STORE_URL || '',
    },
    auth0: {
      domain: process.env.AUTH0_DOMAIN || 'dev-xxxxx.auth0.com',
      audience: process.env.AUTH0_AUDIENCE || 'https://api.example.com',
    },
    allowedOrigins: [
      'https://m0hany.github.io',
      'http://localhost:5173',
      'https://shopify-dashboard-frontend.vercel.app',
      '*'
    ],
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10), // 100 requests per window
    }
  };
} 