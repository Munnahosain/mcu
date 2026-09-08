export type DatabaseProvider = 'mongodb';

export const DATABASE_PROVIDER: DatabaseProvider = 'mongodb';

export function getDatabaseProvider(): DatabaseProvider {
  return DATABASE_PROVIDER;
}

export function hasMongoDbConfig(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

