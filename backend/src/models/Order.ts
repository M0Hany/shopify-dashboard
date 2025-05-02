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
  });
};

export default mongoose.model<IOrder>('Order', OrderSchema); 