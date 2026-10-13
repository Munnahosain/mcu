import dns from 'node:dns';
import mongoose from 'mongoose';

export const MONGODB_URI = process.env.MONGODB_URI;

mongoose.set('updatePipeline', true);
mongoose.set('bufferCommands', false); // Fail fast, don't hang if offline

interface GlobalMongoose {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose | null> | null;
}

declare global {
  var mongooseCache: GlobalMongoose | undefined;
}

let cached = global.mongooseCache;

if (!cached) {
  cached = global.mongooseCache = { conn: null, promise: null };
}

let hasCleanedIndexes = false;
async function cleanLegacyIndexes(mongooseInstance: typeof mongoose) {
  if (hasCleanedIndexes) return;
  hasCleanedIndexes = true;
  try {
    const db = mongooseInstance.connection.db;
    if (!db) return;
    const collections = await db.listCollections({ name: 'creditledgers' }).toArray();
    if (collections.length > 0) {
      const coll = db.collection('creditledgers');
      const indexes = await coll.indexes();
      const legacyIdx = indexes.find((i) => i.name === 'paymentId_1_type_1');
      if (legacyIdx && !legacyIdx.partialFilterExpression) {
        await coll.dropIndex('paymentId_1_type_1');
        console.log('Cleaned legacy unique index paymentId_1_type_1 from creditledgers');
      }
    }
  } catch (err) {
    console.warn('Index verification note:', err instanceof Error ? err.message : err);
  }
}

export async function connectToDatabase(): Promise<typeof mongoose | null> {
  if (!MONGODB_URI) {
    // MongoDB is not configured - return null without crashing
    return null;
  }

  if (cached!.conn) {
    return cached!.conn;
  }

  if (!cached!.promise) {
    const dnsServers = process.env.MONGODB_DNS_SERVERS
      ?.split(',')
      .map((server) => server.trim())
      .filter(Boolean);

    if (dnsServers && dnsServers.length > 0) {
      dns.setServers(dnsServers);
    }

    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    };

    cached!.promise = mongoose.connect(MONGODB_URI, opts).then(async (mongooseInstance) => {
      console.log('MongoDB successfully connected');
      await cleanLegacyIndexes(mongooseInstance);
      return mongooseInstance;
    }).catch((err) => {
      cached!.promise = null;
      console.warn('MongoDB connection failed — continuing with in-memory fallbacks:', err.message);
      return null;
    });
  }

  try {
    cached!.conn = await cached!.promise;
  } catch (e) {
    cached!.promise = null;
    console.warn('MongoDB connection error:', e);
    return null;
  }

  return cached!.conn;
}
