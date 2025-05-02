"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load environment variables from .env file
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
// Log missing environment variables as warnings instead of throwing errors
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
        console.warn(`Warning: Missing environment variable: ${envVar}`);
    }
}
const config = {
    server: {
        port: parseInt(process.env.PORT || '3000', 10),
        nodeEnv: process.env.NODE_ENV || 'development',
        corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    },
    shopify: {
        apiKey: process.env.SHOPIFY_API_KEY || 'd9191b0855b804907e440a31ede7c14b',
        apiSecret: process.env.SHOPIFY_API_SECRET || '8388e14f03f2bbeb46ba3e3b7ab212c1',
        storeUrl: process.env.SHOPIFY_SHOP_NAME ? `${process.env.SHOPIFY_SHOP_NAME}.myshopify.com` : '1v0hmz-9f.myshopify.com',
        accessToken: process.env.SHOPIFY_ACCESS_TOKEN || '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',
    },
};
exports.default = config;
