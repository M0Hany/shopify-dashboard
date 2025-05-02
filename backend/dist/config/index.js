"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = getConfig;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load environment variables from .env file
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
function getConfig() {
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
