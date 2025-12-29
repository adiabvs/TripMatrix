import mongoose from 'mongoose';

let isConnected = false;

export async function connectDB() {
  if (isConnected) {
    return;
  }

  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.warn('⚠️  MONGODB_URI is not set. Database operations will not work.');
    console.warn('   Set MONGODB_URI in .env (e.g., mongodb://localhost:27017/tripmatrix or MongoDB Atlas connection string)');
    return;
  }

  try {
    await mongoose.connect(mongoUri);
    isConnected = true;
    console.log('✅ MongoDB connected successfully');
  } catch (error: any) {
    console.error('❌ MongoDB connection error:', error.message);
    console.warn('⚠️  Continuing without MongoDB. Some features will not work.');
  }
}

export function isMongoDBConnected() {
  return isConnected && mongoose.connection.readyState === 1;
}

export function getMongoDB() {
  if (!isConnected) {
    throw new Error('MongoDB is not connected. Check your MONGODB_URI in .env');
  }
  return mongoose.connection.db;
}

