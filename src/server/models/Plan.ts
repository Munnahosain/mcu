import { Schema, model, models } from 'mongoose';

export interface IPlan {
  _id: string;
  name: string;
  slug: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  price: number;
  currency: string;
  monthlyCredits: number;
  batchLimit: number;
  bgRemovalLimit: number;
  validityDays: number;
  billingInterval: 'month' | 'year';
  creditRolloverEnabled: boolean;
  maxRolloverCredits: number;
  activeDeviceLimit: number;
  priorityLevel: 'standard' | 'high' | 'maximum';
  badgeText?: string;
  isPopular: boolean;
  ctaText: string;
  ctaAction?: string;
  features: string[];
  sortOrder: number;
  active: boolean;
  isPublic: boolean;
  limits?: {
    metadata?: number;
    backgroundRemoval?: number;
    threeDGeneration?: number;
    imageUploads?: number;
    apiRequests?: number;
    storageMB?: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

const PlanSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '' },
    monthlyPrice: { type: Number, required: true, min: 0, default: 0 },
    yearlyPrice: { type: Number, required: true, min: 0, default: 0 },
    price: { type: Number, required: true, min: 0, default: 0 },
    currency: { type: String, default: 'BDT' },
    billingInterval: { type: String, enum: ['month', 'year'], default: 'month' },
    monthlyCredits: { type: Number, default: 0, min: 0 },
    batchLimit: { type: Number, default: 5, min: 1 },
    bgRemovalLimit: { type: Number, default: 3, min: 0 },
    validityDays: { type: Number, default: 30, min: 1 },
    creditRolloverEnabled: { type: Boolean, default: false },
    maxRolloverCredits: { type: Number, default: 0, min: 0 },
    activeDeviceLimit: { type: Number, default: 1, min: 1 },
    priorityLevel: { type: String, enum: ['standard', 'high', 'maximum'], default: 'standard' },
    badgeText: { type: String, default: '' },
    isPopular: { type: Boolean, default: false },
    ctaText: { type: String, default: 'Choose Plan' },
    ctaAction: { type: String, default: '' },
    features: { type: [String], default: [] },
    sortOrder: { type: Number, default: 0 },
    limits: {
      metadata: { type: Number, default: 0, min: 0 },
      backgroundRemoval: { type: Number, default: 0, min: 0 },
      threeDGeneration: { type: Number, default: 0, min: 0 },
      imageUploads: { type: Number, default: 0, min: 0 },
      apiRequests: { type: Number, default: 0, min: 0 },
      storageMB: { type: Number, default: 0, min: 0 },
    },
    active: { type: Boolean, default: true, index: true },
    isPublic: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const OFFICIAL_PLANS_SEED = [
  {
    name: 'Free',
    slug: 'free',
    description: 'Explore the MCUSTOCK creative workflow and start producing stock assets.',
    monthlyPrice: 0,
    yearlyPrice: 0,
    price: 0,
    currency: 'BDT',
    monthlyCredits: 100,
    batchLimit: 5,
    bgRemovalLimit: 3,
    validityDays: 30,
    billingInterval: 'month' as const,
    creditRolloverEnabled: false,
    maxRolloverCredits: 0,
    activeDeviceLimit: 1,
    priorityLevel: 'standard' as const,
    badgeText: '',
    isPopular: false,
    ctaText: 'Get Started Free',
    ctaAction: '/signup',
    sortOrder: 1,
    active: true,
    isPublic: true,
    features: [
      '100 AI credits / month',
      'AI Metadata Generator (Title, Description, Keywords)',
      'AI Prompt Studio',
      'Basic 3D Icon Studio Preview',
      'Basic Materials & Lighting',
      'Limited Background Remover (3 / month)',
      'Vector Sheet Splitter',
      'Smart Grid & Bento Lab',
      'Color Palette Studio',
      'ASCII Studio',
      'Events Trends feed',
      'Stock CSV Export',
      'Multi-provider BYO API Keys (Groq, Gemini, OpenAI, Mistral, OpenRouter)',
      '5 files / batch',
      '1 active device',
    ],
  },
  {
    name: 'Creator',
    slug: 'creator',
    description: 'For individual creators producing and submitting content regularly.',
    monthlyPrice: 199,
    yearlyPrice: 1990,
    price: 199,
    currency: 'BDT',
    monthlyCredits: 2000,
    batchLimit: 25,
    bgRemovalLimit: 50,
    validityDays: 30,
    billingInterval: 'month' as const,
    creditRolloverEnabled: true,
    maxRolloverCredits: 2000,
    activeDeviceLimit: 2,
    priorityLevel: 'standard' as const,
    badgeText: '',
    isPopular: false,
    ctaText: 'Start Creating',
    ctaAction: '/dashboard/pricing?plan=creator',
    sortOrder: 2,
    active: true,
    isPublic: true,
    features: [
      '2,000 AI credits / month',
      'Batch Metadata Generation (Up to 25 files)',
      'Advanced Metadata & Keyword Controls',
      'AI Prompt Studio with advanced controls',
      'Advanced 3D Icon Studio (PBR Materials & Studio Lighting)',
      'GLTF 3D Export',
      'High-Res Background Remover (50 / month)',
      'Vector Sheet Splitter with 3D Handoff',
      'Smart Grid & Bento Lab',
      'Color Palette Studio',
      'TODOTOOL Typebox Studio',
      'ASCII Studio',
      'Events Trends feed',
      'Stock CSV, PNG, SVG & JSON Exports',
      'Multi-provider BYO API Keys',
      'Priority AI Processing',
      'Credit Rollover (Up to 2,000 credits)',
      '2 active devices',
    ],
  },
  {
    name: 'Pro',
    slug: 'pro',
    description: 'For serious stock contributors who want a complete AI-powered production workflow.',
    monthlyPrice: 499,
    yearlyPrice: 4990,
    price: 499,
    currency: 'BDT',
    monthlyCredits: 7500,
    batchLimit: 100,
    bgRemovalLimit: 200,
    validityDays: 30,
    billingInterval: 'month' as const,
    creditRolloverEnabled: true,
    maxRolloverCredits: 7500,
    activeDeviceLimit: 3,
    priorityLevel: 'high' as const,
    badgeText: 'MOST POPULAR',
    isPopular: true,
    ctaText: 'Go Pro',
    ctaAction: '/dashboard/pricing?plan=pro',
    sortOrder: 3,
    active: true,
    isPublic: true,
    features: [
      '7,500 AI credits / month',
      'Large Batch Processing (Up to 100 files)',
      'Advanced Metadata & SEO Generator',
      'Advanced AI Prompt Studio with Presets',
      'Full 3D Icon Studio PRO (Materials, Lighting, PMREM IBL)',
      'GLTF, OBJ & MP4 3D Exports',
      '4K Clean Alpha Background Remover (200 / month)',
      'Vector Sheet Splitter with 1-Click 3D Studio Handoff',
      'Smart Grid & Bento Grid Builder Suite',
      'Color Palette Studio',
      'TODOTOOL Typebox Studio (All 6 engines)',
      'ASCII Studio',
      'Events Trends feed',
      'All Export Formats (CSV, PNG, SVG, JSON, GLTF, OBJ, MP4)',
      'Multi-provider BYO API Keys',
      'Priority Queue AI Processing',
      'Credit Rollover (Up to 7,500 credits)',
      '3 active devices',
    ],
  },
  {
    name: 'Studio',
    slug: 'studio',
    description: 'Maximum production throughput and dedicated capacity for high-volume creators.',
    monthlyPrice: 999,
    yearlyPrice: 9990,
    price: 999,
    currency: 'BDT',
    monthlyCredits: 20000,
    batchLimit: 250,
    bgRemovalLimit: 500,
    validityDays: 30,
    billingInterval: 'month' as const,
    creditRolloverEnabled: true,
    maxRolloverCredits: 20000,
    activeDeviceLimit: 5,
    priorityLevel: 'maximum' as const,
    badgeText: '',
    isPopular: false,
    ctaText: 'Choose Studio',
    ctaAction: '/dashboard/pricing?plan=studio',
    sortOrder: 4,
    active: true,
    isPublic: true,
    features: [
      '20,000 AI credits / month',
      'Very Large Batch Processing (Up to 250 files)',
      'Advanced Metadata & Bulk Stock Automation',
      'Advanced AI Prompt Studio with Unlimited Presets',
      'Full 3D Icon Studio (All PBR materials, custom HDRI, Turntable MP4)',
      'GLTF, OBJ & MP4 3D Exports',
      'Ultra-HD Background Remover (500 / month)',
      'Vector Sheet Splitter Unlimited Extraction & 3D Sync',
      'Smart Grid & Bento Grid Builder Suite',
      'Color Palette Studio',
      'TODOTOOL Typebox Studio',
      'ASCII Studio',
      'Events Trends feed',
      'All Export Formats (CSV, PNG, SVG, JSON, GLTF, OBJ, MP4)',
      'Multi-provider BYO API Keys',
      'Maximum Generation Priority & Highest Concurrency',
      'Credit Rollover (Up to 20,000 credits)',
      '5 active devices',
      '24/7 Dedicated VIP Priority Support',
    ],
  },
];

export const Plan = models.Plan || model('Plan', PlanSchema);