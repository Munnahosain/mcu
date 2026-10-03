import { DEFAULT_CREDIT_COSTS } from '@/server/services/credit-costs';

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
  message?: string;
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
  creditCosts: Record<string, unknown> = { ...DEFAULT_CREDIT_COSTS };
}

export const inMemoryStore = new InMemoryStore();
