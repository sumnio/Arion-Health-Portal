import mongoose from 'mongoose';

export function requireMongoUri(uri) {
  if (!uri?.trim()) {
    throw new Error('MONGODB_URI is required. Add it to server/.env before starting the API.');
  }
  return uri.trim();
}

export async function connectDatabase(uri) {
  const mongoUri = requireMongoUri(uri);
  await mongoose.connect(mongoUri);
  console.info('MongoDB connection established.');
  return mongoose.connection;
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
