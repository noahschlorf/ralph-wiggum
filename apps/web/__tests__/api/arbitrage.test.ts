import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../../src/app/api/arbitrage/route';

// Mock Prisma client
vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    arbitrageOpportunity: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    scrapedListing: {
      findMany: vi.fn(),
    },
  },
}));

// Mock ArbitrageEngine
vi.mock('../../src/services/arbitrage/engine', () => ({
  ArbitrageEngine: vi.fn().mockImplementation(() => ({
    findArbitrageOpportunities: vi.fn().mockReturnValue([
      {
        sourceMarketplace: 'FACEBOOK',
        targetMarketplace: 'EBAY',
        sourcePrice: 100,
        targetPrice: 180,
        grossProfit: 80,
        fees: 23.4,
        shippingCost: 10,
        netProfit: 46.6,
        profitMargin: 25.89,
        roi: 46.6,
        sourceListing: { listingId: 'fb-1' },
        targetListing: { listingId: 'ebay-1' },
      },
    ]),
  })),
}));

import { prisma } from '../../src/lib/prisma';

describe('Arbitrage API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/arbitrage', () => {
    it('should return saved arbitrage opportunities', async () => {
      const mockOpportunities = [
        {
          id: '1',
          sourceMarketplace: 'FACEBOOK',
          targetMarketplace: 'EBAY',
          sourcePrice: 100,
          targetPrice: 180,
          netProfit: 46.6,
          profitMargin: 25.89,
          status: 'ACTIVE',
          createdAt: new Date(),
        },
      ];

      (prisma.arbitrageOpportunity.findMany as any).mockResolvedValue(mockOpportunities);

      const request = new NextRequest('http://localhost:3000/api/arbitrage');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.opportunities).toHaveLength(1);
      expect(data.opportunities[0].sourceMarketplace).toBe('FACEBOOK');
    });

    it('should filter by minimum profit margin', async () => {
      (prisma.arbitrageOpportunity.findMany as any).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/arbitrage?minProfitMargin=20');
      const response = await GET(request);

      expect(prisma.arbitrageOpportunity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            profitMargin: expect.objectContaining({
              gte: 20,
            }),
          }),
        })
      );
    });

    it('should filter by status', async () => {
      (prisma.arbitrageOpportunity.findMany as any).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/arbitrage?status=ACTIVE');
      const response = await GET(request);

      expect(prisma.arbitrageOpportunity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
          }),
        })
      );
    });
  });

  describe('POST /api/arbitrage', () => {
    it('should analyze listings and find opportunities', async () => {
      const mockListings = [
        {
          id: '1',
          externalId: 'fb-1',
          marketplace: 'FACEBOOK',
          title: 'iPhone 14',
          price: 100,
          listingUrl: 'https://facebook.com/1',
        },
        {
          id: '2',
          externalId: 'ebay-1',
          marketplace: 'EBAY',
          title: 'iPhone 14 Pro',
          price: 180,
          listingUrl: 'https://ebay.com/1',
        },
      ];

      (prisma.scrapedListing.findMany as any).mockResolvedValue(mockListings);
      (prisma.arbitrageOpportunity.create as any).mockResolvedValue({
        id: '1',
        sourceMarketplace: 'FACEBOOK',
        targetMarketplace: 'EBAY',
        sourcePrice: 100,
        targetPrice: 180,
        netProfit: 46.6,
        profitMargin: 25.89,
      });

      const request = new NextRequest('http://localhost:3000/api/arbitrage', {
        method: 'POST',
        body: JSON.stringify({
          sourceMarketplaces: ['FACEBOOK', 'CRAIGSLIST', 'OFFERUP'],
          targetMarketplaces: ['EBAY', 'AMAZON'],
          minProfitMargin: 10,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.opportunities).toBeDefined();
      expect(data.opportunitiesFound).toBeGreaterThanOrEqual(0);
    });

    it('should save discovered opportunities', async () => {
      const mockListings = [
        {
          id: '1',
          externalId: 'fb-1',
          marketplace: 'FACEBOOK',
          title: 'MacBook',
          price: 500,
          listingUrl: 'https://facebook.com/1',
        },
        {
          id: '2',
          externalId: 'ebay-1',
          marketplace: 'EBAY',
          title: 'MacBook Pro',
          price: 900,
          listingUrl: 'https://ebay.com/1',
        },
      ];

      (prisma.scrapedListing.findMany as any).mockResolvedValue(mockListings);
      (prisma.arbitrageOpportunity.create as any).mockImplementation((data: any) => ({
        id: '1',
        ...data.data,
      }));

      const request = new NextRequest('http://localhost:3000/api/arbitrage', {
        method: 'POST',
        body: JSON.stringify({
          sourceMarketplaces: ['FACEBOOK'],
          targetMarketplaces: ['EBAY'],
          saveResults: true,
        }),
      });

      const response = await POST(request);

      expect(prisma.arbitrageOpportunity.create).toHaveBeenCalled();
    });
  });
});
