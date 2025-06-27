import mongoose from 'mongoose';
import config from '../config/server';

export const connectDB = async (): Promise<void> => {
  try {
    const uri = process.env.MONGODB_URI || '';
    await mongoose.connect(uri);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}; 