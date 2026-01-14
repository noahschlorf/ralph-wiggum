import { describe, it, expect } from 'vitest';
import {
  listingSchema,
  createListingSchema,
  watchlistSchema,
  alertSchema,
  arbitrageOpportunitySchema,
} from '../../src/validators/listing';
import { Marketplace, ListingCondition, AlertType, AlertChannel } from '../../src/types/marketplace';

describe('Listing Validators', () => {
  describe('listingSchema', () => {
    it('should validate a complete listing', () => {
      const validListing = {
        id: 'listing-123',
        externalId: 'ext-456',
        marketplace: Marketplace.EBAY,
        title: 'iPhone 14 Pro',
        description: 'Great condition',
        price: 799.99,
        currency: 'USD',
        condition: ListingCondition.LIKE_NEW,
        location: 'New York, NY',
        sellerName: 'JohnDoe',
        sellerRating: 4.8,
        imageUrls: ['https://example.com/image1.jpg'],
        listingUrl: 'https://ebay.com/item/123',
        scrapedAt: new Date(),
      };

      const result = listingSchema.safeParse(validListing);
      expect(result.success).toBe(true);
    });

    it('should validate listing with only required fields', () => {
      const minimalListing = {
        id: 'listing-123',
        externalId: 'ext-456',
        marketplace: Marketplace.FACEBOOK,
        title: 'Used Bike',
        price: 150,
        currency: 'USD',
        imageUrls: [],
        listingUrl: 'https://facebook.com/marketplace/item/123',
        scrapedAt: new Date(),
      };

      const result = listingSchema.safeParse(minimalListing);
      expect(result.success).toBe(true);
    });

    it('should reject invalid marketplace', () => {
      const invalidListing = {
        id: 'listing-123',
        externalId: 'ext-456',
        marketplace: 'INVALID_MARKETPLACE',
        title: 'Test Item',
        price: 100,
        currency: 'USD',
        imageUrls: [],
        listingUrl: 'https://example.com',
        scrapedAt: new Date(),
      };

      const result = listingSchema.safeParse(invalidListing);
      expect(result.success).toBe(false);
    });

    it('should reject negative price', () => {
      const invalidListing = {
        id: 'listing-123',
        externalId: 'ext-456',
        marketplace: Marketplace.EBAY,
        title: 'Test Item',
        price: -50,
        currency: 'USD',
        imageUrls: [],
        listingUrl: 'https://ebay.com/item/123',
        scrapedAt: new Date(),
      };

      const result = listingSchema.safeParse(invalidListing);
      expect(result.success).toBe(false);
    });

    it('should reject invalid URL', () => {
      const invalidListing = {
        id: 'listing-123',
        externalId: 'ext-456',
        marketplace: Marketplace.EBAY,
        title: 'Test Item',
        price: 100,
        currency: 'USD',
        imageUrls: [],
        listingUrl: 'not-a-url',
        scrapedAt: new Date(),
      };

      const result = listingSchema.safeParse(invalidListing);
      expect(result.success).toBe(false);
    });

    it('should reject seller rating outside 0-5 range', () => {
      const invalidListing = {
        id: 'listing-123',
        externalId: 'ext-456',
        marketplace: Marketplace.EBAY,
        title: 'Test Item',
        price: 100,
        currency: 'USD',
        imageUrls: [],
        listingUrl: 'https://ebay.com/item/123',
        scrapedAt: new Date(),
        sellerRating: 6,
      };

      const result = listingSchema.safeParse(invalidListing);
      expect(result.success).toBe(false);
    });
  });

  describe('createListingSchema', () => {
    it('should validate input for creating a listing (without id)', () => {
      const createInput = {
        externalId: 'ext-456',
        marketplace: Marketplace.MERCARI,
        title: 'Vintage Watch',
        price: 299,
        currency: 'USD',
        imageUrls: ['https://example.com/watch.jpg'],
        listingUrl: 'https://mercari.com/item/456',
      };

      const result = createListingSchema.safeParse(createInput);
      expect(result.success).toBe(true);
    });
  });

  describe('watchlistSchema', () => {
    it('should validate a complete watchlist', () => {
      const validWatchlist = {
        id: 'watchlist-123',
        name: 'My Electronics',
        userId: 'user-456',
        keywords: ['iphone', 'macbook'],
        marketplaces: [Marketplace.EBAY, Marketplace.MERCARI],
        minPrice: 100,
        maxPrice: 1000,
        condition: [ListingCondition.NEW, ListingCondition.LIKE_NEW],
      };

      const result = watchlistSchema.safeParse(validWatchlist);
      expect(result.success).toBe(true);
    });

    it('should validate watchlist with only required fields', () => {
      const minimalWatchlist = {
        id: 'watchlist-123',
        name: 'Test Watchlist',
        userId: 'user-456',
        keywords: [],
        marketplaces: [],
      };

      const result = watchlistSchema.safeParse(minimalWatchlist);
      expect(result.success).toBe(true);
    });

    it('should reject if minPrice > maxPrice', () => {
      const invalidWatchlist = {
        id: 'watchlist-123',
        name: 'Invalid Range',
        userId: 'user-456',
        keywords: [],
        marketplaces: [],
        minPrice: 500,
        maxPrice: 100,
      };

      const result = watchlistSchema.safeParse(invalidWatchlist);
      expect(result.success).toBe(false);
    });
  });

  describe('alertSchema', () => {
    it('should validate a price threshold alert', () => {
      const validAlert = {
        id: 'alert-123',
        userId: 'user-456',
        watchlistId: 'watchlist-789',
        type: AlertType.PRICE_THRESHOLD,
        threshold: 100,
        channels: [AlertChannel.EMAIL, AlertChannel.PUSH],
        isActive: true,
      };

      const result = alertSchema.safeParse(validAlert);
      expect(result.success).toBe(true);
    });

    it('should require threshold for PRICE_THRESHOLD type', () => {
      const invalidAlert = {
        id: 'alert-123',
        userId: 'user-456',
        type: AlertType.PRICE_THRESHOLD,
        channels: [AlertChannel.EMAIL],
        isActive: true,
        // Missing threshold
      };

      const result = alertSchema.safeParse(invalidAlert);
      expect(result.success).toBe(false);
    });

    it('should validate alert without threshold for NEW_LISTING type', () => {
      const validAlert = {
        id: 'alert-123',
        userId: 'user-456',
        type: AlertType.NEW_LISTING,
        channels: [AlertChannel.PUSH],
        isActive: true,
      };

      const result = alertSchema.safeParse(validAlert);
      expect(result.success).toBe(true);
    });

    it('should require at least one channel', () => {
      const invalidAlert = {
        id: 'alert-123',
        userId: 'user-456',
        type: AlertType.NEW_LISTING,
        channels: [],
        isActive: true,
      };

      const result = alertSchema.safeParse(invalidAlert);
      expect(result.success).toBe(false);
    });
  });

  describe('arbitrageOpportunitySchema', () => {
    it('should validate a complete arbitrage opportunity', () => {
      const validOpportunity = {
        id: 'opp-123',
        sourceListingId: 'listing-456',
        targetMarketplace: Marketplace.EBAY,
        estimatedSellPrice: 150,
        purchasePrice: 75,
        platformFees: 19.88,
        shippingCost: 10,
        estimatedProfit: 45.12,
        profitMargin: 30.08,
        confidence: 0.85,
        status: 'ACTIVE',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      };

      const result = arbitrageOpportunitySchema.safeParse(validOpportunity);
      expect(result.success).toBe(true);
    });

    it('should reject confidence outside 0-1 range', () => {
      const invalidOpportunity = {
        id: 'opp-123',
        sourceListingId: 'listing-456',
        targetMarketplace: Marketplace.EBAY,
        estimatedSellPrice: 150,
        purchasePrice: 75,
        platformFees: 19.88,
        shippingCost: 10,
        estimatedProfit: 45.12,
        profitMargin: 30.08,
        confidence: 1.5, // Invalid
        status: 'ACTIVE',
        createdAt: new Date(),
      };

      const result = arbitrageOpportunitySchema.safeParse(invalidOpportunity);
      expect(result.success).toBe(false);
    });
  });
});
