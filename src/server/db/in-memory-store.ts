import { OFFICIAL_PLANS_SEED } from '@/server/models/Plan';

export interface InMemoryFeatureFlag {
  _id: string;
  key: string;
  enabled: boolean;
  plans: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InMemoryPaymentSetting {
  provider: string;
  paymentMethod: string;
  enabled: boolean;
  accountNumber: string;
  accountType: 'merchant' | 'personal';
  instructions: string;
  minimumAmount: number;
  maximumAmount: number | null;
}

export interface InMemoryProviderKey {
  id: string;
  userId: string;
  provider: string;
  model: string;
  lastFour: string;
  createdAt: string;
}

export interface InMemorySupportTicket {
  _id: string;
  ticketNumber: string;
  userId: { _id: string; name: string; email: string };
  subject: string;
  categoryId?: { name: string };
  priority: string;
  status: string;
  assignedTo?: { name: string };
  lastMessageAt: string;
  createdAt: string;
}

export interface InMemorySupportMessage {
  _id: string;
  ticketId: string;
  senderId?: { name: string };
  senderRole: 'user' | 'admin' | 'support';
  message: string;
  internalNote: boolean;
  createdAt: string;
}

export interface InMemoryPayment {
  _id: string;
  paymentId: string;
  userId: { _id: string; name: string; email: string };
  planId: string;
  planNameSnapshot: string;
  amount: number;
  provider: string;
  senderNumber: string;
  transactionId: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  createdAt: string;
}

class InMemoryStore {
  featureFlags: InMemoryFeatureFlag[] = [
    { _id: 'flag-1', key: 'ai-prompt-studio', enabled: true, plans: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { _id: 'flag-2', key: '3d-icon-studio', enabled: true, plans: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { _id: 'flag-3', key: 'vector-splitter', enabled: true, plans: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { _id: 'flag-4', key: 'background-remover', enabled: true, plans: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ];

  paymentSettings: InMemoryPaymentSetting = {
    provider: 'bkash',
    paymentMethod: 'manual',
    enabled: true,
    accountNumber: '01711000000',
    accountType: 'merchant',
    instructions: 'Send the exact plan amount via bKash to our Merchant number, then submit your sender number and transaction ID (TrxID) for verification.',
    minimumAmount: 0,
    maximumAmount: null,
  };

  creditCosts: Record<string, number> = {
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
    byo_api_mode: 0,
  };

  systemSettings: Map<string, unknown> = new Map<string, unknown>([
    ['credit_costs', this.creditCosts],
    ['maintenance_mode', false],
  ]);

  providerKeys: InMemoryProviderKey[] = [];
  payments: InMemoryPayment[] = [];
  supportTickets: InMemorySupportTicket[] = [];
  supportMessages: InMemorySupportMessage[] = [];
  supportSettings = {
    supportEnabled: true,
    allowNewTickets: true,
    autoResponse: true,
    emailNotifications: false,
    whatsapp: {
      enabled: true,
      number: '8801700000000',
      message: 'Hi MCUSTOCK Support 👋\n\nI need help with my MCUSTOCK account.\n\nUser ID: {USER_ID}\nAccount Email: {USER_EMAIL}\n\nIssue:\n',
      availabilityText: 'Replies usually within business hours (BST)',
      validNumber: true,
      previewUrl: 'https://wa.me/8801700000000',
    },
  };
}

declare global {
  var inMemoryDbStore: InMemoryStore | undefined;
}

export const inMemoryStore = global.inMemoryDbStore ?? (global.inMemoryDbStore = new InMemoryStore());
