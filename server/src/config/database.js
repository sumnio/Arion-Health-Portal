import mongoose from 'mongoose';

const CACHE_KEY = Symbol.for('arion-health-portal.mongoose-connection');

export function createConnectionCache() {
  return { connection: null, promise: null };
}

export const databaseConnectionCache = globalThis[CACHE_KEY] ??=
  createConnectionCache();

export function requireMongoUri(uri) {
  if (!uri?.trim()) {
    throw new Error('MONGODB_URI is required. Add it to server/.env before starting the API.');
  }
  return uri.trim();
}

export function connectDatabase(uri, {
  databaseName = '',
  mongooseInstance = mongoose,
  connectionCache = databaseConnectionCache,
  logger = console.info,
} = {}) {
  const mongoUri = requireMongoUri(uri);
  if (mongooseInstance.connection.readyState === 1) {
    connectionCache.connection = mongooseInstance.connection;
    connectionCache.promise = null;
    return Promise.resolve(mongooseInstance.connection);
  }
  if (connectionCache.connection?.readyState === 1) {
    connectionCache.promise = null;
    return Promise.resolve(connectionCache.connection);
  }
  if (connectionCache.promise) return connectionCache.promise;

  const connectOptions = databaseName ? { dbName: databaseName } : undefined;
  const connectionPromise = mongooseInstance.connect(mongoUri, connectOptions)
    .then(() => {
      connectionCache.connection = mongooseInstance.connection;
      connectionCache.promise = null;
      logger('MongoDB connection established.');
      return mongooseInstance.connection;
    })
    .catch((error) => {
      if (connectionCache.promise === connectionPromise) {
        connectionCache.promise = null;
        connectionCache.connection = null;
      }
      throw error;
    });
  connectionCache.promise = connectionPromise;
  return connectionPromise;
}

export async function disconnectDatabase({
  mongooseInstance = mongoose,
  connectionCache = databaseConnectionCache,
} = {}) {
  if (mongooseInstance.connection.readyState !== 0) await mongooseInstance.disconnect();
  connectionCache.connection = null;
  connectionCache.promise = null;
}
