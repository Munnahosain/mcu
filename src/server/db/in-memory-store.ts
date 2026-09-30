export interface InMemoryPayment {
  _id: string;
  paymentId: string;
  userId: { _id: string; name: string; email: string };
  planId: string;
  planNameSnapshot?: string;
  provider: string;
  amount: number;
  currency?: string;
  senderNumber: string;
  transactionId: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  notes?: string;
  billingInterval?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface InMemoryFeatureFlag {
  _id: string;
  key: string;
  enabled: boolean;
  plans: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InMemoryProviderKey {
  id: string;
  userId: string;
  provider: string;
  model: string;
  lastFour: string;
  createdAt: string;
}

class InMemoryStore {
  systemSettings: Map<string, unknown> = new Map();
  featureFlags: InMemoryFeatureFlag[] = [
    { _id: 'flag-1', key: 'ai_tools', enabled: true, plans: ['free', 'pro', 'enterprise'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { _id: 'flag-2', key: 'export_high_res', enabled: true, plans: ['pro', 'enterprise'], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ];
  payments: InMemoryPayment[] = [];
  providerKeys: InMemoryProviderKey[] = [];
  paymentSettings = {
    provider: 'bkash',
    paymentMethod: 'manual',
    enabled: true,
    accountNumber: '01700000000',
    accountType: 'merchant',
    instructions: 'Send money to the bKash merchant number and provide your Transaction ID.',
    minimumAmount: 0,
    maximumAmount: null as number | null,
  };
  creditCosts: Record<string, unknown> = {
    metadata_generation: 1,
    prompt_generation: 1,
    advanced_metadata: 2,
    batch_generation: 1,
    advanced_ai: 2,
    heavy_ai: 5,
    background_removal: 5,
    three_d_generation: 1,
    grid_generation: 1,
    palette_generation: 1,
    typebox_generation: 1,
    bento_generation: 1,
    ascii_generation: 1,
    trading_generation: 1,
    splitter_export: 1,
    byo_api_mode: 'charge',
  };
}

export const inMemoryStore = new InMemoryStore();
