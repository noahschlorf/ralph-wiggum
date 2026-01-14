import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ArbitrageEngine,
  ArbitrageOpportunity,
  PriceSource,
} from '../../src/services/arbitrage/engine';
import { Marketplace } from '@arbitrage/shared';

describe('ArbitrageEngine', () => {
  let engine: ArbitrageEngine;

  beforeEach(() => {
    engine = new ArbitrageEngine();
  });

  describe('findArbitrageOpportunities', () => {
    it('should identify profitable arbitrage when source price is lower than target', () => {
      const sources: PriceSource[] = [
        {
          marketplace: 'FACEBOOK',
          price: 100,
          listingId: 'fb-123',
          title: 'iPhone 14',
          url: 'https://facebook.com/marketplace/item/123',
        },
      ];

      const targets: PriceSource[] = [
        {
          marketplace: 'EBAY',
          price: 180,
          listingId: 'ebay-456',
          title: 'iPhone 14',
          url: 'https://ebay.com/itm/456',
        },
      ];

      const opportunities = engine.findArbitrageOpportunities(sources, targets);

      expect(opportunities).toHaveLength(1);
      expect(opportunities[0].grossProfit).toBe(80);
      expect(opportunities[0].sourcePrice).toBe(100);
      expect(opportunities[0].targetPrice).toBe(180);
    });

    it('should calculate net profit after fees', () => {
      const sources: PriceSource[] = [
        {
          marketplace: 'CRAIGSLIST',
          price: 200,
          listingId: 'cl-123',
          title: 'MacBook Pro',
          url: 'https://craigslist.org/ele/123.html',
        },
      ];

      const targets: PriceSource[] = [
        {
          marketplace: 'EBAY',
          price: 300,
          listingId: 'ebay-789',
          title: 'MacBook Pro',
          url: 'https://ebay.com/itm/789',
        },
      ];

      const opportunities = engine.findArbitrageOpportunities(sources, targets);

      expect(opportunities).toHaveLength(1);
      // eBay fee is ~13%
      expect(opportunities[0].fees).toBeGreaterThan(30);
      expect(opportunities[0].netProfit).toBeLessThan(opportunities[0].grossProfit);
    });

    it('should filter out unprofitable opportunities', () => {
      const sources: PriceSource[] = [
        {
          marketplace: 'FACEBOOK',
          price: 100,
          listingId: 'fb-123',
          title: 'Widget',
          url: 'https://facebook.com/item/123',
        },
      ];

      const targets: PriceSource[] = [
        {
          marketplace: 'EBAY',
          price: 105, // Only 5% margin - not profitable after fees
          listingId: 'ebay-456',
          title: 'Widget',
          url: 'https://ebay.com/itm/456',
        },
      ];

      const opportunities = engine.findArbitrageOpportunities(sources, targets, {
        minProfitMargin: 10, // Require 10% minimum
      });

      expect(opportunities).toHaveLength(0);
    });

    it('should include shipping costs in calculations', () => {
      const sources: PriceSource[] = [
        {
          marketplace: 'OFFERUP',
          price: 50,
          listingId: 'ou-123',
          title: 'Vintage Camera',
          url: 'https://offerup.com/item/123',
        },
      ];

      const targets: PriceSource[] = [
        {
          marketplace: 'EBAY',
          price: 100,
          listingId: 'ebay-456',
          title: 'Vintage Camera',
          url: 'https://ebay.com/itm/456',
        },
      ];

      const opportunities = engine.findArbitrageOpportunities(sources, targets, {
        shippingCost: 15,
      });

      expect(opportunities).toHaveLength(1);
      expect(opportunities[0].shippingCost).toBe(15);
      expect(opportunities[0].netProfit).toBeLessThan(50 - 15);
    });

    it('should handle multiple sources and targets', () => {
      const sources: PriceSource[] = [
        {
          marketplace: 'FACEBOOK',
          price: 80,
          listingId: 'fb-1',
          title: 'iPhone 14 Pro Max',
          url: 'https://facebook.com/1',
        },
        {
          marketplace: 'CRAIGSLIST',
          price: 90,
          listingId: 'cl-1',
          title: 'Samsung Galaxy S23',
          url: 'https://craigslist.org/1',
        },
      ];

      const targets: PriceSource[] = [
        {
          marketplace: 'EBAY',
          price: 150,
          listingId: 'ebay-1',
          title: 'Apple iPhone 14 Pro Max 256GB',
          url: 'https://ebay.com/1',
        },
        {
          marketplace: 'AMAZON',
          price: 200,
          listingId: 'amz-1',
          title: 'Samsung Galaxy S23 Ultra',
          url: 'https://amazon.com/1',
        },
      ];

      const opportunities = engine.findArbitrageOpportunities(sources, targets);

      // Each source matches its corresponding target by title similarity
      expect(opportunities).toHaveLength(2);
    });

    it('should sort opportunities by profit margin', () => {
      const sources: PriceSource[] = [
        {
          marketplace: 'FACEBOOK',
          price: 100,
          listingId: 'fb-1',
          title: 'Low Margin',
          url: 'https://facebook.com/1',
        },
        {
          marketplace: 'CRAIGSLIST',
          price: 50,
          listingId: 'cl-1',
          title: 'High Margin',
          url: 'https://craigslist.org/1',
        },
      ];

      const targets: PriceSource[] = [
        {
          marketplace: 'EBAY',
          price: 130,
          listingId: 'ebay-1',
          title: 'Low Margin',
          url: 'https://ebay.com/1',
        },
        {
          marketplace: 'EBAY',
          price: 150,
          listingId: 'ebay-2',
          title: 'High Margin',
          url: 'https://ebay.com/2',
        },
      ];

      const opportunities = engine.findArbitrageOpportunities(sources, targets, {
        sortBy: 'profitMargin',
      });

      expect(opportunities[0].profitMargin).toBeGreaterThan(opportunities[1].profitMargin);
    });
  });

  describe('calculateFees', () => {
    it('should calculate eBay fees correctly', () => {
      const fee = engine.calculateMarketplaceFee('EBAY', 100);
      // eBay: 13% final value fee
      expect(fee).toBeCloseTo(13, 0);
    });

    it('should calculate Mercari fees correctly', () => {
      const fee = engine.calculateMarketplaceFee('MERCARI', 100);
      // Mercari: 10% + payment processing
      expect(fee).toBeCloseTo(10, 0);
    });

    it('should calculate Poshmark fees correctly', () => {
      const fee = engine.calculateMarketplaceFee('POSHMARK', 100);
      // Poshmark: 20% for items over $15
      expect(fee).toBeCloseTo(20, 0);
    });

    it('should return 0 for free marketplaces', () => {
      const fbFee = engine.calculateMarketplaceFee('FACEBOOK', 100);
      const clFee = engine.calculateMarketplaceFee('CRAIGSLIST', 100);
      const ouFee = engine.calculateMarketplaceFee('OFFERUP', 100);

      expect(fbFee).toBe(0);
      expect(clFee).toBe(0);
      expect(ouFee).toBe(0);
    });

    it('should calculate Amazon fees correctly', () => {
      const fee = engine.calculateMarketplaceFee('AMAZON', 100);
      // Amazon: ~15% referral fee
      expect(fee).toBeCloseTo(15, 0);
    });
  });

  describe('matchListings', () => {
    it('should match listings by title similarity', () => {
      const source: PriceSource = {
        marketplace: 'FACEBOOK',
        price: 100,
        listingId: 'fb-1',
        title: 'Apple iPhone 14 Pro 128GB Space Black',
        url: 'https://facebook.com/1',
      };

      const targets: PriceSource[] = [
        {
          marketplace: 'EBAY',
          price: 200,
          listingId: 'ebay-1',
          title: 'iPhone 14 Pro 128GB Space Black Unlocked',
          url: 'https://ebay.com/1',
        },
        {
          marketplace: 'EBAY',
          price: 150,
          listingId: 'ebay-2',
          title: 'Samsung Galaxy S23',
          url: 'https://ebay.com/2',
        },
      ];

      const matches = engine.matchListings(source, targets);

      expect(matches).toHaveLength(1);
      expect(matches[0].listingId).toBe('ebay-1');
    });

    it('should use configurable similarity threshold', () => {
      const source: PriceSource = {
        marketplace: 'FACEBOOK',
        price: 100,
        listingId: 'fb-1',
        title: 'Apple iPhone 14 Pro Max 256GB Black',
        url: 'https://facebook.com/1',
      };

      const targets: PriceSource[] = [
        {
          marketplace: 'EBAY',
          price: 200,
          listingId: 'ebay-1',
          title: 'iPhone 14 Pro Max 256GB Unlocked',
          url: 'https://ebay.com/1',
        },
      ];

      // Low threshold - should match (titles share iPhone, 14, Pro, Max, 256GB)
      const lowThresholdMatches = engine.matchListings(source, targets, { threshold: 0.3 });
      expect(lowThresholdMatches).toHaveLength(1);

      // High threshold - should not match (not identical)
      const highThresholdMatches = engine.matchListings(source, targets, { threshold: 0.9 });
      expect(highThresholdMatches).toHaveLength(0);
    });
  });

  describe('calculateROI', () => {
    it('should calculate ROI correctly', () => {
      const opportunity: ArbitrageOpportunity = {
        sourceMarketplace: 'FACEBOOK',
        targetMarketplace: 'EBAY',
        sourcePrice: 100,
        targetPrice: 150,
        grossProfit: 50,
        fees: 19.5,
        shippingCost: 10,
        netProfit: 20.5,
        profitMargin: 13.67,
        roi: 20.5,
        sourceListing: {} as PriceSource,
        targetListing: {} as PriceSource,
      };

      const roi = engine.calculateROI(opportunity);

      // ROI = (netProfit / sourcePrice) * 100
      expect(roi).toBeCloseTo(20.5, 0);
    });
  });

  describe('filterByMinProfit', () => {
    it('should filter opportunities below minimum profit', () => {
      const opportunities: ArbitrageOpportunity[] = [
        {
          sourceMarketplace: 'FACEBOOK',
          targetMarketplace: 'EBAY',
          sourcePrice: 100,
          targetPrice: 120,
          grossProfit: 20,
          fees: 15,
          shippingCost: 0,
          netProfit: 5,
          profitMargin: 4.17,
          roi: 5,
          sourceListing: {} as PriceSource,
          targetListing: {} as PriceSource,
        },
        {
          sourceMarketplace: 'CRAIGSLIST',
          targetMarketplace: 'EBAY',
          sourcePrice: 50,
          targetPrice: 100,
          grossProfit: 50,
          fees: 13,
          shippingCost: 5,
          netProfit: 32,
          profitMargin: 32,
          roi: 64,
          sourceListing: {} as PriceSource,
          targetListing: {} as PriceSource,
        },
      ];

      const filtered = engine.filterByMinProfit(opportunities, 20);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].netProfit).toBe(32);
    });
  });
});
