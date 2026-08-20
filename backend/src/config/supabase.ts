import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

function createSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials. Please check your environment variables.');
  }

  return createClient(supabaseUrl, supabaseKey);
}

/** Lazy client — avoids crashing serverless cold start when env is loaded after import. */
export function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createSupabaseClient();
  }
  return supabaseClient;
}

/** @deprecated Prefer getSupabase() — lazy proxy for existing imports. */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getSupabase() as unknown as object, prop, receiver);
  },
});

// Type definitions for our tables
export type Database = {
  expenses: {
    Row: {
      id: string;
      title: string;
      amount: number;
      date: string;
      category: string;
      paidBy: string;
      shared: boolean;
      recurring: boolean;
      note?: string;
      settled: boolean;
      settledAt?: string;
      settledMohamed: boolean;
      settledMariam: boolean;
    };
  };
  settlements: {
    Row: {
      id: string;
      partner: string;
      amount: number;
      date: string;
      relatedExpenses: string[];
      note?: string;
    };
  };
  partner_balances: {
    Row: {
      partner: string;
      owedAmount: number;
      settledAmount: number;
      lastSettlement?: string;
    };
  };
  whatsapp_messages: {
    Row: {
      id: string;
      message_id: string;
      phone: string;
      from: string;
      to: string;
      type: 'text' | 'template' | 'button' | 'image' | 'document' | 'audio' | 'video';
      text?: { body: string };
      timestamp: string;
      status: 'sent' | 'delivered' | 'read' | 'failed';
      direction: 'inbound' | 'outbound';
      order_number?: string;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      message_id: string;
      phone: string;
      from: string;
      to: string;
      type: 'text' | 'template' | 'button' | 'image' | 'document' | 'audio' | 'video';
      text?: { body: string };
      timestamp: string;
      status?: 'sent' | 'delivered' | 'read' | 'failed';
      direction: 'inbound' | 'outbound';
      order_number?: string;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      message_id?: string;
      phone?: string;
      from?: string;
      to?: string;
      type?: 'text' | 'template' | 'button' | 'image' | 'document' | 'audio' | 'video';
      text?: { body: string };
      timestamp?: string;
      status?: 'sent' | 'delivered' | 'read' | 'failed';
      direction?: 'inbound' | 'outbound';
      order_number?: string;
      created_at?: string;
      updated_at?: string;
    };
  };
}; 