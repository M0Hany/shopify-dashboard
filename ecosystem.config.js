module.exports = {
  apps: [
    {
      name: 'backend',
      script: 'backend/dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        SUPABASE_URL: 'your-supabase-url',
        SUPABASE_KEY: 'your-supabase-key',
        SHOPIFY_API_KEY: 'your-shopify-api-key',
        SHOPIFY_API_SECRET: 'your-shopify-api-secret',
        SHOPIFY_SHOP_NAME: 'your-shop-name',
        SHOPIFY_SHOP_DOMAIN: 'your-shop-domain',
        SHOPIFY_SHOP_URL: 'your-shop-url',
        SHOPIFY_ACCESS_TOKEN: 'your-access-token',
        SHIPPING_USERNAME: 'your-shipping-username',
        SHIPPING_PASSWORD: 'your-shipping-password',
        SHIPPING_API_URL: 'your-shipping-api-url',
        SHIPPING_MERCHANT_ID: 'your-merchant-id',
        SHIPPING_MEMBER_ID: 'your-member-id',
        SHIPPING_WAREHOUSE_NAME: 'your-warehouse-name',
        WHATSAPP_BUSINESS_ACCOUNT_ID: 'your-whatsapp-business-id',
        WHATSAPP_PHONE_NUMBER_ID: 'your-whatsapp-phone-id',
        WHATSAPP_ACCESS_TOKEN: 'your-whatsapp-token',
        WHATSAPP_VERIFY_TOKEN: 'your-whatsapp-verify-token'
      }
    },
    {
      name: 'frontend',
      script: 'frontend/node_modules/vite/bin/vite.js',
      args: 'preview --port 5173 --host',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
        VITE_API_BASE_URL: 'http://165.22.25.137:3000/api',
        VITE_API_URL: 'http://165.22.25.137:3000',
        VITE_SHOPIFY_STORE_URL: 'your-store-url',
        VITE_SHOPIFY_API_KEY: 'your-api-key'
      }
    }
  ]
}; 