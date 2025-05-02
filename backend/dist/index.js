"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const orders_1 = __importDefault(require("./routes/orders"));
const whatsapp_1 = __importDefault(require("./routes/whatsapp"));
const errorHandler_1 = require("./middleware/errorHandler");
const config_1 = require("./config");
// Load environment variables
dotenv_1.default.config();
const config = (0, config_1.getConfig)();
const app = (0, express_1.default)();
// CORS configuration
app.use((0, cors_1.default)({
    origin: config.allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: false // Set to false since we're not using cookies
}));
app.use((0, helmet_1.default)());
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json());
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
});
app.use(limiter);
// Routes
app.use('/api/orders', orders_1.default);
app.use('/api/whatsapp', whatsapp_1.default);
// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ message: 'CORS test successful' });
});
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});
// Error handling
app.use(errorHandler_1.errorHandler);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
