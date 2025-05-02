import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface ServerConfig {
  port: number;
  nodeEnv: string;
  corsOrigin: string;
}

interface ShopifyConfig {
  apiKey: string;
  apiSecret: string;
  storeUrl: string;
}

interface Config {
  server: ServerConfig;
  shopify: ShopifyConfig;
}

// Validate required environment variables
const requiredEnvVars = [
  'PORT',
  'NODE_ENV',
  'SHOPIFY_API_KEY',
  'SHOPIFY_API_SECRET',
  'SHOPIFY_SHOP_NAME',
  'SHOPIFY_ACCESS_TOKEN'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

const config: Config = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },
  shopify: {
    apiKey: process.env.SHOPIFY_API_KEY || '',
    apiSecret: process.env.SHOPIFY_API_SECRET || '',
    storeUrl: `${process.env.SHOPIFY_SHOP_NAME}.myshopify.com`,
  },
};

export default config; 