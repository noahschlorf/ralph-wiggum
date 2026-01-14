import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KeepaClient, KeepaClientConfig, KeepaTimeUtils } from '../../src/keepa/client';

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('KeepaClient', () => {
  let client: KeepaClient;
  const mockConfig: KeepaClientConfig = {
    apiKey: 'test-api-key',
    domain: 'US',
  };

  beforeEach(() => {
    client = new KeepaClient(mockConfig);
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client with config', () => {
      expect(client).toBeInstanceOf(KeepaClient);
    });

    it('should default to US domain', () => {
      const clientWithoutDomain = new KeepaClient({ apiKey: 'test' });
      expect(clientWithoutDomain).toBeInstanceOf(KeepaClient);
    });
  });

  describe('getProduct', () => {
    it('should fetch product data by ASIN', async () => {
      const mockResponse = {
        products: [
          {
            asin: 'B09V3KXJPB',
            title: 'Apple iPhone 14 Pro',
            rootCategory: 2335752011,
            manufacturer: 'Apple',
            brand: 'Apple',
            productGroup: 'Wireless',
            csv: [
              // Price history data
              [21000000, 99999], // timestamp, price in cents
              [21000001, 89999],
            ],
            imagesCSV: 'image1.jpg,image2.jpg',
            lastUpdate: 21500000,
          },
        ],
        tokensLeft: 95,
        refillIn: 300000,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.getProduct('B09V3KXJPB');

      expect(mockFetch).toHaveBeenCalled();
      expect(result.asin).toBe('B09V3KXJPB');
      expect(result.title).toBe('Apple iPhone 14 Pro');
    });

    it('should handle product not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ products: [] }),
      });

      await expect(client.getProduct('INVALID123')).rejects.toThrow('Product not found');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(client.getProduct('B09V3KXJPB')).rejects.toThrow();
    });
  });

  describe('getProducts', () => {
    it('should fetch multiple products by ASINs', async () => {
      const mockResponse = {
        products: [
          { asin: 'B001', title: 'Product 1' },
          { asin: 'B002', title: 'Product 2' },
        ],
        tokensLeft: 90,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.getProducts(['B001', 'B002']);

      expect(result).toHaveLength(2);
      expect(result[0].asin).toBe('B001');
      expect(result[1].asin).toBe('B002');
    });

    it('should handle up to 100 ASINs', async () => {
      const asins = Array.from({ length: 100 }, (_, i) => `B${String(i).padStart(9, '0')}`);
      const mockProducts = asins.map((asin) => ({ asin, title: `Product ${asin}` }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ products: mockProducts }),
      });

      const result = await client.getProducts(asins);

      expect(result).toHaveLength(100);
    });
  });

  describe('getPriceHistory', () => {
    it('should return formatted price history', async () => {
      const mockResponse = {
        products: [
          {
            asin: 'B09V3KXJPB',
            title: 'Test Product',
            csv: [
              [0, [21564000, 9999, 21564001, 8999, 21564002, 7999]], // Amazon price history
            ],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.getPriceHistory('B09V3KXJPB');

      expect(result.asin).toBe('B09V3KXJPB');
      expect(result.priceHistory).toBeDefined();
    });

    it('should handle products without price history', async () => {
      const mockResponse = {
        products: [
          {
            asin: 'B09V3KXJPB',
            title: 'No History Product',
            csv: null,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.getPriceHistory('B09V3KXJPB');

      expect(result.priceHistory).toEqual([]);
    });

    it('should parse valid price history and calculate statistics', async () => {
      const mockResponse = {
        products: [
          {
            asin: 'B09V3KXJPB',
            title: 'Test Product',
            csv: [[21564000, 10000, 21564001, 20000, 21564002, 15000]], // timestamps and prices in cents
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.getPriceHistory('B09V3KXJPB');

      expect(result.priceHistory.length).toBe(3);
      expect(result.currentPrice).toBe(150); // last valid price
      expect(result.lowestPrice).toBe(100);
      expect(result.highestPrice).toBe(200);
      expect(result.averagePrice).toBe(150);
    });

    it('should skip invalid data types in price history', async () => {
      const mockResponse = {
        products: [
          {
            asin: 'B09V3KXJPB',
            title: 'Test Product',
            csv: [[21564000, 10000, 'invalid', 20000, 21564002, null]], // invalid types
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.getPriceHistory('B09V3KXJPB');

      expect(result.priceHistory.length).toBe(1); // Only first valid pair
    });

    it('should handle empty csv array', async () => {
      const mockResponse = {
        products: [
          {
            asin: 'B09V3KXJPB',
            title: 'Test Product',
            csv: [],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.getPriceHistory('B09V3KXJPB');

      expect(result.priceHistory).toEqual([]);
      expect(result.lowestPrice).toBeUndefined();
      expect(result.highestPrice).toBeUndefined();
      expect(result.averagePrice).toBeUndefined();
    });

    it('should handle csv with invalid first element', async () => {
      const mockResponse = {
        products: [
          {
            asin: 'B09V3KXJPB',
            title: 'Test Product',
            csv: [null], // first element is not an array
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.getPriceHistory('B09V3KXJPB');

      expect(result.priceHistory).toEqual([]);
    });
  });

  describe('getQuotaStatus', () => {
    it('should return token status', async () => {
      const mockResponse = {
        tokensLeft: 50,
        refillIn: 180000,
        refillRate: 5,
        tokenFlowReduction: 0,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.getQuotaStatus();

      expect(result.tokensLeft).toBe(50);
      expect(result.refillIn).toBe(180000);
    });

    it('should handle missing refillRate', async () => {
      const mockResponse = {
        tokensLeft: 50,
        refillIn: 180000,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.getQuotaStatus();

      expect(result.refillRate).toBe(5); // Default value
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(client.getQuotaStatus()).rejects.toThrow();
    });
  });

  describe('searchProducts', () => {
    it('should search products by keyword', async () => {
      // First call returns ASINs
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ asinList: ['B001', 'B002', 'B003'] }),
      });

      // Second call returns product details
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          products: [
            { asin: 'B001', title: 'Product 1' },
            { asin: 'B002', title: 'Product 2' },
            { asin: 'B003', title: 'Product 3' },
          ],
        }),
      });

      const result = await client.searchProducts('iphone');

      expect(result).toHaveLength(3);
      expect(result[0].asin).toBe('B001');
    });

    it('should limit results to specified amount', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ asinList: ['B001', 'B002', 'B003', 'B004', 'B005'] }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          products: [
            { asin: 'B001', title: 'Product 1' },
            { asin: 'B002', title: 'Product 2' },
          ],
        }),
      });

      const result = await client.searchProducts('laptop', 2);

      expect(result).toHaveLength(2);
    });

    it('should handle empty search results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ asinList: [] }),
      });

      const result = await client.searchProducts('nonexistent12345');

      expect(result).toHaveLength(0);
    });

    it('should handle search API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
      });

      await expect(client.searchProducts('test')).rejects.toThrow();
    });
  });
});

