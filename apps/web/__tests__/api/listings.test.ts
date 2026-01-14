import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../../src/app/api/listings/route';

// Mock Prisma client
vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    scrapedListing: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from '../../src/lib/prisma';

describe('Listings API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/listings', () => {
    it('should return paginated listings', async () => {
      const mockListings = [
        {
          id: '1',
          externalId: 'ebay-123',
          marketplace: 'EBAY',
          title: 'iPhone 14',
          price: 899,
          currency: 'USD',
          createdAt: new Date(),
        },
        {
          id: '2',
          externalId: 'fb-456',
          marketplace: 'FACEBOOK',
          title: 'MacBook Pro',
          price: 1500,
          currency: 'USD',
          createdAt: new Date(),
        },
      ];

      (prisma.scrapedListing.findMany as any).mockResolvedValue(mockListings);

      const request = new NextRequest('http://localhost:3000/api/listings');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.listings).toHaveLength(2);
      expect(data.listings[0].externalId).toBe('ebay-123');
    });

    it('should filter by marketplace', async () => {
      const mockListings = [
        {
          id: '1',
          externalId: 'ebay-123',
          marketplace: 'EBAY',
          title: 'iPhone 14',
          price: 899,
        },
      ];

      (prisma.scrapedListing.findMany as any).mockResolvedValue(mockListings);

      const request = new NextRequest('http://localhost:3000/api/listings?marketplace=EBAY');
      const response = await GET(request);
      const data = await response.json();

      expect(prisma.scrapedListing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            marketplace: 'EBAY',
          }),
        })
      );
      expect(data.listings).toHaveLength(1);
    });

    it('should support search by title', async () => {
      const mockListings = [
        {
          id: '1',
          externalId: 'ebay-123',
          marketplace: 'EBAY',
          title: 'iPhone 14 Pro',
          price: 999,
        },
      ];

      (prisma.scrapedListing.findMany as any).mockResolvedValue(mockListings);

      const request = new NextRequest('http://localhost:3000/api/listings?search=iphone');
      const response = await GET(request);

      expect(prisma.scrapedListing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            title: expect.objectContaining({
              contains: 'iphone',
              mode: 'insensitive',
            }),
          }),
        })
      );
    });

    it('should support price range filter', async () => {
      (prisma.scrapedListing.findMany as any).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/listings?minPrice=100&maxPrice=500');
      const response = await GET(request);

      expect(prisma.scrapedListing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            price: expect.objectContaining({
              gte: 100,
              lte: 500,
            }),
          }),
        })
      );
    });
  });

  describe('POST /api/listings', () => {
    it('should create a new listing', async () => {
      const newListing = {
        externalId: 'fb-789',
        marketplace: 'FACEBOOK',
        title: 'PlayStation 5',
        price: 450,
        currency: 'USD',
        listingUrl: 'https://facebook.com/marketplace/item/789',
      };

      (prisma.scrapedListing.create as any).mockResolvedValue({
        id: '3',
        ...newListing,
        createdAt: new Date(),
      });

      const request = new NextRequest('http://localhost:3000/api/listings', {
        method: 'POST',
        body: JSON.stringify(newListing),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.externalId).toBe('fb-789');
      expect(data.title).toBe('PlayStation 5');
    });

    it('should validate required fields', async () => {
      const invalidListing = {
        marketplace: 'FACEBOOK',
        // Missing required fields: externalId, title, price
      };

      const request = new NextRequest('http://localhost:3000/api/listings', {
        method: 'POST',
        body: JSON.stringify(invalidListing),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should upsert if listing already exists', async () => {
      const existingListing = {
        externalId: 'ebay-123',
        marketplace: 'EBAY',
        title: 'iPhone 14 Pro',
        price: 899,
        currency: 'USD',
        listingUrl: 'https://ebay.com/itm/123',
      };

      (prisma.scrapedListing.findUnique as any).mockResolvedValue({
        id: '1',
        ...existingListing,
      });

      (prisma.scrapedListing.update as any).mockResolvedValue({
        id: '1',
        ...existingListing,
        price: 850, // Updated price
      });

      const request = new NextRequest('http://localhost:3000/api/listings', {
        method: 'POST',
        body: JSON.stringify({ ...existingListing, price: 850 }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });
});
