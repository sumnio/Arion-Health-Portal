import assert from 'node:assert/strict';
import test from 'node:test';
import { MongoRateLimitStore } from '../src/middleware/mongoRateLimitStore.js';

function sharedCollection() {
  const documents = new Map();
  return {
    documents,
    async createIndex() { return 'rate_limit_expiry'; },
    async findOneAndUpdate({ _id }, pipeline, options) {
      assert.equal(options.upsert, true);
      assert.equal(options.returnDocument, 'after');
      const now = pipeline[0].$set.count.$cond[0].$or[1].$lte[1];
      const nextResetAt = pipeline[0].$set.resetAt.$cond[1];
      const current = documents.get(_id);
      const expired = !current || current.resetAt <= now;
      const updated = {
        _id,
        count: expired ? 1 : current.count + 1,
        resetAt: expired ? nextResetAt : current.resetAt,
      };
      documents.set(_id, updated);
      return updated;
    },
    async updateOne({ _id }) {
      const current = documents.get(_id);
      if (current) current.count = Math.max(0, current.count - 1);
    },
    async deleteOne({ _id }) { documents.delete(_id); },
  };
}

function connection(collection) {
  return { collection() { return collection; } };
}

test('Mongo rate-limit stores share counters across function instances', async () => {
  const collection = sharedCollection();
  const now = () => new Date('2026-09-27T12:00:00.000Z');
  const first = new MongoRateLimitStore({ limiterType: 'login', connection: connection(collection), now });
  const second = new MongoRateLimitStore({ limiterType: 'login', connection: connection(collection), now });
  first.init({ windowMs: 60_000 });
  second.init({ windowMs: 60_000 });
  assert.equal((await first.increment('client')).totalHits, 1);
  assert.equal((await second.increment('client')).totalHits, 2);
  await second.decrement('client');
  assert.equal((await first.increment('client')).totalHits, 2);
});

test('limiter namespaces cannot affect each other', async () => {
  const collection = sharedCollection();
  const options = { connection: connection(collection), now: () => new Date('2026-09-27T12:00:00.000Z') };
  const login = new MongoRateLimitStore({ limiterType: 'login', ...options });
  const mfa = new MongoRateLimitStore({ limiterType: 'mfa_verification', ...options });
  login.init({ windowMs: 60_000 });
  mfa.init({ windowMs: 60_000 });
  assert.equal((await login.increment('client')).totalHits, 1);
  assert.equal((await mfa.increment('client')).totalHits, 1);
});

test('store failures fail closed with a safe 503 response error', async () => {
  const collection = sharedCollection();
  collection.findOneAndUpdate = async () => { throw new Error('sensitive database detail'); };
  const store = new MongoRateLimitStore({ limiterType: 'login', connection: connection(collection) });
  store.init({ windowMs: 60_000 });
  await assert.rejects(store.increment('client'), error => {
    assert.equal(error.status, 503);
    assert.equal(error.code, 'RATE_LIMIT_STORE_UNAVAILABLE');
    assert.doesNotMatch(error.message, /database detail/);
    return true;
  });
});
