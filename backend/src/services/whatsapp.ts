import { Client, LocalAuth, Message } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

// Check if running in Vercel serverless environment
const isServerless = process.env.VERCEL === '1';

// Create a session directory if it doesn't exist and not in serverless
const SESSION_DIR = path.resolve(__dirname, '../../.wwebjs_auth');
if (!isServerless && !fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

// WhatsApp client events
export interface WhatsAppEvents {
  ready: void;
  qr: string;
  authenticated: void;
  auth_failure: string;
  message: Message;
  disconnected: string;
}

// Message template for order status updates
export interface OrderStatusTemplate {
  orderId: string;
  customerName: string;
  orderStatus: string;
  estimatedDelivery?: string;
  trackingNumber?: string;
  additionalNote?: string;
}

// Update the message queue interface
interface WhatsAppMessage {
  phone: string;
  message: string;
  timestamp?: Date;
}

class WhatsAppService extends EventEmitter {
  private client: Client | null = null;
  private isReady = false;
  private messageQueue: WhatsAppMessage[] = [];
  private processingQueue = false;
  private lastMessageTime = 0;
  private readonly rateLimitMs = 3000; // 3 seconds between messages to avoid spam detection
  private isServerless = isServerless;
  
  constructor() {
    super();
    if (!this.isServerless) {
      this.setupClient();
    } else {
      console.log('Running in serverless environment, WhatsApp Web client disabled');
    }
  }

  private setupClient() {
    if (this.isServerless) {
      console.log('Cannot setup WhatsApp client in serverless environment');
      return;
    }
    
    try {
      this.client = new Client({
        authStrategy: new LocalAuth({ dataPath: SESSION_DIR }),
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
        qrcode.generate(qr, { small: true });
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

    } catch (error) {
      console.error('Error setting up WhatsApp client:', error);
    }
  }

  public async initialize() {
    if (this.isServerless) {
      console.log('Cannot initialize WhatsApp client in serverless environment');
      return;
    }
    
    if (!this.client) {
      this.setupClient();
    }
    
    try {
      await this.client?.initialize();
    } catch (error) {
      console.error('Error initializing WhatsApp client:', error);
      throw error;
    }
  }

  public getStatus() {
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

  public async sendMessage(phone: string, message: string): Promise<void> {
    try {
      if (this.isReady && this.client) {
        // Format the phone number to ensure it's valid for WhatsApp
        const formattedPhone = this.formatPhoneNumber(phone);
        
        // Queue the message
        this.messageQueue.push({
          phone: formattedPhone,
          message,
          timestamp: new Date()
        });
        
        console.log(`Message to ${formattedPhone} added to queue`);
        
        // Start processing the queue if it's not already being processed
        if (!this.processingQueue) {
          this.processMessageQueue();
        }
      } else {
        throw new Error('WhatsApp client is not ready');
      }
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      throw new Error('Failed to send WhatsApp message');
    }
  }
  
  async sendConfirmationMessage(phone: string, orderId: number): Promise<void> {
    try {
      if (this.isReady && this.client) {
        // Format the phone number
        const formattedPhone = this.formatPhoneNumber(phone);
        
        // Use confirmation message template
        const confirmationTemplate = this.getConfirmationTemplate(orderId);
        
        // Queue the message
        this.messageQueue.push({
          phone: formattedPhone,
          message: confirmationTemplate,
          timestamp: new Date()
        });
        
        console.log(`Confirmation message to ${formattedPhone} added to queue`);
        
        // Start processing the queue if it's not already being processed
        if (!this.processingQueue) {
          this.processMessageQueue();
        }
      } else {
        throw new Error('WhatsApp client is not ready');
      }
    } catch (error) {
      console.error('Error sending confirmation message:', error);
      throw new Error('Failed to send confirmation message');
    }
  }
  
  // Create a confirmation message template
  private getConfirmationTemplate(orderId: number): string {
    return `Thank you for your order! We have received your order #${orderId} and it is being processed. We will update you once your order is ready to ship. If you have any questions, please let us know.`;
  }
  
  // Format phone number for WhatsApp
  private formatPhoneNumber(phone: string): string {
    // Remove any non-numeric characters
    let formatted = phone.replace(/\D/g, '');
    
    // Ensure it starts with country code (e.g., 20 for Egypt)
    if (!formatted.startsWith('20') && formatted.startsWith('0')) {
      formatted = '20' + formatted.substring(1);
    } else if (!formatted.startsWith('20') && !formatted.startsWith('0')) {
      formatted = '20' + formatted;
    }
    
    // Add WhatsApp suffix if needed
    if (!formatted.includes('@c.us')) {
      formatted = `${formatted}@c.us`;
    }
    
    return formatted;
  }
  
  // Generate direct WhatsApp link (works for both web and business app)
  generateWhatsAppLink(phone: string, message: string = ''): string {
    // Format phone by removing non-numeric characters
    const formattedPhone = phone.replace(/\D/g, '');
    // Encode message for URL
    const encodedMessage = encodeURIComponent(message);
    // Create WhatsApp link
    return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
  }

  private async processMessageQueue() {
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
        
        const { phone, message } = this.messageQueue.shift() as WhatsAppMessage;
        
        try {
          const response = await this.client?.sendMessage(phone, message);
          console.log(`Message sent to ${phone}:`, response?.id ? 'Success' : 'No ID returned');
          this.lastMessageTime = Date.now();
        } catch (error) {
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
    } finally {
      this.processingQueue = false;
    }
  }

  public createOrderStatusMessage(template: OrderStatusTemplate): string {
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

  public async disconnect() {
    try {
      await this.client?.destroy();
      this.isReady = false;
      console.log('WhatsApp client disconnected');
    } catch (error) {
      console.error('Error disconnecting WhatsApp client:', error);
    }
  }
}

// Create a singleton instance
const whatsappService = new WhatsAppService();

export default whatsappService; 