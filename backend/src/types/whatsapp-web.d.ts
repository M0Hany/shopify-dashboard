declare module 'whatsapp-web.js' {
  import { EventEmitter } from 'events';

  export class Client extends EventEmitter {
    constructor(options?: any);
    initialize(): Promise<void>;
    destroy(): Promise<void>;
    sendMessage(chatId: string, content: string): Promise<Message>;
  }

  export class Message {
    id: string;
    body: string;
    from: string;
    to: string;
    hasMedia: boolean;
    timestamp: number;
    fromMe: boolean;
  }

  export class LocalAuth {
    constructor(options?: { dataPath?: string });
  }
} 