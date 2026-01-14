import type { Marketplace } from '@arbitrage/shared';

/**
 * Price source from a marketplace listing
 */
export interface PriceSource {
  marketplace: Marketplace;
  price: number;
  listingId: string;
  title: string;
  url: string;
  condition?: string;
  images?: string[];
}

/**
 * Arbitrage opportunity between two listings
 */
export interface ArbitrageOpportunity {
  sourceMarketplace: Marketplace;
  targetMarketplace: Marketplace;
  sourcePrice: number;
  targetPrice: number;
  grossProfit: number;
  fees: number;
  shippingCost: number;
  netProfit: number;
  profitMargin: number;
  roi: number;
  sourceListing: PriceSource;
  targetListing: PriceSource;
}

/**
 * Options for finding arbitrage opportunities
 */
export interface ArbitrageOptions {
  minProfitMargin?: number;
  shippingCost?: number;
  sortBy?: 'profit' | 'profitMargin' | 'roi';
  similarityThreshold?: number;
}

/**
 * Marketplace fee structures
 */
const MARKETPLACE_FEES: Record<Marketplace, { percent: number; flat: number }> = {
  EBAY: { percent: 13, flat: 0 },
  AMAZON: { percent: 15, flat: 0 },
  MERCARI: { percent: 10, flat: 0 },
  POSHMARK: { percent: 20, flat: 0 }, // 20% for items over $15
  FACEBOOK: { percent: 0, flat: 0 },
  CRAIGSLIST: { percent: 0, flat: 0 },
  OFFERUP: { percent: 0, flat: 0 },
};

/**
 * Arbitrage detection engine
 * Finds profitable opportunities between marketplaces
 */
export class ArbitrageEngine {
  /**
   * Find arbitrage opportunities between source and target listings
   */
  findArbitrageOpportunities(
    sources: PriceSource[],
    targets: PriceSource[],
    options: ArbitrageOptions = {}
  ): ArbitrageOpportunity[] {
    const {
      minProfitMargin = 0,
      shippingCost = 0,
      sortBy = 'profitMargin',
    } = options;

    const opportunities: ArbitrageOpportunity[] = [];

    for (const source of sources) {
      // Find matching targets
      const matchedTargets = this.matchListings(source, targets, {
        threshold: options.similarityThreshold ?? 0.5,
      });

      for (const target of matchedTargets) {
        if (target.price <= source.price) continue;

        const grossProfit = target.price - source.price;
        const fees = this.calculateMarketplaceFee(target.marketplace, target.price);
        const netProfit = grossProfit - fees - shippingCost;
        const profitMargin = (netProfit / target.price) * 100;
        const roi = (netProfit / source.price) * 100;

        if (profitMargin < minProfitMargin) continue;

        opportunities.push({
          sourceMarketplace: source.marketplace,
          targetMarketplace: target.marketplace,
          sourcePrice: source.price,
          targetPrice: target.price,
          grossProfit,
          fees,
          shippingCost,
          netProfit,
          profitMargin,
          roi,
          sourceListing: source,
          targetListing: target,
        });
      }
    }

    return this.sortOpportunities(opportunities, sortBy);
  }

  /**
   * Calculate marketplace selling fees
   */
  calculateMarketplaceFee(marketplace: Marketplace, price: number): number {
    const feeStructure = MARKETPLACE_FEES[marketplace];
    if (!feeStructure) return 0;

    return (price * feeStructure.percent) / 100 + feeStructure.flat;
  }

  /**
   * Match a source listing to similar target listings
   */
  matchListings(
    source: PriceSource,
    targets: PriceSource[],
    options: { threshold?: number } = {}
  ): PriceSource[] {
    const threshold = options.threshold ?? 0.5;

    return targets.filter((target) => {
      const similarity = this.calculateTitleSimilarity(source.title, target.title);
      return similarity >= threshold;
    });
  }

  /**
   * Calculate similarity between two titles (Jaccard index)
   */
  private calculateTitleSimilarity(title1: string, title2: string): number {
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 2);

    const words1 = new Set(normalize(title1));
    const words2 = new Set(normalize(title2));

    const intersection = new Set([...words1].filter((w) => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    if (union.size === 0) return 0;

    return intersection.size / union.size;
  }

  /**
   * Sort opportunities by specified criteria
   */
  private sortOpportunities(
    opportunities: ArbitrageOpportunity[],
    sortBy: 'profit' | 'profitMargin' | 'roi'
  ): ArbitrageOpportunity[] {
    return [...opportunities].sort((a, b) => {
      switch (sortBy) {
        case 'profit':
          return b.netProfit - a.netProfit;
        case 'profitMargin':
          return b.profitMargin - a.profitMargin;
        case 'roi':
          return b.roi - a.roi;
        default:
          return b.profitMargin - a.profitMargin;
      }
    });
  }

  /**
   * Calculate ROI for an opportunity
   */
  calculateROI(opportunity: ArbitrageOpportunity): number {
    return (opportunity.netProfit / opportunity.sourcePrice) * 100;
  }

  /**
   * Filter opportunities by minimum net profit
   */
  filterByMinProfit(
    opportunities: ArbitrageOpportunity[],
    minProfit: number
  ): ArbitrageOpportunity[] {
    return opportunities.filter((opp) => opp.netProfit >= minProfit);
  }
}

export default ArbitrageEngine;
