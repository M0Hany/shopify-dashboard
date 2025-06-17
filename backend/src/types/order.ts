export type OrderStatus = 
  | 'pending'
  | 'customer_confirmed'
  | 'ready_to_ship'
  | 'shipped'
  | 'fulfilled'
  | 'paid'
  | 'cancelled';

export interface Order {
  id: string;
  name: string;
  status: OrderStatus;
  customer: {
    name: string;
    phone: string;
    email: string;
  };
  shipping_address: {
    address1: string;
    address2?: string;
    city: string;
    province: string;
    zip: string;
    country: string;
  };
  line_items: Array<{
    title: string;
    quantity: number;
    price: string;
    variant_title: string | null;
  }>;
  total_price: string;
  created_at: string;
  updated_at: string;
  tags: string[];
}

export interface LineItem {
  id: number;
  title: string;
  quantity: number;
  price: string;
  variant_title?: string;
}