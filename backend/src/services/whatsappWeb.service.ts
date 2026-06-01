import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import pino from 'pino';
import { isWhatsAppWebEnabled } from '../config/whatsappConfig';
import { logger } from '../utils/logger';
import { formatPhoneNumber, phoneToWhatsAppJid } from '../utils/formatPhoneNumber';

export type WhatsAppWebConnectionStatus =
  | 'disabled'
  | 'connecting'
  | 'qr'
  | 'connected'
  | 'disconnected';

class WhatsAppWebService {
  private socket: WASocket | null = null;
  private status: WhatsAppWebConnectionStatus = 'disabled';
  private latestQr: string | null = null;
  private latestQrDataUrl: string | null = null;
  private connectedPhone: string | null = null;
  private connectPromise: Promise<void> | null = null;
  private isStarting = false;

  isEnabled(): boolean {
    return isWhatsAppWebEnabled();
  }

  getAuthDir(): string {
    return path.resolve(
      process.cwd(),
      process.env.WHATSAPP_WEB_AUTH_DIR || 'data/whatsapp-web-auth'
    );
  }

  getStatus(): {
    enabled: boolean;
    status: WhatsAppWebConnectionStatus;
    connectedPhone: string | null;
    hasQr: boolean;
  } {
    return {
      enabled: this.isEnabled(),
      status: this.isEnabled() ? this.status : 'disabled',
      connectedPhone: this.connectedPhone,
      hasQr: !!this.latestQrDataUrl
    };
  }

  /** Start connection if enabled but not yet running (e.g. after env was added without restart). */
  ensureStarted(): void {
    if (!this.isEnabled()) return;
    if (this.status === 'connected' || this.connectPromise) return;
    void this.start();
  }

  async getQrDataUrl(): Promise<string | null> {
    return this.latestQrDataUrl;
  }

  async start(): Promise<void> {
    if (!this.isEnabled()) {
      this.status = 'disabled';
      return;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = this.runConnectionLoop();
    return this.connectPromise;
  }

  private async runConnectionLoop(): Promise<void> {
    if (this.isStarting) return;
    this.isStarting = true;

    while (this.isEnabled()) {
      try {
        await this.openSocket();
        break;
      } catch (error) {
        logger.error('WhatsApp Web connection failed, retrying in 5s', {
          error: error instanceof Error ? error.message : error
        });
        this.status = 'disconnected';
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    this.isStarting = false;
    this.connectPromise = null;
  }

  private async openSocket(): Promise<void> {
    const authDir = this.getAuthDir();
    fs.mkdirSync(authDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    this.status = 'connecting';
    this.latestQr = null;
    this.latestQrDataUrl = null;

    const sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: process.env.NODE_ENV !== 'production',
      syncFullHistory: false,
      markOnlineOnConnect: false
    });

    this.socket = sock;

    sock.ev.on('creds.update', saveCreds);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WhatsApp Web connection timed out waiting for open/qr'));
      }, 120_000);

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.status = 'qr';
          this.latestQr = qr;
          try {
            this.latestQrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 280 });
          } catch (err) {
            logger.error('Failed to generate QR data URL', { err });
          }
          logger.info('WhatsApp Web: scan QR code (dashboard → WhatsApp → Link account)');
        }

        if (connection === 'open') {
          clearTimeout(timeout);
          this.status = 'connected';
          this.latestQr = null;
          this.latestQrDataUrl = null;
          const me = sock.user;
          this.connectedPhone = me?.id?.split(':')[0] || me?.id || null;
          logger.info('WhatsApp Web connected', { phone: this.connectedPhone });
          resolve();
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
          const loggedOut = statusCode === DisconnectReason.loggedOut;

          this.status = loggedOut ? 'disconnected' : 'connecting';
          this.socket = null;
          this.connectedPhone = null;

          if (!loggedOut && this.isEnabled()) {
            clearTimeout(timeout);
            logger.warn('WhatsApp Web disconnected, reconnecting…', { statusCode });
            setTimeout(() => {
              void this.runConnectionLoop();
            }, 3000);
            resolve();
            return;
          }

          clearTimeout(timeout);
          reject(lastDisconnect?.error || new Error('WhatsApp Web connection closed'));
        }
      });
    });
  }

  private ensureReady(): WASocket {
    if (!this.isEnabled()) {
      throw new Error('WhatsApp Web is disabled (set WHATSAPP_WEB_ENABLED=true)');
    }
    if (this.status !== 'connected' || !this.socket) {
      throw new Error(
        'WhatsApp Web is not connected. Open WhatsApp → Link account and scan the QR code.'
      );
    }
    return this.socket;
  }

  async sendTextMessage(
    phone: string,
    message: string,
    orderNumber?: string
  ): Promise<string> {
    const sock = this.ensureReady();
    const jid = phoneToWhatsAppJid(phone);
    const formattedPhone = formatPhoneNumber(phone);

    logger.info('Sending WhatsApp Web text message', {
      phone: formattedPhone,
      orderNumber,
      preview: message.substring(0, 80)
    });

    const result = await sock.sendMessage(jid, { text: message });
    const messageId = result?.key?.id || `web-${Date.now()}`;

    logger.info('WhatsApp Web message sent', {
      phone: formattedPhone,
      messageId,
      orderNumber
    });

    return messageId;
  }

  async logout(): Promise<void> {
    if (this.socket) {
      try {
        await this.socket.logout();
      } catch (error) {
        logger.warn('WhatsApp Web logout error', { error });
      }
    }

    this.socket = null;
    this.status = 'disconnected';
    this.connectedPhone = null;
    this.latestQr = null;
    this.latestQrDataUrl = null;

    const authDir = this.getAuthDir();
    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true, force: true });
    }

    if (this.isEnabled()) {
      void this.runConnectionLoop();
    }
  }
}

export const whatsappWebService = new WhatsAppWebService();
