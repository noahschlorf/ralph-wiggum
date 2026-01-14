import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EbayClient, EbayClientConfig } from '../../src/ebay/client';
import { Marketplace } from '@arbitrage/shared';

// Mock ebay-api module
vi.mock('ebay-api', () => {
  const mockApi = vi.fn().mockImplementation(() => ({
    buy: {
      browse: {
        getItem: vi.fn(),
        search: vi.fn(),
        getItemByLegacyId: vi.fn(),
      },
    },
  }));

  // Add static properties
  mockApi.SiteId = {
    EBAY_US: 0,
    EBAY_UK: 3,
    EBAY_DE: 77,
  };

  return {
    default: mockApi,
  };
});

describe('EbayClient', () => {
  let client: EbayClient;
  const mockConfig: EbayClientConfig = {
    appId: 'test-app-id',
    certId: 'test-cert-id',
    sandbox: true,
  };

  beforeEach(() => {
    client = new EbayClient(mockConfig);
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client with config', () => {
      expect(client).toBeInstanceOf(EbayClient);
    });

    it('should default to production if sandbox not specified', () => {
      const prodClient = new EbayClient({
        appId: 'test',
        certId: 'test',
      });
      expect(prodClient).toBeInstanceOf(EbayClient);
    });
  });

  describe('getItem', () => {
    it('should fetch item by ID and return normalized listing', async () => {
      const mockItem = {
        itemId: 'v1|123456789|0',
        title: 'iPhone 14 Pro Max',
        price: { value: '899.99', currency: 'USD' },
        condition: 'New',
        seller: { username: 'test_seller', feedbackPercentage: '99.5' },
        itemLocation: { city: 'New York', stateOrProvince: 'NY' },
        image: { imageUrl: 'https://example.com/image.jpg' },
        itemWebUrl: 'https://ebay.com/itm/123456789',
      };

      const mockGetItem = vi.fn().mockResolvedValue(mockItem);
      (client as any).api.buy.browse.getItem = mockGetItem;

      const result = await client.getItem('123456789');

      expect(mockGetItem).toHaveBeenCalledWith('v1|123456789|0');
      expect(result).toMatchObject({
        externalId: '123456789',
        marketplace: Marketplace.EBAY,
        title: 'iPhone 14 Pro Max',
        price: 899.99,
        currency: 'USD',
      });
    });

    it('should handle item not found', async () => {
      const mockGetItem = vi.fn().mockRejectedValue(new Error('Item not found'));
      (client as any).api.buy.browse.getItem = mockGetItem;

      await expect(client.getItem('nonexistent')).rejects.toThrow('Item not found');
    });

    it('should parse legacy item IDs', async () => {
      const mockItem = {
        itemId: 'v1|999999999|0',
        title: 'Test Item',
        price: { value: '50.00', currency: 'USD' },
        itemWebUrl: 'https://ebay.com/itm/999999999',
      };

      const mockGetItem = vi.fn().mockResolvedValue(mockItem);
      (client as any).api.buy.browse.getItem = mockGetItem;

      await client.getItem('999999999');

      expect(mockGetItem).toHaveBeenCalledWith('v1|999999999|0');
    });
  });

  describe('search', () => {
    it('should search items with query', async () => {
      const mockSearchResult = {
        itemSummaries: [
          {
            itemId: 'v1|111|0',
            title: 'Item 1',
            price: { value: '100.00', currency: 'USD' },
            itemWebUrl: 'https://ebay.com/itm/111',
          },
          {
            itemId: 'v1|222|0',
            title: 'Item 2',
            price: { value: '200.00', currency: 'USD' },
            itemWebUrl: 'https://ebay.com/itm/222',
          },
        ],
        total: 2,
        next: null,
      };

      const mockSearch = vi.fn().mockResolvedValue(mockSearchResult);
      (client as any).api.buy.browse.search = mockSearch;

      const result = await client.search({ query: 'iphone' });

      expect(mockSearch).toHaveBeenCalled();
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should apply price filters', async () => {
      const mockSearchResult = { itemSummaries: [], total: 0 };
      const mockSearch = vi.fn().mockResolvedValue(mockSearchResult);
      (client as any).api.buy.browse.search = mockSearch;

      await client.search({
        query: 'laptop',
        minPrice: 500,
        maxPrice: 1000,
      });

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'laptop',
          filter: expect.stringContaining('price'),
        })
      );
    });

    it('should handle empty results', async () => {
      const mockSearchResult = { itemSummaries: [], total: 0 };
      const mockSearch = vi.fn().mockResolvedValue(mockSearchResult);
      (client as any).api.buy.browse.search = mockSearch;

      const result = await client.search({ query: 'nonexistent12345' });

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should support pagination', async () => {
      const mockSearchResult = {
        itemSummaries: [{ itemId: 'v1|333|0', title: 'Item 3', price: { value: '50.00' }, itemWebUrl: 'https://ebay.com/itm/333' }],
        total: 100,
        offset: 20,
        limit: 10,
      };
      const mockSearch = vi.fn().mockResolvedValue(mockSearchResult);
      (client as any).api.buy.browse.search = mockSearch;

      await client.search({ query: 'shoes', limit: 10, offset: 20 });

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 20,
        })
      );
    });
  });

  describe('normalizeItem', () => {
    it('should normalize eBay item to Listing format', () => {
      const ebayItem = {
        itemId: 'v1|123|0',
        title: 'Test Product',
        price: { value: '150.00', currency: 'USD' },
        condition: 'Like New',
        conditionDescription: 'Barely used, mint condition',
        seller: {
          username: 'great_seller',
          feedbackPercentage: '98.5',
        },
        itemLocation: {
          city: 'Los Angeles',
          stateOrProvince: 'CA',
          country: 'US',
        },
        image: { imageUrl: 'https://example.com/main.jpg' },
        additionalImages: [
          { imageUrl: 'https://example.com/img2.jpg' },
          { imageUrl: 'https://example.com/img3.jpg' },
        ],
        itemWebUrl: 'https://ebay.com/itm/123',
        shortDescription: 'A great product',
      };

      const normalized = (client as any).normalizeItem(ebayItem);

      expect(normalized).toMatchObject({
        externalId: '123',
        marketplace: 'EBAY',
        title: 'Test Product',
        price: 150,
        currency: 'USD',
        condition: 'LIKE_NEW',
        location: 'Los Angeles, CA',
        sellerName: 'great_seller',
        sellerRating: 4.93, // 98.5% -> 5 star scale
        listingUrl: 'https://ebay.com/itm/123',
      });
      expect(normalized.imageUrls).toHaveLength(3);
    });

    it('should handle missing optional fields', () => {
      const minimalItem = {
        itemId: 'v1|456|0',
        title: 'Minimal Item',
        price: { value: '25.00', currency: 'USD' },
        itemWebUrl: 'https://ebay.com/itm/456',
      };

      const normalized = (client as any).normalizeItem(minimalItem);

      expect(normalized.externalId).toBe('456');
      expect(normalized.title).toBe('Minimal Item');
      expect(normalized.price).toBe(25);
      expect(normalized.condition).toBeUndefined();
      expect(normalized.sellerName).toBeUndefined();
      expect(normalized.imageUrls).toEqual([]);
    });
  });

  describe('mapCondition', () => {
    const conditionTests = [
      { input: 'New', expected: 'NEW' },
      { input: 'New with tags', expected: 'NEW' },
      { input: 'New other', expected: 'LIKE_NEW' },
      { input: 'Open box', expected: 'LIKE_NEW' },
      { input: 'Certified refurbished', expected: 'GOOD' },
      { input: 'Excellent - Refurbished', expected: 'GOOD' },
      { input: 'Very Good', expected: 'GOOD' },
      { input: 'Good', expected: 'GOOD' },
      { input: 'Acceptable', expected: 'FAIR' },
      { input: 'For parts or not working', expected: 'POOR' },
    ];

    conditionTests.forEach(({ input, expected }) => {
      it(`should map "${input}" to ${expected}`, () => {
        const result = (client as any).mapCondition(input);
        expect(result).toBe(expected);
      });
    });
  });

  describe('error handling', () => {
    it('should wrap API errors with context', async () => {
      const mockGetItem = vi.fn().mockRejectedValue(new Error('API rate limit exceeded'));
      (client as any).api.buy.browse.getItem = mockGetItem;

      await expect(client.getItem('123')).rejects.toThrow('API rate limit exceeded');
    });
  });
});
