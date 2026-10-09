export const DEFAULT_CREDIT_COSTS = {
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
  svg_motion: 1,
  motion_generation: 1,
  color_extraction: 1,
  vector_splitter: 1,
  general_ai: 1,
  byo_api_mode: 'charge',
} as const;

export type CreditCostKey = Exclude<keyof typeof DEFAULT_CREDIT_COSTS, 'byo_api_mode'>;
export const CREDIT_COST_KEYS = Object.keys(DEFAULT_CREDIT_COSTS) as Array<keyof typeof DEFAULT_CREDIT_COSTS>;
export const MAX_CREDIT_COST = 1_000_000;
