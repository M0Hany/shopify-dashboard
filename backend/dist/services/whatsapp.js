"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const whatsapp_web_js_1 = require("whatsapp-web.js");
const qrcode_terminal_1 = __importDefault(require("qrcode-terminal"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const events_1 = require("events");
// Check if running in Vercel serverless environment
const isServerless = process.env.VERCEL === '1';
// Create a session directory if it doesn't exist and not in serverless
const SESSION_DIR = path_1.default.resolve(__dirname, '../../.wwebjs_auth');
if (!isServerless && !fs_1.default.existsSync(SESSION_DIR)) {
    fs_1.default.mkdirSync(SESSION_DIR, { recursive: true });
}
class WhatsAppService extends events_1.EventEmitter {
    constructor() {
        super();
        this.client = null;
        this.isReady = false;
        this.messageQueue = [];
        this.processingQueue = false;
        this.lastMessageTime = 0;
        this.rateLimitMs = 3000; // 3 seconds between messages to avoid spam detection
        this.isServerless = isServerless;
        if (!this.isServerless) {
            this.setupClient();
        }
        else {
            console.log('Running in serverless environment, WhatsApp Web client disabled');
        }
    }
    setupClient() {
        if (this.isServerless) {
            console.log('Cannot setup WhatsApp client in serverless environment');
            return;
        }
        try {
            this.client = new whatsapp_web_js_1.Client({
                authStrategy: new whatsapp_web_js_1.LocalAuth({ dataPath: SESSION_DIR }),
                puppeteer: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--disable-gpu'
                    ]
                }
            });
            // Register event handlers
            this.client.on('qr', (qr) => {
                console.log('QR Code received:');
                qrcode_terminal_1.default.generate(qr, { small: true });
                this.emit('qr', qr);
            });
            this.client.on('ready', () => {
                console.log('WhatsApp client is ready');
                this.isReady = true;
                this.emit('ready');
                // Process any queued messages
                if (this.messageQueue.length > 0) {
                    this.processMessageQueue();
                }
            });
            this.client.on('authenticated', () => {
                console.log('WhatsApp client authenticated');
                this.emit('authenticated');
            });
            this.client.on('auth_failure', (msg) => {
                console.error('WhatsApp authentication failed:', msg);
                this.isReady = false;
                this.emit('auth_failure', msg);
            });
            this.client.on('disconnected', (reason) => {
                console.log('WhatsApp client disconnected:', reason);
                this.isReady = false;
                this.emit('disconnected', reason);
                // Try to reinitialize the client after disconnect
                setTimeout(() => {
                    this.setupClient();
                    this.initialize();
                }, 5000);
            });
            this.client.on('message', (message) => {
                console.log('Message received:', message.body);
                this.emit('message', message);
            });
        }
        catch (error) {
            console.error('Error setting up WhatsApp client:', error);
        }
    }
    async initialize() {
        if (this.isServerless) {
            console.log('Cannot initialize WhatsApp client in serverless environment');
            return;
        }
        if (!this.client) {
            this.setupClient();
        }
        try {
            await this.client?.initialize();
        }
        catch (error) {
            console.error('Error initializing WhatsApp client:', error);
            throw error;
        }
    }
    getStatus() {
        if (this.isServerless) {
            return {
                isReady: false,
                queueLength: 0,
                isProcessingQueue: false,
                isServerless: true
            };
        }
        return {
            isReady: this.isReady,
            queueLength: this.messageQueue.length,
            isProcessingQueue: this.processingQueue,
            isServerless: false
        };
    }
    async sendMessage(phoneNumber, message) {
        if (this.isServerless) {
            console.log('WhatsApp messaging not available in serverless environment');
            return false;
        }
        // Format phone number (remove any special chars and ensure it has country code)
        const formattedNumber = this.formatPhoneNumber(phoneNumber);
        if (!formattedNumber) {
            console.error('Invalid phone number format:', phoneNumber);
            return false;
        }
        // If client is ready, send message or queue it
        if (this.isReady && this.client) {
            this.messageQueue.push({ phone: formattedNumber, message });
            if (!this.processingQueue) {
                this.processMessageQueue();
            }
            return true;
        }
        else {
            // Queue message for when client becomes ready
            this.messageQueue.push({ phone: formattedNumber, message });
            console.log(`Client not ready. Message queued (${this.messageQueue.length} messages in queue)`);
            return false;
        }
    }
    formatPhoneNumber(phone) {
        // Remove any non-digits
        let cleaned = phone.replace(/\D/g, '');
        // Ensure it starts with country code (assuming Egypt is default - 20)
        if (cleaned.startsWith('0')) {
            cleaned = '2' + cleaned;
        }
        else if (!cleaned.startsWith('2') && !cleaned.startsWith('1')) {
            cleaned = '20' + cleaned;
        }
        // Add WhatsApp format with @ (phone number@c.us)
        return `${cleaned}@c.us`;
    }
    async processMessageQueue() {
        if (this.messageQueue.length === 0 || !this.isReady || this.processingQueue) {
            return;
        }
        this.processingQueue = true;
        try {
            while (this.messageQueue.length > 0 && this.isReady) {
                const now = Date.now();
                const timeSinceLastMessage = now - this.lastMessageTime;
                // Apply rate limiting
                if (timeSinceLastMessage < this.rateLimitMs) {
                    await new Promise(resolve => setTimeout(resolve, this.rateLimitMs - timeSinceLastMessage));
                }
                const { phone, message } = this.messageQueue.shift();
                try {
                    const response = await this.client?.sendMessage(phone, message);
                    console.log(`Message sent to ${phone}:`, response?.id ? 'Success' : 'No ID returned');
                    this.lastMessageTime = Date.now();
                }
                catch (error) {
                    console.error(`Failed to send message to ${phone}:`, error);
                    // Re-queue message for one more attempt if it failed
                    // Don't re-queue if something is fundamentally wrong with the number or message
                    if (error instanceof Error && !error.message.includes('invalid chat')) {
                        this.messageQueue.push({ phone, message });
                    }
                }
                // Wait before sending next message to avoid triggering spam detection
                await new Promise(resolve => setTimeout(resolve, this.rateLimitMs));
            }
        }
        finally {
            this.processingQueue = false;
        }
    }
    createOrderStatusMessage(template) {
        const { orderId, customerName, orderStatus, estimatedDelivery, trackingNumber, additionalNote } = template;
        let message = `Hello ${customerName},\n\n`;
        message += `Your order #${orderId} has been updated to: *${orderStatus}*\n\n`;
        if (estimatedDelivery) {
            message += `Estimated delivery: ${estimatedDelivery}\n`;
        }
        if (trackingNumber) {
            message += `Tracking number: ${trackingNumber}\n`;
        }
        if (additionalNote) {
            message += `\nNote: ${additionalNote}\n`;
        }
        message += '\nThank you for shopping with OCD Crochet!';
        return message;
    }
    async disconnect() {
        try {
            await this.client?.destroy();
            this.isReady = false;
            console.log('WhatsApp client disconnected');
        }
        catch (error) {
            console.error('Error disconnecting WhatsApp client:', error);
        }
    }
}
// Create a singleton instance
const whatsappService = new WhatsAppService();
exports.default = whatsappService;
