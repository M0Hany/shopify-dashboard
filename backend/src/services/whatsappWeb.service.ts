import { canRunWhatsAppWeb, isWhatsAppWebEnabled } from '../config/whatsappConfig';

export type WhatsAppWebConnectionStatus =
  | 'disabled'
  | 'connecting'
  | 'qr'
  | 'connected'
  | 'disconnected';

type WhatsAppWebStatus = {
  enabled: boolean;
  status: WhatsAppWebConnectionStatus;
  connectedPhone: string | null;
  hasQr: boolean;
};

type WhatsAppWebImpl = {
  isEnabled(): boolean;
  getStatus(): WhatsAppWebStatus;
  ensureStarted(): void;
  resetConnection(): void;
  getQrDataUrl(): Promise<string | null>;
  start(): Promise<void>;
  sendTextMessage(phone: string, message: string, orderNumber?: string): Promise<string>;
  logout(): Promise<void>;
};

const disabledStatus: WhatsAppWebStatus = {
  enabled: false,
  status: 'disabled',
  connectedPhone: null,
  hasQr: false,
};

let implInstance: WhatsAppWebImpl | null = null;
let implPromise: Promise<WhatsAppWebImpl | null> | null = null;

async function loadImpl(): Promise<WhatsAppWebImpl | null> {
  if (!canRunWhatsAppWeb()) return null;
  if (implInstance) return implInstance;
  if (!implPromise) {
    implPromise = import('./whatsappWeb.impl')
      .then((m) => {
        implInstance = m.whatsappWebServiceImpl;
        return implInstance;
      })
      .catch(() => null);
  }
  return implPromise;
}

function statusWhenUnavailable(): WhatsAppWebStatus {
  return {
    ...disabledStatus,
    enabled: isWhatsAppWebEnabled(),
  };
}

/** Lazy facade — Baileys (ESM) is only loaded when WhatsApp Web runs outside Vercel. */
export const whatsappWebService = {
  isEnabled(): boolean {
    return isWhatsAppWebEnabled();
  },

  getStatus(): WhatsAppWebStatus {
    if (!canRunWhatsAppWeb()) return statusWhenUnavailable();
    if (implInstance) return implInstance.getStatus();
    return { enabled: true, status: 'disconnected', connectedPhone: null, hasQr: false };
  },

  ensureStarted(): void {
    if (!canRunWhatsAppWeb()) return;
    void loadImpl().then((impl) => impl?.ensureStarted());
  },

  resetConnection(): void {
    if (!canRunWhatsAppWeb()) return;
    void loadImpl().then((impl) => impl?.resetConnection());
  },

  async getQrDataUrl(): Promise<string | null> {
    const impl = await loadImpl();
    return impl ? impl.getQrDataUrl() : null;
  },

  async start(): Promise<void> {
    const impl = await loadImpl();
    if (impl) await impl.start();
  },

  async sendTextMessage(
    phone: string,
    message: string,
    orderNumber?: string
  ): Promise<string> {
    const impl = await loadImpl();
    if (!impl) {
      throw new Error('WhatsApp Web is disabled on this server');
    }
    return impl.sendTextMessage(phone, message, orderNumber);
  },

  async logout(): Promise<void> {
    const impl = await loadImpl();
    if (impl) await impl.logout();
  },

  async getStatusAsync(): Promise<WhatsAppWebStatus> {
    if (!canRunWhatsAppWeb()) return statusWhenUnavailable();
    const impl = await loadImpl();
    return impl ? impl.getStatus() : statusWhenUnavailable();
  },
};
