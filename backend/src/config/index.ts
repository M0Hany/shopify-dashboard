import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface ShippingConfig {
  apiUrl: string;
  username: string;
  password: string;
}

interface Config {
  port: number;
  shopify: {
    shopUrl: string;
    accessToken: string;
  };
  database: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
  shipping: ShippingConfig;
  allowedOrigins: string[];
}

export function getConfig(): Config {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    shopify: {
      shopUrl: process.env.SHOPIFY_SHOP_URL || '',
      accessToken: process.env.SHOPIFY_ACCESS_TOKEN || '',
    },
    database: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER || '',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || '',
    },
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10), // 100 requests per window
    },
    shipping: {
      apiUrl: process.env.SHIPPING_API_URL || 'https://api.mylerz.net',
      username: process.env.SHIPPING_USERNAME || '',
      password: process.env.SHIPPING_PASSWORD || '',
    },
    allowedOrigins: [
      'https://m0hany.github.io',
      'http://localhost:5173',
      'https://shopify-dashboard-frontend.vercel.app',
      '*'
    ]
  };
}

// Also export the config object directly for modules that prefer to import it
export const config = getConfig(); 