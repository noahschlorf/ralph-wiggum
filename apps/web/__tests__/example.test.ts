import { describe, it, expect } from 'vitest';
import {
  calculateMarketplaceFee,
  calculateProfit,
  Marketplace,
} from '@arbitrage/shared';

describe('Shared package integration', () => {
  it('should import and use shared utilities', () => {
    const fee = calculateMarketplaceFee(100, Marketplace.EBAY);
    expect(fee).toBe(13.25);
  });

  it('should calculate profit correctly', () => {
    const result = calculateProfit({
      purchasePrice: 50,
      sellPrice: 100,
      marketplace: Marketplace.EBAY,
      shippingCost: 10,
    });

    expect(result.netProfit).toBeGreaterThan(0);
    expect(result.fees).toBe(13.25);
  });
});

describe('Environment', () => {
  it('should be in test mode', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});
