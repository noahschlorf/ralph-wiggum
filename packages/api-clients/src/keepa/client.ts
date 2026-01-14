/**
 * Keepa API Client for Amazon price history
 * https://keepa.com/#!discuss/t/using-the-keepa-api/47
 */

export interface KeepaClientConfig {
  apiKey: string;
  domain?: KeepaAmazonDomain;
}

export type KeepaAmazonDomain = 'US' | 'UK' | 'DE' | 'FR' | 'JP' | 'CA' | 'IT' | 'ES' | 'IN' | 'MX';

const DOMAIN_IDS: Record<KeepaAmazonDomain, number> = {
  US: 1,
  UK: 2,
  DE: 3,
  FR: 4,
  JP: 5,
  CA: 6,
  IT: 8,
  ES: 9,
  IN: 10,
  MX: 11,
};

const BASE_URL = 'https://api.keepa.com';

/**
 * Keepa product data
 */
export interface KeepaProduct {
  asin: string;
  title: string;
  rootCategory?: number;
  manufacturer?: string;
  brand?: string;
  productGroup?: string;
  csv?: number[][];
  imagesCSV?: string;
  lastUpdate?: number;
  currentPrice?: number;
  lowestPrice?: number;
  highestPrice?: number;
  averagePrice?: number;
}

/**
 * Price history entry
 */
export interface KeepaPricePoint {
  timestamp: Date;
  price: number; // in dollars, -1 = unavailable, -2 = out of stock
}

/**
 * Price history result
 */
export interface KeepaPriceHistory {
  asin: string;
  title: string;
  priceHistory: KeepaPricePoint[];
  currentPrice?: number;
  lowestPrice?: number;
  highestPrice?: number;
  averagePrice?: number;
}

/**
 * Quota status
 */
export interface KeepaQuotaStatus {
  tokensLeft: number;
  refillIn: number; // milliseconds until next refill
  refillRate: number; // tokens per hour
  tokenFlowReduction?: number;
}

/**
 * Utility functions for Keepa timestamps and prices
 */
export class KeepaTimeUtils {
  private static readonly KEEPA_EPOCH = 21564000;

  /**
   * Convert Keepa timestamp to Unix timestamp (milliseconds)
   */
  static keepaToUnix(keepaTime: number): number {
    return (keepaTime + this.KEEPA_EPOCH) * 60000;
  }

  /**
   * Convert Unix timestamp (milliseconds) to Keepa timestamp
   */
  static unixToKeepa(unixTime: number): number {
    return Math.floor(unixTime / 60000) - this.KEEPA_EPOCH;
  }

  /**
   * Convert Keepa timestamp to Date object
   */
  static keepaToDate(keepaTime: number): Date {
    return new Date(this.keepaToUnix(keepaTime));
  }

  /**
   * Convert price from cents to dollars
   * -1 = price not available
   * -2 = out of stock
   */
  static priceToDollars(cents: number): number {
    if (cents < 0) return cents; // Keep -1 and -2 as-is
    return cents / 100;
  }
}

/**
 * Keepa API Client
 */
export class KeepaClient {
  private apiKey: string;
  private domainId: number;

  constructor(config: KeepaClientConfig) {
    this.apiKey = config.apiKey;
    this.domainId = DOMAIN_IDS[config.domain ?? 'US'];
  }

  /**
   * Get product data by ASIN
   */
  async getProduct(asin: string): Promise<KeepaProduct> {
    const products = await this.getProducts([asin]);
    const product = products[0];
    if (!product) {
      throw new Error('Product not found');
    }
    return product;
  }

  /**
   * Get multiple products by ASINs (max 100)
   */
  async getProducts(asins: string[]): Promise<KeepaProduct[]> {
    const url = new URL(`${BASE_URL}/product`);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('domain', String(this.domainId));
    url.searchParams.set('asin', asins.join(','));
    url.searchParams.set('history', '1'); // Include price history
    url.searchParams.set('rating', '1'); // Include ratings

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Keepa API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { products?: KeepaProduct[] };
    return data.products ?? [];
  }

  /**
   * Get price history for a product
   */
  async getPriceHistory(asin: string): Promise<KeepaPriceHistory> {
    const product = await this.getProduct(asin);
    const priceHistory = this.parsePriceHistory(product.csv);

    // Calculate price statistics
    const validPrices = priceHistory
      .map((p) => p.price)
      .filter((p) => p > 0);

    return {
      asin: product.asin,
      title: product.title,
      priceHistory,
      currentPrice: validPrices[validPrices.length - 1],
      lowestPrice: validPrices.length > 0 ? Math.min(...validPrices) : undefined,
      highestPrice: validPrices.length > 0 ? Math.max(...validPrices) : undefined,
      averagePrice:
        validPrices.length > 0
          ? validPrices.reduce((a, b) => a + b, 0) / validPrices.length
          : undefined,
    };
  }

  /**
   * Parse CSV price history data
   * CSV format: [type, [timestamp, price, timestamp, price, ...]]
   */
  private parsePriceHistory(csv: number[][] | undefined | null): KeepaPricePoint[] {
    if (!csv || !Array.isArray(csv)) return [];

    // Index 0 = Amazon price history
    const amazonPrices = csv[0];
    if (!amazonPrices || !Array.isArray(amazonPrices)) return [];

    const history: KeepaPricePoint[] = [];

    // Parse pairs of [timestamp, price]
    for (let i = 0; i < amazonPrices.length - 1; i += 2) {
      const keepaTime = amazonPrices[i];
      const priceCents = amazonPrices[i + 1];

      if (typeof keepaTime === 'number' && typeof priceCents === 'number') {
        history.push({
          timestamp: KeepaTimeUtils.keepaToDate(keepaTime),
          price: KeepaTimeUtils.priceToDollars(priceCents),
        });
      }
    }

    return history;
  }

  /**
   * Get current API quota status
   */
  async getQuotaStatus(): Promise<KeepaQuotaStatus> {
    const url = new URL(`${BASE_URL}/token`);
    url.searchParams.set('key', this.apiKey);

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Keepa API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      tokensLeft: number;
      refillIn: number;
      refillRate?: number;
      tokenFlowReduction?: number;
    };
    return {
      tokensLeft: data.tokensLeft,
      refillIn: data.refillIn,
      refillRate: data.refillRate ?? 5,
      tokenFlowReduction: data.tokenFlowReduction,
    };
  }

  /**
   * Search products by keyword (uses more tokens)
   */
  async searchProducts(keyword: string, limit: number = 10): Promise<KeepaProduct[]> {
    const url = new URL(`${BASE_URL}/search`);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('domain', String(this.domainId));
    url.searchParams.set('type', 'product');
    url.searchParams.set('term', keyword);
    url.searchParams.set('page', '0');

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Keepa API error: ${response.status}`);
    }

    const data = (await response.json()) as { asinList?: string[] };
    const asins = (data.asinList ?? []).slice(0, limit);

    if (asins.length === 0) return [];

    return this.getProducts(asins);
  }
}
