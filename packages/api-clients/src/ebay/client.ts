import eBayApi from 'ebay-api';
import { Marketplace, type ListingCondition } from '@arbitrage/shared';

/**
 * eBay API Client configuration
 */
export interface EbayClientConfig {
  appId: string;
  certId: string;
  sandbox?: boolean;
  siteId?: number;
}

/**
 * Search parameters for eBay Browse API
 */
export interface EbaySearchParams {
  query: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: string[];
  limit?: number;
  offset?: number;
  sort?: 'price' | '-price' | 'newlyListed' | 'endingSoonest';
}

/**
 * Normalized listing from eBay
 */
export interface EbayListing {
  externalId: string;
  marketplace: typeof Marketplace.EBAY;
  title: string;
  description?: string;
  price: number;
  currency: string;
  condition?: ListingCondition;
  location?: string;
  sellerName?: string;
  sellerRating?: number;
  imageUrls: string[];
  listingUrl: string;
  scrapedAt: Date;
}

/**
 * Search results from eBay
 */
export interface EbaySearchResult {
  items: EbayListing[];
  total: number;
  offset?: number;
  limit?: number;
  hasMore: boolean;
}

/**
 * eBay Browse API Client
 * Wraps the ebay-api library with normalized output
 */
export class EbayClient {
  private api: eBayApi;

  constructor(config: EbayClientConfig) {
    this.api = new eBayApi({
      appId: config.appId,
      certId: config.certId,
      sandbox: config.sandbox ?? false,
      siteId: config.siteId ?? eBayApi.SiteId.EBAY_US,
    });
  }

  /**
   * Get a single item by eBay item ID
   */
  async getItem(itemId: string): Promise<EbayListing> {
    // Format item ID for Browse API (v1|{itemId}|0)
    const formattedId = itemId.startsWith('v1|') ? itemId : `v1|${itemId}|0`;

    const item = await this.api.buy.browse.getItem(formattedId);
    return this.normalizeItem(item);
  }

  /**
   * Search for items on eBay
   */
  async search(params: EbaySearchParams): Promise<EbaySearchResult> {
    const searchParams: Record<string, unknown> = {
      q: params.query,
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
    };

    // Build filter string
    const filters: string[] = [];

    if (params.minPrice !== undefined || params.maxPrice !== undefined) {
      const priceFilter = this.buildPriceFilter(params.minPrice, params.maxPrice);
      if (priceFilter) filters.push(priceFilter);
    }

    if (params.categoryId) {
      filters.push(`categoryId:${params.categoryId}`);
    }

    if (params.condition && params.condition.length > 0) {
      filters.push(`conditions:{${params.condition.join('|')}}`);
    }

    if (filters.length > 0) {
      searchParams.filter = filters.join(',');
    }

    if (params.sort) {
      searchParams.sort = params.sort;
    }

    const result = await this.api.buy.browse.search(searchParams);

    const items = (result.itemSummaries ?? []).map((item: unknown) =>
      this.normalizeItem(item)
    );

    return {
      items,
      total: result.total ?? 0,
      offset: result.offset,
      limit: result.limit,
      hasMore: items.length > 0 && (result.offset ?? 0) + items.length < (result.total ?? 0),
    };
  }

  /**
   * Build price filter string for eBay API
   */
  private buildPriceFilter(min?: number, max?: number): string | null {
    if (min !== undefined && max !== undefined) {
      return `price:[${min}..${max}],priceCurrency:USD`;
    }
    if (min !== undefined) {
      return `price:[${min}..],priceCurrency:USD`;
    }
    if (max !== undefined) {
      return `price:[..${max}],priceCurrency:USD`;
    }
    return null;
  }

  /**
   * Normalize eBay item to standard listing format
   */
  private normalizeItem(item: any): EbayListing {
    const itemId = this.extractItemId(item.itemId);
    const images = this.extractImages(item);
    const location = this.formatLocation(item.itemLocation);
    const sellerRating = this.parseSellerRating(item.seller?.feedbackPercentage);

    return {
      externalId: itemId,
      marketplace: Marketplace.EBAY,
      title: item.title,
      description: item.shortDescription ?? item.description,
      price: parseFloat(item.price?.value ?? '0'),
      currency: item.price?.currency ?? 'USD',
      condition: this.mapCondition(item.condition ?? item.conditionDescription),
      location,
      sellerName: item.seller?.username,
      sellerRating,
      imageUrls: images,
      listingUrl: item.itemWebUrl,
      scrapedAt: new Date(),
    };
  }

  /**
   * Extract numeric item ID from eBay's formatted ID
   */
  private extractItemId(formattedId: string): string {
    // Format: v1|{itemId}|{variantId}
    const match = formattedId.match(/v1\|(\d+)\|/);
    return match?.[1] ?? formattedId;
  }

  /**
   * Extract all image URLs from item
   */
  private extractImages(item: any): string[] {
    const images: string[] = [];

    if (item.image?.imageUrl) {
      images.push(item.image.imageUrl);
    }

    if (item.additionalImages) {
      for (const img of item.additionalImages) {
        if (img.imageUrl) {
          images.push(img.imageUrl);
        }
      }
    }

    return images;
  }

  /**
   * Format location from eBay location object
   */
  private formatLocation(location: any): string | undefined {
    if (!location) return undefined;

    const parts: string[] = [];
    if (location.city) parts.push(location.city);
    if (location.stateOrProvince) parts.push(location.stateOrProvince);

    return parts.length > 0 ? parts.join(', ') : undefined;
  }

  /**
   * Parse seller feedback percentage to 5-star rating
   */
  private parseSellerRating(feedbackPercentage: string | undefined): number | undefined {
    if (!feedbackPercentage) return undefined;

    const percentage = parseFloat(feedbackPercentage);
    if (isNaN(percentage)) return undefined;

    // Convert percentage to 5-star scale
    // 90% = 4.5, 100% = 5.0
    return Math.round((percentage / 100) * 5 * 100) / 100;
  }

  /**
   * Map eBay condition string to standard condition enum
   */
  private mapCondition(conditionStr: string | undefined): ListingCondition | undefined {
    if (!conditionStr) return undefined;

    const lower = conditionStr.toLowerCase();

    // New conditions
    if (lower === 'new' || lower.includes('new with')) {
      return 'NEW';
    }

    // Like New conditions
    if (
      lower.includes('new other') ||
      lower.includes('open box') ||
      lower.includes('like new')
    ) {
      return 'LIKE_NEW';
    }

    // Good conditions
    if (
      lower.includes('refurbished') ||
      lower.includes('very good') ||
      lower.includes('excellent') ||
      lower === 'good'
    ) {
      return 'GOOD';
    }

    // Fair conditions
    if (lower.includes('acceptable') || lower.includes('fair')) {
      return 'FAIR';
    }

    // Poor conditions
    if (lower.includes('for parts') || lower.includes('not working')) {
      return 'POOR';
    }

    return undefined;
  }
}
