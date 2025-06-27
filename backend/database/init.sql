-- Drop existing tables if they exist
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS settlements CASCADE;
DROP TABLE IF EXISTS partner_balances CASCADE;

-- Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  category TEXT NOT NULL,
  "paidBy" TEXT NOT NULL,
  note TEXT,
  settled BOOLEAN NOT NULL DEFAULT false,
  "settledAt" TIMESTAMP WITH TIME ZONE,
  "settledMohamed" BOOLEAN NOT NULL DEFAULT false,
  "settledMariam" BOOLEAN NOT NULL DEFAULT false,
  "splitPayment" JSONB DEFAULT '{"mohamed": 0, "mariam": 0}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT valid_category CHECK (
    category IN (
      'Yarn & Materials',
      'Packaging',
      'Marketing & Ads',
      'Equipment',
      'Labor',
      'Shipping & Delivery',
      'Miscellaneous'
    )
  ),
  CONSTRAINT valid_paidBy CHECK (
    "paidBy" IN ('Mohamed', 'Mariam', 'Both', 'Business')
  )
);

-- Create settlements table
CREATE TABLE IF NOT EXISTS settlements (
  id UUID PRIMARY KEY,
  partner TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  "relatedExpenses" UUID[] NOT NULL DEFAULT '{}',
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT valid_partner CHECK (
    partner IN ('Mohamed', 'Mariam')
  )
);

-- Create partner_balances table
CREATE TABLE IF NOT EXISTS partner_balances (
  partner TEXT PRIMARY KEY,
  "owedAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "settledAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "lastSettlement" TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT valid_partner CHECK (
    partner IN ('Mohamed', 'Mariam')
  )
);

-- Create function to update partner balance
CREATE OR REPLACE FUNCTION update_partner_balance(
  p_partner TEXT,
  p_amount DECIMAL,
  p_settlement_date TIMESTAMP WITH TIME ZONE
) RETURNS void AS $$
BEGIN
  INSERT INTO partner_balances (partner, "owedAmount", "settledAmount", "lastSettlement")
  VALUES (p_partner, 0, p_amount, p_settlement_date)
  ON CONFLICT (partner) DO UPDATE
  SET 
    "settledAmount" = partner_balances."settledAmount" + p_amount,
    "lastSettlement" = p_settlement_date,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_paidBy ON expenses("paidBy");
CREATE INDEX IF NOT EXISTS idx_settlements_date ON settlements(date);
CREATE INDEX IF NOT EXISTS idx_settlements_partner ON settlements(partner); 