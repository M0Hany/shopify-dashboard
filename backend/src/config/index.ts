import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface ShippingConfig {
  apiUrl: string;
  username: string;
  password: string;
  merchantId: string;
  memberId: string;
}

interface Config {
  port: number;
  nodeEnv: string;
  redis: {
    host: string;
    port: number;
    password: string | null;
    maxRetriesPerRequest: number;
    retryStrategy: (times: number) => number | null;
  };
  shopify: {
    shopName: string;
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
    nodeEnv: process.env.NODE_ENV || 'development',
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || null,
      maxRetriesPerRequest: 1,
      retryStrategy: (times: number) => {
        if (times > 3) {
          return null;
        }
        return Math.min(times * 1000, 3000);
      }
    },
    shopify: {
      shopName: process.env.SHOPIFY_SHOP_NAME || 'default-shop',
      accessToken: process.env.SHOPIFY_ACCESS_TOKEN || 'default-token'
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
      username: process.env.SHIPPING_USERNAME || 'ocd',
      password: process.env.SHIPPING_PASSWORD || 'H@ni2003',
      merchantId: process.env.SHIPPING_MERCHANT_ID || '',
      memberId: process.env.SHIPPING_MEMBER_ID || '',
    },
    allowedOrigins: [
      'https://ocdcrochet.store',
      'https://www.ocdcrochet.store',
      'http://localhost:5173',
      'https://localhost:5173'
    ]
  };
}

// Also export the config object directly for modules that prefer to import it
export const config = getConfig();

export const corsOptions = {
  origin: [
    'https://ocdcrochet.store',
    'https://www.ocdcrochet.store',
    'http://localhost:5173',
    'https://localhost:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}; 