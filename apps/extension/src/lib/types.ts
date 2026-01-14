import type { Marketplace, ListingCondition } from '@arbitrage/shared';

/**
 * Message types for communication between content scripts and background
 */
export type MessageType =
  | 'LISTING_SCRAPED'
  | 'GET_AUTH_TOKEN'
  | 'SET_AUTH_TOKEN'
  | 'SYNC_LISTINGS'
  | 'CHECK_ARBITRAGE';

/**
 * Scraped listing data from content scripts
 */
export interface ScrapedListingData {
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
}

/**
 * Message from content script when a listing is scraped
 */
export interface ScrapedListingMessage {
  type: 'LISTING_SCRAPED';
  payload: ScrapedListingData;
}

/**
 * Message to get auth token
 */
export interface GetAuthTokenMessage {
  type: 'GET_AUTH_TOKEN';
}

/**
 * Response from sync operations
 */
export interface SyncResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Extension storage schema
 */
export interface ExtensionStorage {
  authToken?: string;
  userId?: string;
  settings: ExtensionSettings;
  cachedListings: ScrapedListingData[];
}

/**
 * User configurable settings
 */
export interface ExtensionSettings {
  enableAutoScrape: boolean;
  syncInterval: number; // minutes
  enabledMarketplaces: Marketplace[];
  notificationsEnabled: boolean;
  minProfitThreshold: number; // percentage
}

/**
 * Default extension settings
 */
export const DEFAULT_SETTINGS: ExtensionSettings = {
  enableAutoScrape: true,
  syncInterval: 15,
  enabledMarketplaces: [
    'EBAY',
    'FACEBOOK',
    'CRAIGSLIST',
    'OFFERUP',
    'MERCARI',
    'POSHMARK',
    'AMAZON',
  ] as Marketplace[],
  notificationsEnabled: true,
  minProfitThreshold: 20,
};
