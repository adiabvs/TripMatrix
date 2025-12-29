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
    // Disable mongoose buffering to prevent timeout errors
    mongoose.set('bufferCommands', false);
    
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 30000, // 30 seconds
      socketTimeoutMS: 45000, // 45 seconds
    });
    isConnected = true;
    console.log('✅ MongoDB connected successfully');
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
      isConnected = false;
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected');
      isConnected = false;
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
      isConnected = true;
    });
  } catch (error: any) {
    console.error('❌ MongoDB connection error:', error.message);
    throw error; // Re-throw to prevent server from starting without DB
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

