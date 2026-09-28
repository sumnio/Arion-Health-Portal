import mongoose from 'mongoose';
import { httpError } from '../utils/httpError.js';

const COLLECTION_NAME = 'rate_limit_counters';

function unavailable() {
  return httpError(503, 'RATE_LIMIT_STORE_UNAVAILABLE', 'Request protection is temporarily unavailable. Please try again later.');
}

export class MongoRateLimitStore {
  localKeys = false;

  constructor({ limiterType, connection = mongoose.connection, now = () => new Date() }) {
    this.prefix = `arion:${limiterType}:`;
    this.collection = connection.collection(COLLECTION_NAME);
    this.now = now;
    this.windowMs = 60_000;
    this.ready = Promise.resolve();
  }

  init(options) {
    this.windowMs = options.windowMs;
    this.ready = this.collection.createIndex(
      { resetAt: 1 },
      { expireAfterSeconds: 0, name: 'rate_limit_expiry' },
    ).catch(() => { throw unavailable(); });
  }

  key(key) {
    return `${this.prefix}${key}`;
  }

  async increment(key) {
    try {
      await this.ready;
      const now = this.now();
      const nextResetAt = new Date(now.getTime() + this.windowMs);
      const expired = {
        $or: [
          { $eq: [{ $type: '$resetAt' }, 'missing'] },
          { $lte: ['$resetAt', now] },
        ],
      };
      const result = await this.collection.findOneAndUpdate(
        { _id: this.key(key) },
        [{
          $set: {
            count: { $cond: [expired, 1, { $add: [{ $ifNull: ['$count', 0] }, 1] }] },
            resetAt: { $cond: [expired, nextResetAt, '$resetAt'] },
          },
        }],
        { upsert: true, returnDocument: 'after' },
      );
      const document = result?.value ?? result;
      if (!document) throw unavailable();
      return { totalHits: document.count, resetTime: new Date(document.resetAt) };
    } catch (error) {
      if (error?.code === 'RATE_LIMIT_STORE_UNAVAILABLE') throw error;
      throw unavailable();
    }
  }

  async decrement(key) {
    try {
      await this.ready;
      await this.collection.updateOne(
        { _id: this.key(key) },
        [{ $set: { count: { $max: [0, { $subtract: [{ $ifNull: ['$count', 0] }, 1] }] } } }],
      );
    } catch {
      throw unavailable();
    }
  }

  async resetKey(key) {
    try {
      await this.ready;
      await this.collection.deleteOne({ _id: this.key(key) });
    } catch {
      throw unavailable();
    }
  }
}

export function createMongoRateLimitStoreFactory(options = {}) {
  return limiterType => new MongoRateLimitStore({ limiterType, ...options });
}
