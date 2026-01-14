import { BaseScraper } from '../lib/scraper';
import type { ScrapedListingData } from '../lib/types';
import type { Marketplace, ListingCondition } from '@arbitrage/shared';

/**
 * eBay listing scraper
 */
export class EbayScraper extends BaseScraper {
  marketplace: Marketplace = 'EBAY';

  /**
   * Check if current page is an eBay item listing
   */
  isListingPage(): boolean {
    return /ebay\.com\/itm\/\d+/.test(location.href);
  }

  /**
   * Extract listing data from eBay item page
   */
  extractListing(): ScrapedListingData | null {
    try {
      const title = this.extractTitle();
      if (!title) return null;

      const externalId = this.extractItemId();
      if (!externalId) return null;

      const price = this.extractPrice();
      const currency = this.extractCurrency();

      return {
        externalId,
        marketplace: this.marketplace,
        title,
        description: this.extractDescription(),
        price,
        currency,
        condition: this.extractCondition(),
        location: this.extractLocation(),
        sellerName: this.extractSellerName(),
        sellerRating: this.extractSellerRating(),
        imageUrls: this.extractImages(),
        listingUrl: location.href,
      };
    } catch (error) {
      console.error('[Arbitrage] Error extracting eBay listing:', error);
      return null;
    }
  }

  /**
   * Extract item ID from URL
   */
  private extractItemId(): string | null {
    const match = location.href.match(/\/itm\/(\d+)/);
    return match?.[1] ?? null;
  }

  /**
   * Extract listing title
   */
  private extractTitle(): string | undefined {
    // Try multiple selectors for different eBay layouts
    const selectors = [
      'h1.x-item-title__mainTitle .ux-textspans--BOLD',
      'h1.x-item-title__mainTitle',
      '#itemTitle',
      '[data-testid="x-item-title"]',
    ];

    for (const selector of selectors) {
      const title = this.getText(selector);
      if (title) return title;
    }

    return undefined;
  }

  /**
   * Extract listing price
   */
  private extractPrice(): number {
    const selectors = [
      '.x-price-primary .ux-textspans',
      '.x-bin-price .ux-textspans',
      '#prcIsum',
      '[data-testid="x-price-primary"]',
    ];

    for (const selector of selectors) {
      const priceText = this.getText(selector);
      if (priceText) {
        return this.parsePrice(priceText);
      }
    }

    return 0;
  }

  /**
   * Extract currency from price string
   */
  private extractCurrency(): string {
    const priceText = this.getText('.x-price-primary .ux-textspans') || '';

    if (priceText.includes('$') || priceText.includes('US')) {
      return 'USD';
    }
    if (priceText.includes('£') || priceText.includes('GBP')) {
      return 'GBP';
    }
    if (priceText.includes('€') || priceText.includes('EUR')) {
      return 'EUR';
    }
    if (priceText.includes('C$') || priceText.includes('CAD')) {
      return 'CAD';
    }

    return 'USD'; // Default
  }

  /**
   * Extract listing description
   */
  private extractDescription(): string | undefined {
    // Description is often in an iframe, so we get the seller's item specifics instead
    const specifics = this.getAllText('.ux-layout-section__item--table-view .ux-textspans');
    return specifics.length > 0 ? specifics.join(' | ') : undefined;
  }

  /**
   * Extract item condition with enhanced mapping
   */
  private extractCondition(): ListingCondition | undefined {
    const conditionText = this.getText('.x-item-condition-text .ux-textspans');
    return this.mapEbayCondition(conditionText);
  }

  /**
   * Map eBay-specific condition strings
   */
  private mapEbayCondition(conditionStr: string | undefined): ListingCondition | undefined {
    if (!conditionStr) return undefined;

    const lower = conditionStr.toLowerCase();

    // New conditions
    if (
      lower === 'new' ||
      lower.includes('brand new') ||
      lower.includes('new with tags') ||
      lower.includes('new with box') ||
      lower.includes('new without tags')
    ) {
      return 'NEW';
    }

    // Like New conditions
    if (
      lower.includes('like new') ||
      lower.includes('open box') ||
      lower.includes('never used')
    ) {
      return 'LIKE_NEW';
    }

    // Good conditions
    if (
      lower.includes('excellent') ||
      lower.includes('very good') ||
      lower.includes('good') ||
      lower.includes('refurbished')
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

    return this.mapCondition(conditionStr);
  }

  /**
   * Extract seller location
   */
  private extractLocation(): string | undefined {
    const selectors = [
      '[itemprop="itemLocation"]',
      '.ux-labels-values--itemLocation .ux-textspans--SECONDARY',
      '.x-item-location .ux-textspans',
    ];

    for (const selector of selectors) {
      const location = this.getText(selector);
      if (location) return location;
    }

    return undefined;
  }

  /**
   * Extract seller name
   */
  private extractSellerName(): string | undefined {
    const selectors = [
      '.x-sellercard-atf__info .ux-textspans--BOLD',
      '.mbg-nw',
      '[data-testid="x-sellercard-atf__info"] .ux-textspans',
    ];

    for (const selector of selectors) {
      const name = this.getText(selector);
      if (name) return name;
    }

    return undefined;
  }

  /**
   * Extract seller rating (convert percentage to 5-star scale)
   */
  private extractSellerRating(): number | undefined {
    const ratingText = this.getText('.x-sellercard-atf__data-item .ux-textspans--SECONDARY');

    if (ratingText) {
      // Extract percentage like "98.5% positive feedback"
      const match = ratingText.match(/([\d.]+)%/);
      const percentageStr = match?.[1];
      if (percentageStr) {
        const percentage = parseFloat(percentageStr);
        // Convert to 5-star scale (90% = 4.5, 100% = 5)
        return Math.round((percentage / 100) * 5 * 100) / 100;
      }
    }

    return undefined;
  }

  /**
   * Extract listing images
   */
  private extractImages(): string[] {
    const images = this.getAllAttributes('.ux-image-carousel-item img', 'src');

    // Filter out thumbnails and get full-size images
    return images
      .filter((url) => url && !url.includes('s-l64') && !url.includes('s-l140'))
      .map((url) => {
        // Convert to large image URL
        return url.replace(/s-l\d+/, 's-l1600');
      });
  }
}

// Initialize scraper when script loads
const scraper = new EbayScraper();
scraper.init();

export {};