describe('KeepaTimeUtils', () => {
  describe('keepaToUnix', () => {
    it('should convert Keepa timestamp to Unix timestamp', () => {
      // Keepa time = (Unix time / 60000) - 21564000
      const keepaTime = 21564000;
      const unixTime = KeepaTimeUtils.keepaToUnix(keepaTime);

      // Should be (21564000 + 21564000) * 60000 = Unix timestamp
      expect(unixTime).toBe((21564000 + 21564000) * 60000);
    });

    it('should handle zero', () => {
      const unixTime = KeepaTimeUtils.keepaToUnix(0);
      expect(unixTime).toBe(21564000 * 60000);
    });
  });

  describe('unixToKeepa', () => {
    it('should convert Unix timestamp to Keepa timestamp', () => {
      const unixTime = (21564000 + 21564000) * 60000;
      const keepaTime = KeepaTimeUtils.unixToKeepa(unixTime);

      expect(keepaTime).toBe(21564000);
    });
  });

  describe('keepaToDate', () => {
    it('should convert Keepa timestamp to Date object', () => {
      const keepaTime = 21564000;
      const date = KeepaTimeUtils.keepaToDate(keepaTime);

      expect(date).toBeInstanceOf(Date);
      expect(date.getTime()).toBe((21564000 + 21564000) * 60000);
    });
  });

  describe('priceToDollars', () => {
    it('should convert cents to dollars', () => {
      expect(KeepaTimeUtils.priceToDollars(9999)).toBe(99.99);
      expect(KeepaTimeUtils.priceToDollars(100)).toBe(1);
      expect(KeepaTimeUtils.priceToDollars(0)).toBe(0);
    });

    it('should handle -1 (no price available)', () => {
      expect(KeepaTimeUtils.priceToDollars(-1)).toBe(-1);
    });

    it('should handle -2 (out of stock)', () => {
      expect(KeepaTimeUtils.priceToDollars(-2)).toBe(-2);
    });
  });
});
