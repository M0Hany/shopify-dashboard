export interface Order {
  id: number;
  order_number: string;
  customer: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
  line_items: LineItem[];
  total_price: string;
  status: OrderStatus;
  tags: string[];
  notes: string[];
  created_at: string;
  updated_at: string;
}

export interface LineItem {
  id: number;
  title: string;
  quantity: number;
  price: string;
  variant_title?: string;
}

export type OrderStatus =
  | 'Customer Confirmed'
  | 'Express'
  | 'Ready to Ship'
  | 'Shipped'
  | 'Received'
  | 'Overdue'; 