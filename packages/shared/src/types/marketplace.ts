/**
 * Supported marketplace platforms
 */
export const Marketplace = {
  EBAY: 'EBAY',
  FACEBOOK: 'FACEBOOK',
  CRAIGSLIST: 'CRAIGSLIST',
  OFFERUP: 'OFFERUP',
  MERCARI: 'MERCARI',
  POSHMARK: 'POSHMARK',
  AMAZON: 'AMAZON',
} as const;

export type Marketplace = (typeof Marketplace)[keyof typeof Marketplace];

/**
 * Listing condition types
 */
export const ListingCondition = {
  NEW: 'NEW',
  LIKE_NEW: 'LIKE_NEW',
  GOOD: 'GOOD',
  FAIR: 'FAIR',
  POOR: 'POOR',
} as const;

export type ListingCondition =
  (typeof ListingCondition)[keyof typeof ListingCondition];

/**
 * Core listing interface from any marketplace
 */
export interface Listing {
  id: string;
  externalId: string;
  marketplace: Marketplace;
  title: string;
  description?: string;
  price: number;
  currency: string;
  condition?: ListingCondition;
  location?: string;
  sellerName?: string;
  sellerRating?: number;
  imageUrls: string[];
  listingUrl: string;
  scrapedAt: Date;
}

/**
 * Price point for tracking price history
 */
export interface PricePoint {
  price: number;
  recordedAt: Date;
}

/**
 * Alert types
 */
export const AlertType = {
  PRICE_DROP: 'PRICE_DROP',
  NEW_LISTING: 'NEW_LISTING',
  ARBITRAGE_OPPORTUNITY: 'ARBITRAGE_OPPORTUNITY',
  PRICE_THRESHOLD: 'PRICE_THRESHOLD',
} as const;

export type AlertType = (typeof AlertType)[keyof typeof AlertType];

/**
 * Alert channels
 */
export const AlertChannel = {
  EMAIL: 'EMAIL',
  PUSH: 'PUSH',
  SMS: 'SMS',
  WEBHOOK: 'WEBHOOK',
} as const;

export type AlertChannel = (typeof AlertChannel)[keyof typeof AlertChannel];

/**
 * Opportunity status
 */
export const OpportunityStatus = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  PURCHASED: 'PURCHASED',
  SOLD: 'SOLD',
  DISMISSED: 'DISMISSED',
} as const;

export type OpportunityStatus =
  (typeof OpportunityStatus)[keyof typeof OpportunityStatus];
