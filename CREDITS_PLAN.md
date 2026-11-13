# MCUSTOCK Credit Plan

Single source of truth for how many credits each action costs and what each plan gets.
Costs live in `src/server/services/credit-costs.ts` (admin can override them via the
`credit_costs` system setting). Plans live in `src/server/models/Plan.ts`.

## How credits work

- Every user has `credits.monthly` (plan allowance) and `credits.bonus` (rollover / admin grants).
- A charge is `amount x unit cost` for the feature. **`amount` is a count of units, never a price.**
  (Veo used to pass `5` for a 5-credit feature and was charged 5 x 5 = 25. Pass `1`.)
- Spend order: `monthly` first, then `bonus`. Refunds go back to `monthly` (the same bucket
  that was spent first), and `credits.used` never goes below 0.
- A charge is taken before the AI call and refunded if the call fails.
- Own API key (BYO) mode, set by admin in `credit_costs.byo_api_mode`:
  `charge` = full price, `reduced` = 50% (min 1), `free` = 0.

## Cost per action

| Action | Key | Credits |
|---|---|---|
| Metadata generation (per image/video) | `metadata_generation` | 1 |
| Prompt generation | `prompt_generation` | 1 |
| Advanced metadata | `advanced_metadata` | 2 |
| Batch generation (per file) | `batch_generation` | 1 |
| Advanced AI | `advanced_ai` | 2 |
| **Veo video generation** | `heavy_ai` | **5** |
| **Background removal** | `background_removal` | **5** |
| SVG motion AI plan | `svg_motion` | 1 |
| 3D icon, grid, palette, typebox, bento, ASCII/raster, trading, splitter export, motion, color extraction, vector splitter, general AI (per export/run) | various | 1 |

## What each plan buys

| Plan | Price / mo (BDT) | Monthly credits | Rollover cap | Metadata (1 cr) | Veo videos (5 cr) | BG removals (5 cr) |
|---|---|---|---|---|---|---|
| Free | 0 | 100 | none | 100 | 20 | 20 |
| Creator | 199 | 2,000 | 2,000 | 2,000 | 400 | 400 |
| Pro | 499 | 7,500 | 7,500 | 7,500 | 1,500 | 1,500 |
| Studio | 999 | 20,000 | 20,000 | 20,000 | 4,000 | 4,000 |

Credits per taka: Creator ~10, Pro ~15, Studio ~20. Higher tiers are cheaper per credit.

## Rules the code must keep

1. Charge once per user-visible action. Never pass a price as `amount`.
2. Always refund with the same `amount` and `costKey` that was charged.
3. Refund into `monthly`. The login / credits top-up (`monthly < allowance && used === 0`)
   relies on `used` and `monthly` staying consistent.
4. Log `creditsUsed` with the credits actually charged (`consumeCredits(...).charged`), not `1`.
5. The dashboard plan badge must show nothing until the real plan is known. Never default to a paid plan.

## Known gaps (not changed here)

- Plan limits `bgRemovalLimit` and `batchLimit` are shown on pricing pages but not enforced
  server-side. `backgroundRemoved` usage is now recorded, so enforcement can be added.
- Client-side metered tools (ASCII, palette, grid, etc.) charge from the browser before the
  export runs, with no refund if the export then fails.
