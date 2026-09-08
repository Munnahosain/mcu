import dns from 'node:dns';
import mongoose from 'mongoose';

export const MONGODB_URI = process.env.MONGODB_URI;

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
interface GlobalMongoose {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: GlobalMongoose | undefined;
}

let cached = global.mongooseCache;

if (!cached) {
  cached = global.mongooseCache = { conn: null, promise: null };
}

export async function connectToDatabase() {
  if (!MONGODB_URI) {
    throw new Error('MongoDB is not configured. Set MONGODB_URI in .env.local.');
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

    cached!.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('MongoDB successfully connected');
      return mongoose;
    });
  }

  try {
    cached!.conn = await cached!.promise;
  } catch (e) {
    cached!.promise = null;
    throw e;
  }

  return cached!.conn;
}
