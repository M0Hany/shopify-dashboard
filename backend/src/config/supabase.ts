import { createClient } from '@supabase/supabase-js';

// These will be populated from environment variables
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials. Please check your environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

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
}; 