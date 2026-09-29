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

    cached!.promise = mongoose.connect(MONGODB_URI, opts).then((mongooseInstance) => {
      console.log('MongoDB successfully connected');
      return mongooseInstance;
    }).catch((err) => {
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
