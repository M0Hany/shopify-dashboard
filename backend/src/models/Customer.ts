import mongoose, { Schema, Document } from 'mongoose';

export interface ICustomer extends Document {
  shopifyId: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  defaultAddress: {
    address1: string;
    address2?: string;
    city: string;
    province: string;
    country: string;
    zip: string;
  };
  orders: mongoose.Types.ObjectId[];
  totalSpent: string;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema: Schema = new Schema({
  shopifyId: { type: Number, required: true, unique: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  defaultAddress: {
    address1: { type: String, required: true },
    address2: { type: String },
    city: { type: String, required: true },
    province: { type: String, required: true },
    country: { type: String, required: true },
    zip: { type: String, required: true },
  },
  orders: [{ type: Schema.Types.ObjectId, ref: 'Order' }],
  totalSpent: { type: String, required: true },
  createdAt: { type: Date, required: true },
  updatedAt: { type: Date, required: true },
}, {
  timestamps: true,
});

// Create indexes for faster queries
CustomerSchema.index({ shopifyId: 1 });
CustomerSchema.index({ email: 1 });
CustomerSchema.index({ 'defaultAddress.city': 1 });
CustomerSchema.index({ 'defaultAddress.country': 1 });

export default mongoose.model<ICustomer>('Customer', CustomerSchema); 