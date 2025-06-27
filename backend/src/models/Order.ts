import mongoose, { Schema, Document } from 'mongoose';
import { ShopifyOrder } from '../services/shopify';

export interface IOrder extends Document {
  shopifyId: number;
  name: string;
  email: string;
  phone: string;
  totalPrice: string;
  financialStatus: string;
  fulfillmentStatus: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  lineItems: {
    title: string;
    quantity: number;
    price: string;
  }[];
  notes: string[];
  status: string;
  customer: {
    first_name: string;
    last_name: string;
    phone: string;
  };
  shippingAddress: {
    address1: string;
    city: string;
    country: string;
    phone: string;
  };
}

const OrderSchema: Schema = new Schema({
  shopifyId: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  totalPrice: { type: String, required: true },
  financialStatus: { type: String, required: true },
  fulfillmentStatus: { type: String, required: true },
  tags: [{ type: String }],
  createdAt: { type: Date, required: true },
  updatedAt: { type: Date, required: true },
  lineItems: [{
    title: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: String, required: true },
  }],
  notes: [{ type: String }],
  status: { type: String, required: true, default: 'pending' },
  customer: {
    first_name: { type: String, required: true },
    last_name: { type: String, required: true },
    phone: { type: String, required: true },
  },
  shippingAddress: {
    address1: { type: String, required: true },
    city: { type: String, required: true },
    country: { type: String, required: true },
    phone: { type: String, required: true },
  },
}, {
  timestamps: true,
});

// Create index for faster queries
OrderSchema.index({ shopifyId: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ createdAt: 1 });

// Static method to create an order from Shopify data
OrderSchema.statics.createFromShopify = async function(shopifyOrder: ShopifyOrder) {
  // Convert tags to array if it's a string or null
  const tags = Array.isArray(shopifyOrder.tags) 
    ? shopifyOrder.tags 
    : typeof shopifyOrder.tags === 'string' 
      ? shopifyOrder.tags.split(',') 
      : [];
      
  return this.create({
    shopifyId: shopifyOrder.id,
    name: shopifyOrder.name,
    email: shopifyOrder.email,
    phone: shopifyOrder.phone,
    totalPrice: shopifyOrder.total_price,
    financialStatus: shopifyOrder.financial_status,
    fulfillmentStatus: shopifyOrder.fulfillment_status,
    tags: tags,
    createdAt: new Date(shopifyOrder.created_at),
    updatedAt: new Date(shopifyOrder.updated_at),
    lineItems: shopifyOrder.line_items,
    status: tags.includes('express') ? 'express' : 'pending',
    customer: {
      first_name: shopifyOrder.customer.first_name,
      last_name: shopifyOrder.customer.last_name,
      phone: shopifyOrder.customer.phone,
    },
    shippingAddress: {
      address1: shopifyOrder.shipping_address.address1,
      city: shopifyOrder.shipping_address.city,
      country: shopifyOrder.shipping_address.country,
      phone: shopifyOrder.shipping_address.phone,
    },
  });
};

export default mongoose.model<IOrder>('Order', OrderSchema); 

export class Order {
  static async findShippedNotFulfilled(): Promise<Order[]> {
    try {
      const response = await fetch(`${process.env.SHOPIFY_SHOP_URL}/admin/api/2023-01/orders.json?status=any&limit=250`, {
        headers: {
          'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN as string
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch orders: ${response.statusText}`);
      }

      const data = await response.json() as { orders: any[] };
      
      // Filter orders that are shipped but not fulfilled
      return data.orders.filter((order: any) => {
        const tags = Array.isArray(order.tags) ? 
          order.tags : 
          typeof order.tags === 'string' ? 
            order.tags.split(',').map((t: string) => t.trim()) : 
            [];

        return tags.includes('shipped') && !tags.includes('fulfilled');
      });
    } catch (error) {
      console.error('Error finding shipped but not fulfilled orders:', error);
      throw error;
    }
  }
} 