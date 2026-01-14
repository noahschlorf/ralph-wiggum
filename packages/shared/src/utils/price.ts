import { Marketplace } from '../types/marketplace';

/**
 * Marketplace fee percentages
 */
const MARKETPLACE_FEES: Record<Marketplace, number> = {
  [Marketplace.EBAY]: 0.1325, // 13.25%
  [Marketplace.MERCARI]: 0.1, // 10%
  [Marketplace.POSHMARK]: 0.2, // 20%
  [Marketplace.AMAZON]: 0.15, // 15% (varies by category)
  [Marketplace.FACEBOOK]: 0, // Free for local
  [Marketplace.CRAIGSLIST]: 0, // Free
  [Marketplace.OFFERUP]: 0, // Free for local
};

/**
 * Round to specified decimal places
 */
function round(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Calculate the marketplace fee for a given price
 * @param price - Sale price
 * @param marketplace - Target marketplace
 * @returns Fee amount
 */
export function calculateMarketplaceFee(
  price: number,
  marketplace: Marketplace
): number {
  if (price <= 0) return 0;
  const feeRate = MARKETPLACE_FEES[marketplace] ?? 0;
  return round(price * feeRate);
}

/**
 * Shipping cost tiers based on weight (lbs)
 */
const SHIPPING_TIERS = [
  { maxWeight: 0, cost: 0 },
  { maxWeight: 1, cost: 4.99 },
  { maxWeight: 3, cost: 8.99 },
  { maxWeight: 5, cost: 12.99 },
  { maxWeight: 10, cost: 18.99 },
  { maxWeight: 20, cost: 24.99 },
  { maxWeight: Infinity, cost: 34.99 },
];

/**
 * Calculate estimated shipping cost based on weight
 * @param weightLbs - Weight in pounds
 * @returns Estimated shipping cost
 */
export function calculateShippingCost(weightLbs: number): number {
  if (weightLbs <= 0) return 0;

  for (const tier of SHIPPING_TIERS) {
    if (weightLbs <= tier.maxWeight) {
      return tier.cost;
    }
  }

  return SHIPPING_TIERS[SHIPPING_TIERS.length - 1]?.cost ?? 0;
}

/**
 * Profit calculation input
 */
export interface ProfitInput {
  purchasePrice: number;
  sellPrice: number;
  marketplace: Marketplace;
  shippingCost: number;
  additionalCosts?: number;
}

/**
 * Profit calculation result
 */
export interface ProfitResult {
  grossProfit: number;
  fees: number;
  shippingCost: number;
  additionalCosts: number;
  netProfit: number;
  profitMargin: number;
}

/**
 * Calculate profit from a sale
 * @param input - Profit calculation parameters
 * @returns Detailed profit breakdown
 */
export function calculateProfit(input: ProfitInput): ProfitResult {
  const { purchasePrice, sellPrice, marketplace, shippingCost, additionalCosts = 0 } = input;

  const grossProfit = sellPrice - purchasePrice;
  const fees = calculateMarketplaceFee(sellPrice, marketplace);
  const netProfit = grossProfit - fees - shippingCost - additionalCosts;
  const profitMargin = calculateProfitMargin(netProfit, sellPrice);

  return {
    grossProfit: round(grossProfit),
    fees: round(fees),
    shippingCost: round(shippingCost),
    additionalCosts: round(additionalCosts),
    netProfit: round(netProfit),
    profitMargin,
  };
}

/**
 * Calculate profit margin as a percentage
 * @param profit - Net profit amount
 * @param sellPrice - Sale price
 * @returns Profit margin percentage
 */
export function calculateProfitMargin(profit: number, sellPrice: number): number {
  if (sellPrice === 0) return 0;
  return round((profit / sellPrice) * 100);
}

/**
 * Arbitrage opportunity input
 */
export interface ArbitrageInput {
  sourcePrice: number;
  sourceMarketplace: Marketplace;
  targetPrice: number;
  targetMarketplace: Marketplace;
  shippingCost: number;
  additionalCosts?: number;
}

/**
 * Arbitrage opportunity result
 */
export interface ArbitrageResult {
  isProfitable: boolean;
  estimatedProfit: number;
  profitMargin: number;
  fees: number;
  confidence: number;
}

/**
 * Calculate arbitrage opportunity between marketplaces
 * @param input - Arbitrage calculation parameters
 * @returns Arbitrage analysis result
 */
export function calculateArbitrageOpportunity(input: ArbitrageInput): ArbitrageResult {
  const {
    sourcePrice,
    targetPrice,
    targetMarketplace,
    shippingCost,
    additionalCosts = 0,
  } = input;

  const profitResult = calculateProfit({
    purchasePrice: sourcePrice,
    sellPrice: targetPrice,
    marketplace: targetMarketplace,
    shippingCost,
    additionalCosts,
  });

  // Calculate confidence based on profit margin and price difference
  const priceDiffRatio = (targetPrice - sourcePrice) / sourcePrice;
  let confidence = 0;

  if (profitResult.profitMargin >= 30) {
    confidence = 0.9;
  } else if (profitResult.profitMargin >= 20) {
    confidence = 0.75;
  } else if (profitResult.profitMargin >= 10) {
    confidence = 0.6;
  } else if (profitResult.profitMargin > 0) {
    confidence = 0.4;
  } else {
    confidence = 0.1;
  }

  // Adjust confidence based on price difference ratio
  if (priceDiffRatio > 0.5) {
    confidence = Math.min(confidence + 0.1, 1);
  }

  return {
    isProfitable: profitResult.netProfit > 0,
    estimatedProfit: profitResult.netProfit,
    profitMargin: profitResult.profitMargin,
    fees: profitResult.fees,
    confidence: round(confidence),
  };
}

/**
 * Format a price for display
 * @param price - Price value
 * @param currency - Currency code (default: USD)
 * @returns Formatted price string
 */
export function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

/**
 * Parse a price string to a number
 * @param priceString - Price string (e.g., "$100.00", "100", "USD 100")
 * @returns Parsed price or 0 if invalid
 */
export function parsePrice(priceString: string): number {
  if (!priceString || typeof priceString !== 'string') return 0;

  // Remove currency symbols, letters, commas, and whitespace
  const cleaned = priceString
    .trim()
    .replace(/[^0-9.-]/g, '');

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : round(parsed);
}
