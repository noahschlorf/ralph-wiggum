import { describe, it, expect } from 'vitest';
import {
  calculateMarketplaceFee,
  calculateShippingCost,
  calculateProfit,
  calculateProfitMargin,
  calculateArbitrageOpportunity,
  formatPrice,
  parsePrice,
} from '../../src/utils/price';
import { Marketplace } from '../../src/types/marketplace';

describe('Price Utilities', () => {
  describe('calculateMarketplaceFee', () => {
    it('should calculate eBay fee at 13.25%', () => {
      expect(calculateMarketplaceFee(100, Marketplace.EBAY)).toBe(13.25);
      expect(calculateMarketplaceFee(50, Marketplace.EBAY)).toBe(6.63); // Rounded
    });

    it('should calculate Mercari fee at 10%', () => {
      expect(calculateMarketplaceFee(100, Marketplace.MERCARI)).toBe(10);
      expect(calculateMarketplaceFee(75, Marketplace.MERCARI)).toBe(7.5);
    });

    it('should calculate Poshmark fee at 20%', () => {
      expect(calculateMarketplaceFee(100, Marketplace.POSHMARK)).toBe(20);
      expect(calculateMarketplaceFee(50, Marketplace.POSHMARK)).toBe(10);
    });

    it('should calculate Amazon fee at 15%', () => {
      expect(calculateMarketplaceFee(100, Marketplace.AMAZON)).toBe(15);
    });

    it('should return 0 for platforms without fees (FB, Craigslist, OfferUp)', () => {
      expect(calculateMarketplaceFee(100, Marketplace.FACEBOOK)).toBe(0);
      expect(calculateMarketplaceFee(100, Marketplace.CRAIGSLIST)).toBe(0);
      expect(calculateMarketplaceFee(100, Marketplace.OFFERUP)).toBe(0);
    });

    it('should handle zero price', () => {
      expect(calculateMarketplaceFee(0, Marketplace.EBAY)).toBe(0);
    });

    it('should round to 2 decimal places', () => {
      expect(calculateMarketplaceFee(33.33, Marketplace.EBAY)).toBe(4.42);
    });
  });

  describe('calculateShippingCost', () => {
    it('should calculate shipping based on weight', () => {
      expect(calculateShippingCost(1)).toBeGreaterThan(0);
      expect(calculateShippingCost(5)).toBeGreaterThan(calculateShippingCost(1));
    });

    it('should return minimum shipping for very light items', () => {
      expect(calculateShippingCost(0.1)).toBeGreaterThanOrEqual(4.99);
    });

    it('should handle zero weight', () => {
      expect(calculateShippingCost(0)).toBe(0);
    });
  });

  describe('calculateProfit', () => {
    it('should calculate profit correctly', () => {
      const result = calculateProfit({
        purchasePrice: 50,
        sellPrice: 100,
        marketplace: Marketplace.EBAY,
        shippingCost: 10,
      });

      expect(result.grossProfit).toBe(50); // 100 - 50
      expect(result.fees).toBe(13.25); // 13.25% of 100
      expect(result.netProfit).toBe(26.75); // 50 - 13.25 - 10
    });

    it('should handle negative profit scenarios', () => {
      const result = calculateProfit({
        purchasePrice: 90,
        sellPrice: 100,
        marketplace: Marketplace.POSHMARK,
        shippingCost: 15,
      });

      expect(result.netProfit).toBeLessThan(0);
    });

    it('should include additional costs', () => {
      const result = calculateProfit({
        purchasePrice: 50,
        sellPrice: 100,
        marketplace: Marketplace.EBAY,
        shippingCost: 10,
        additionalCosts: 5,
      });

      expect(result.netProfit).toBe(21.75); // 50 - 13.25 - 10 - 5
    });
  });

  describe('calculateProfitMargin', () => {
    it('should calculate profit margin as percentage', () => {
      expect(calculateProfitMargin(50, 100)).toBe(50);
      expect(calculateProfitMargin(25, 100)).toBe(25);
      expect(calculateProfitMargin(0, 100)).toBe(0);
    });

    it('should handle negative profit', () => {
      expect(calculateProfitMargin(-10, 100)).toBe(-10);
    });

    it('should handle zero sell price', () => {
      expect(calculateProfitMargin(50, 0)).toBe(0);
    });

    it('should round to 2 decimal places', () => {
      expect(calculateProfitMargin(33.33, 100)).toBe(33.33);
    });
  });

  describe('calculateArbitrageOpportunity', () => {
    it('should detect profitable arbitrage opportunity', () => {
      const result = calculateArbitrageOpportunity({
        sourcePrice: 50,
        sourceMarketplace: Marketplace.FACEBOOK,
        targetPrice: 100,
        targetMarketplace: Marketplace.EBAY,
        shippingCost: 10,
      });

      expect(result.isProfitable).toBe(true);
      expect(result.estimatedProfit).toBeGreaterThan(0);
      expect(result.profitMargin).toBeGreaterThan(0);
    });

    it('should detect unprofitable arbitrage', () => {
      const result = calculateArbitrageOpportunity({
        sourcePrice: 95,
        sourceMarketplace: Marketplace.CRAIGSLIST,
        targetPrice: 100,
        targetMarketplace: Marketplace.POSHMARK, // 20% fee
        shippingCost: 10,
      });

      expect(result.isProfitable).toBe(false);
      expect(result.estimatedProfit).toBeLessThan(0);
    });

    it('should calculate confidence score', () => {
      const result = calculateArbitrageOpportunity({
        sourcePrice: 50,
        sourceMarketplace: Marketplace.FACEBOOK,
        targetPrice: 100,
        targetMarketplace: Marketplace.EBAY,
        shippingCost: 10,
      });

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should have high confidence for 30%+ profit margin', () => {
      const result = calculateArbitrageOpportunity({
        sourcePrice: 30,
        sourceMarketplace: Marketplace.FACEBOOK, // No fees
        targetPrice: 100,
        targetMarketplace: Marketplace.FACEBOOK, // No fees
        shippingCost: 5,
      });

      // Profit: 100 - 30 - 5 = 65, Margin: 65%
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should have medium-high confidence for 20-30% profit margin', () => {
      const result = calculateArbitrageOpportunity({
        sourcePrice: 70,
        sourceMarketplace: Marketplace.FACEBOOK,
        targetPrice: 100,
        targetMarketplace: Marketplace.FACEBOOK,
        shippingCost: 5,
      });

      // Profit: 100 - 70 - 5 = 25, Margin: 25%
      expect(result.confidence).toBe(0.75);
    });

    it('should have medium confidence for 10-20% profit margin', () => {
      const result = calculateArbitrageOpportunity({
        sourcePrice: 80,
        sourceMarketplace: Marketplace.FACEBOOK,
        targetPrice: 100,
        targetMarketplace: Marketplace.FACEBOOK,
        shippingCost: 5,
      });

      // Profit: 100 - 80 - 5 = 15, Margin: 15%
      expect(result.confidence).toBe(0.6);
    });

    it('should have low confidence for 0-10% profit margin', () => {
      const result = calculateArbitrageOpportunity({
        sourcePrice: 90,
        sourceMarketplace: Marketplace.FACEBOOK,
        targetPrice: 100,
        targetMarketplace: Marketplace.FACEBOOK,
        shippingCost: 5,
      });

      // Profit: 100 - 90 - 5 = 5, Margin: 5%
      expect(result.confidence).toBe(0.4);
    });

    it('should boost confidence when price difference ratio > 50%', () => {
      const result = calculateArbitrageOpportunity({
        sourcePrice: 40,
        sourceMarketplace: Marketplace.FACEBOOK,
        targetPrice: 100,
        targetMarketplace: Marketplace.FACEBOOK,
        shippingCost: 5,
      });

      // priceDiffRatio = (100-40)/40 = 1.5 > 0.5, so confidence boosted
      expect(result.confidence).toBe(1); // 0.9 + 0.1 = 1.0 (capped)
    });
  });

  describe('formatPrice', () => {
    it('should format price with USD by default', () => {
      expect(formatPrice(100)).toBe('$100.00');
      expect(formatPrice(99.99)).toBe('$99.99');
      expect(formatPrice(1234.56)).toBe('$1,234.56');
    });

    it('should format with different currencies', () => {
      expect(formatPrice(100, 'EUR')).toContain('100');
      expect(formatPrice(100, 'GBP')).toContain('100');
    });

    it('should handle zero', () => {
      expect(formatPrice(0)).toBe('$0.00');
    });

    it('should handle negative prices', () => {
      expect(formatPrice(-50)).toBe('-$50.00');
    });
  });

  describe('parsePrice', () => {
    it('should parse price strings', () => {
      expect(parsePrice('$100.00')).toBe(100);
      expect(parsePrice('$99.99')).toBe(99.99);
      expect(parsePrice('$1,234.56')).toBe(1234.56);
    });

    it('should handle various formats', () => {
      expect(parsePrice('100')).toBe(100);
      expect(parsePrice('100.00')).toBe(100);
      expect(parsePrice('$100')).toBe(100);
      expect(parsePrice('USD 100')).toBe(100);
    });

    it('should return 0 for invalid input', () => {
      expect(parsePrice('')).toBe(0);
      expect(parsePrice('abc')).toBe(0);
      expect(parsePrice('free')).toBe(0);
    });

    it('should handle whitespace', () => {
      expect(parsePrice('  $100.00  ')).toBe(100);
    });
  });
});
