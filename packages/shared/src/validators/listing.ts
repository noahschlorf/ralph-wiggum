import { z } from 'zod';
import {
  Marketplace,
  ListingCondition,
  AlertType,
  AlertChannel,
  OpportunityStatus,
} from '../types/marketplace';

/**
 * Zod schema for Marketplace enum
 */
export const marketplaceSchema = z.enum([
  Marketplace.EBAY,
  Marketplace.FACEBOOK,
  Marketplace.CRAIGSLIST,
  Marketplace.OFFERUP,
  Marketplace.MERCARI,
  Marketplace.POSHMARK,
  Marketplace.AMAZON,
]);

/**
 * Zod schema for ListingCondition enum
 */
export const listingConditionSchema = z.enum([
  ListingCondition.NEW,
  ListingCondition.LIKE_NEW,
  ListingCondition.GOOD,
  ListingCondition.FAIR,
  ListingCondition.POOR,
]);

/**
 * Zod schema for AlertType enum
 */
export const alertTypeSchema = z.enum([
  AlertType.PRICE_DROP,
  AlertType.NEW_LISTING,
  AlertType.ARBITRAGE_OPPORTUNITY,
  AlertType.PRICE_THRESHOLD,
]);

/**
 * Zod schema for AlertChannel enum
 */
export const alertChannelSchema = z.enum([
  AlertChannel.EMAIL,
  AlertChannel.PUSH,
  AlertChannel.SMS,
  AlertChannel.WEBHOOK,
]);

/**
 * Zod schema for OpportunityStatus enum
 */
export const opportunityStatusSchema = z.enum([
  OpportunityStatus.ACTIVE,
  OpportunityStatus.EXPIRED,
  OpportunityStatus.PURCHASED,
  OpportunityStatus.SOLD,
  OpportunityStatus.DISMISSED,
]);

/**
 * Full listing schema with all fields
 */
export const listingSchema = z.object({
  id: z.string().min(1),
  externalId: z.string().min(1),
  marketplace: marketplaceSchema,
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  price: z.number().nonnegative(),
  currency: z.string().length(3),
  condition: listingConditionSchema.optional(),
  location: z.string().max(200).optional(),
  sellerName: z.string().max(100).optional(),
  sellerRating: z.number().min(0).max(5).optional(),
  imageUrls: z.array(z.string().url()).default([]),
  listingUrl: z.string().url(),
  scrapedAt: z.date(),
});

export type ListingInput = z.infer<typeof listingSchema>;

/**
 * Schema for creating a new listing (without id, scrapedAt will be set automatically)
 */
export const createListingSchema = listingSchema.omit({
  id: true,
  scrapedAt: true,
});

export type CreateListingInput = z.infer<typeof createListingSchema>;

/**
 * Watchlist schema with price range validation
 */
export const watchlistSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1).max(100),
    userId: z.string().min(1),
    keywords: z.array(z.string()).default([]),
    marketplaces: z.array(marketplaceSchema).default([]),
    minPrice: z.number().nonnegative().optional(),
    maxPrice: z.number().nonnegative().optional(),
    condition: z.array(listingConditionSchema).optional(),
  })
  .refine(
    (data) => {
      if (data.minPrice !== undefined && data.maxPrice !== undefined) {
        return data.minPrice <= data.maxPrice;
      }
      return true;
    },
    {
      message: 'minPrice must be less than or equal to maxPrice',
      path: ['minPrice'],
    }
  );

export type WatchlistInput = z.infer<typeof watchlistSchema>;

/**
 * Alert schema with conditional threshold validation
 */
export const alertSchema = z
  .object({
    id: z.string().min(1),
    userId: z.string().min(1),
    watchlistId: z.string().min(1).optional(),
    type: alertTypeSchema,
    threshold: z.number().nonnegative().optional(),
    channels: z.array(alertChannelSchema).min(1),
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) => {
      // Threshold is required for PRICE_THRESHOLD type
      if (data.type === AlertType.PRICE_THRESHOLD) {
        return data.threshold !== undefined;
      }
      return true;
    },
    {
      message: 'threshold is required for PRICE_THRESHOLD alert type',
      path: ['threshold'],
    }
  );

export type AlertInput = z.infer<typeof alertSchema>;

/**
 * Arbitrage opportunity schema
 */
export const arbitrageOpportunitySchema = z.object({
  id: z.string().min(1),
  sourceListingId: z.string().min(1),
  targetMarketplace: marketplaceSchema,
  estimatedSellPrice: z.number().nonnegative(),
  purchasePrice: z.number().nonnegative(),
  platformFees: z.number().nonnegative(),
  shippingCost: z.number().nonnegative(),
  estimatedProfit: z.number(),
  profitMargin: z.number(),
  confidence: z.number().min(0).max(1),
  status: opportunityStatusSchema,
  createdAt: z.date(),
  expiresAt: z.date().optional(),
});

export type ArbitrageOpportunityInput = z.infer<typeof arbitrageOpportunitySchema>;
