import { NextRequest, NextResponse } from 'next/server';
import { Prisma, OpportunityStatus } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { ArbitrageEngine, PriceSource } from '../../../services/arbitrage/engine';
import { z } from 'zod';
import type { Marketplace } from '@arbitrage/shared';

const marketplaces = ['EBAY', 'AMAZON', 'FACEBOOK', 'CRAIGSLIST', 'OFFERUP', 'MERCARI', 'POSHMARK'] as const;

// Validation schema for analysis request
const analyzeSchema = z.object({
  sourceMarketplaces: z.array(z.enum(marketplaces)).optional(),
  targetMarketplaces: z.array(z.enum(marketplaces)).optional(),
  minProfitMargin: z.number().min(0).optional(),
  shippingCost: z.number().min(0).optional(),
  saveResults: z.boolean().optional(),
});

/**
 * GET /api/arbitrage
 * Fetch saved arbitrage opportunities
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query params
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const minProfitMargin = searchParams.get('minProfitMargin');
    const status = searchParams.get('status');

    // Build where clause
    const where: Prisma.ArbitrageOpportunityWhereInput = {};

    if (minProfitMargin) {
      where.profitMargin = { gte: parseFloat(minProfitMargin) };
    }

    if (status && Object.values(OpportunityStatus).includes(status as OpportunityStatus)) {
      where.status = status as OpportunityStatus;
    }

    // Fetch opportunities
    const opportunities = await prisma.arbitrageOpportunity.findMany({
      where,
      orderBy: { profitMargin: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        sourceListing: true,
      },
    });

    return NextResponse.json({
      opportunities,
      page,
      limit,
    });
  } catch (error) {
    console.error('Error fetching arbitrage opportunities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch arbitrage opportunities' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/arbitrage
 * Analyze listings and find arbitrage opportunities
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const result = analyzeSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.issues },
        { status: 400 }
      );
    }

    const {
      sourceMarketplaces = ['FACEBOOK', 'CRAIGSLIST', 'OFFERUP'],
      targetMarketplaces = ['EBAY', 'AMAZON'],
      minProfitMargin = 10,
      shippingCost = 0,
      saveResults = false,
    } = result.data;

    // Fetch listings from database
    const listings = await prisma.scrapedListing.findMany({
      where: {
        marketplace: {
          in: [...sourceMarketplaces, ...targetMarketplaces] as Marketplace[],
        },
      },
      orderBy: { scrapedAt: 'desc' },
      take: 1000, // Limit for performance
    });

    // Convert to PriceSource format with database IDs
    type PriceSourceWithDbId = PriceSource & { dbId: string };

    const sources: PriceSourceWithDbId[] = listings
      .filter((l) => (sourceMarketplaces as readonly string[]).includes(l.marketplace))
      .map((l) => ({
        marketplace: l.marketplace as Marketplace,
        price: l.price,
        listingId: l.externalId,
        title: l.title,
        url: l.listingUrl,
        condition: l.condition || undefined,
        images: l.imageUrls,
        dbId: l.id,
      }));

    const targets: PriceSourceWithDbId[] = listings
      .filter((l) => (targetMarketplaces as readonly string[]).includes(l.marketplace))
      .map((l) => ({
        marketplace: l.marketplace as Marketplace,
        price: l.price,
        listingId: l.externalId,
        title: l.title,
        url: l.listingUrl,
        condition: l.condition || undefined,
        images: l.imageUrls,
        dbId: l.id,
      }));

    // Find opportunities
    const engine = new ArbitrageEngine();
    const opportunities = engine.findArbitrageOpportunities(sources, targets, {
      minProfitMargin,
      shippingCost,
    });

    // Save results if requested
    if (saveResults && opportunities.length > 0) {
      for (const opp of opportunities) {
        // Get the database ID from our extended source listing
        const sourceListingWithDbId = opp.sourceListing as PriceSourceWithDbId;
        await prisma.arbitrageOpportunity.create({
          data: {
            sourceListingId: sourceListingWithDbId.dbId,
            targetMarketplace: opp.targetMarketplace,
            estimatedSellPrice: opp.targetPrice,
            purchasePrice: opp.sourcePrice,
            platformFees: opp.fees,
            shippingCost: opp.shippingCost,
            estimatedProfit: opp.netProfit,
            profitMargin: opp.profitMargin,
            confidence: 0.8, // Default confidence score
            status: 'ACTIVE',
          },
        });
      }
    }

    return NextResponse.json({
      opportunities,
      opportunitiesFound: opportunities.length,
      sourcesAnalyzed: sources.length,
      targetsAnalyzed: targets.length,
    });
  } catch (error) {
    console.error('Error analyzing arbitrage opportunities:', error);
    return NextResponse.json(
      { error: 'Failed to analyze arbitrage opportunities' },
      { status: 500 }
    );
  }
}
