import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { z } from 'zod';

const conditionEnum = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR'] as const;

// Validation schema for listing creation
const createListingSchema = z.object({
  externalId: z.string().min(1),
  marketplace: z.enum(['EBAY', 'AMAZON', 'FACEBOOK', 'CRAIGSLIST', 'OFFERUP', 'MERCARI', 'POSHMARK']),
  title: z.string().min(1),
  price: z.number().min(0),
  currency: z.string().default('USD'),
  description: z.string().optional(),
  condition: z.enum(conditionEnum).optional(),
  location: z.string().optional(),
  sellerName: z.string().optional(),
  sellerRating: z.number().optional(),
  imageUrls: z.array(z.string()).optional(),
  listingUrl: z.string().url(),
});

/**
 * GET /api/listings
 * Fetch paginated listings with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query params
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const marketplace = searchParams.get('marketplace');
    const search = searchParams.get('search');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');

    // Build where clause
    const where: Prisma.ScrapedListingWhereInput = {};

    if (marketplace) {
      where.marketplace = marketplace as Prisma.EnumMarketplaceFilter;
    }

    if (search) {
      where.title = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (minPrice || maxPrice) {
      const priceFilter: Prisma.FloatFilter = {};
      if (minPrice) priceFilter.gte = parseFloat(minPrice);
      if (maxPrice) priceFilter.lte = parseFloat(maxPrice);
      where.price = priceFilter;
    }

    // Fetch listings
    const listings = await prisma.scrapedListing.findMany({
      where,
      orderBy: { scrapedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return NextResponse.json({
      listings,
      page,
      limit,
    });
  } catch (error) {
    console.error('Error fetching listings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch listings' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/listings
 * Create or update a listing
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const result = createListingSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.issues },
        { status: 400 }
      );
    }

    const data = result.data;

    // Check if listing already exists
    const existing = await prisma.scrapedListing.findUnique({
      where: {
        externalId_marketplace: {
          externalId: data.externalId,
          marketplace: data.marketplace,
        },
      },
    });

    if (existing) {
      // Update existing listing
      const updated = await prisma.scrapedListing.update({
        where: { id: existing.id },
        data: {
          title: data.title,
          price: data.price,
          description: data.description,
          condition: data.condition,
          location: data.location,
          sellerName: data.sellerName,
          sellerRating: data.sellerRating,
          imageUrls: data.imageUrls,
          listingUrl: data.listingUrl,
        },
      });

      return NextResponse.json(updated, { status: 200 });
    }

    // Create new listing
    // TODO: Get userId from auth session
    const userId = 'system'; // Placeholder for extension scraping
    const listing = await prisma.scrapedListing.create({
      data: {
        externalId: data.externalId,
        marketplace: data.marketplace,
        title: data.title,
        price: data.price,
        currency: data.currency,
        description: data.description,
        condition: data.condition,
        location: data.location,
        sellerName: data.sellerName,
        sellerRating: data.sellerRating,
        imageUrls: data.imageUrls || [],
        listingUrl: data.listingUrl,
        userId,
      },
    });

    return NextResponse.json(listing, { status: 201 });
  } catch (error) {
    console.error('Error creating listing:', error);
    return NextResponse.json(
      { error: 'Failed to create listing' },
      { status: 500 }
    );
  }
}
