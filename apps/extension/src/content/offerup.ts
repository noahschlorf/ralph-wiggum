import { BaseScraper } from '../lib/scraper';
import type { ScrapedListingData } from '../lib/types';
import type { Marketplace } from '@arbitrage/shared';

/**
 * OfferUp marketplace scraper
 * OfferUp is a local marketplace app with web presence
 */
export class OfferUpScraper extends BaseScraper {
  marketplace: Marketplace = 'OFFERUP';

  // Selector strategies for resilience
  private static readonly SELECTORS = {
    title: [
      '[data-testid="item-title"]',
      'h1.item-title',
      'h1[class*="item-title"]',
      '[class*="ItemTitle"]',
      'h1',
    ],
    price: [
      '[data-testid="item-price"]',
      'span.price',
      '[class*="price"]',
      'span[class*="Price"]',
    ],
    condition: [
      '[data-testid="item-condition"]',
      '[class*="condition"]',
      '[class*="Condition"]',
    ],
    location: [
      '[data-testid="item-location"]',
      'span.location',
      '[class*="location"]',
      '[class*="Location"]',
    ],
    seller: [
      '[data-testid="seller-name"]',
      'a[href*="/profile/"]',
      '[class*="seller"]',
      '[class*="Seller"]',
    ],
    description: [
      '[data-testid="item-description"]',
      '[class*="description"]',
      '[class*="Description"]',
    ],
    images: [
      '[data-testid="item-image"]',
      '[data-testid="image-gallery"] img',
      'img[src*="offerup.com"]',
      'img[src*="images.offerup"]',
    ],
  };

  isListingPage(): boolean {
    return /offerup\.com\/item\/detail\/\d+/.test(location.href);
  }

  extractListing(): ScrapedListingData | null {
    try {
      const title = this.extractTitle();
      if (!title) return null;

      const externalId = this.extractItemId();
      if (!externalId) return null;

      const priceText = this.extractWithFallback(OfferUpScraper.SELECTORS.price);
      const price = this.parsePrice(priceText);

      return {
        externalId,
        marketplace: this.marketplace,
        title,
        description: this.extractDescription(),
        price,
        currency: 'USD',
        condition: this.extractCondition(),
        location: this.extractLocation(),
        sellerName: this.extractSeller(),
        sellerRating: undefined, // OfferUp shows ratings but structure varies
        imageUrls: this.extractImages(),
        listingUrl: location.href,
      };
    } catch (error) {
      console.error('[Arbitrage] Error extracting OfferUp listing:', error);
      return null;
    }
  }

  /**
   * Extract item ID from URL
   */
  private extractItemId(): string | null {
    const match = location.href.match(/\/detail\/(\d+)/);
    return match?.[1] ?? null;
  }

  /**
   * Extract title with fallback selectors
   */
  private extractTitle(): string | undefined {
    return this.extractWithFallback(OfferUpScraper.SELECTORS.title);
  }

  /**
   * Extract description
   */
  private extractDescription(): string | undefined {
    return this.extractWithFallback(OfferUpScraper.SELECTORS.description);
  }

  /**
   * Extract condition
   */
  private extractCondition(): string | undefined {
    return this.extractWithFallback(OfferUpScraper.SELECTORS.condition);
  }

  /**
   * Extract location
   */
  private extractLocation(): string | undefined {
    return this.extractWithFallback(OfferUpScraper.SELECTORS.location);
  }

  /**
   * Extract seller name
   */
  private extractSeller(): string | undefined {
    return this.extractWithFallback(OfferUpScraper.SELECTORS.seller);
  }

  /**
   * Extract images
   */
  private extractImages(): string[] {
    const images: string[] = [];

    for (const selector of OfferUpScraper.SELECTORS.images) {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => {
          const src = el.getAttribute('src');
          if (src && this.isValidImageUrl(src)) {
            images.push(src);
          }
        });
        if (images.length > 0) break;
      } catch {
        continue;
      }
    }

    return [...new Set(images)];
  }

  /**
   * Check if URL is a valid OfferUp image
   */
  private isValidImageUrl(url: string): boolean {
    return (
      url.startsWith('https://') &&
      (url.includes('offerup.com') || url.includes('offerup')) &&
      !url.includes('avatar') &&
      !url.includes('profile-pic') &&
      !url.includes('icon')
    );
  }

  /**
   * Try multiple selectors and return first successful match
   */
  private extractWithFallback(selectors: string[]): string | undefined {
    for (const selector of selectors) {
      try {
        const text = this.getText(selector);
        if (text && text.length > 0) {
          return text;
        }
      } catch {
        continue;
      }
    }
    return undefined;
  }

  /**
   * Override parsePrice to handle OfferUp-specific formats
   */
  protected override parsePrice(priceString: string | undefined): number {
    if (!priceString) return 0;

    const lower = priceString.toLowerCase();

    // Handle "Free" listings
    if (lower === 'free' || lower.includes('free')) {
      return 0;
    }

    // Remove currency symbols and commas
    const cleaned = priceString.replace(/[^0-9.]/g, '');
    const parsed = parseFloat(cleaned);

    return isNaN(parsed) ? 0 : parsed;
  }
}

// Initialize scraper when script loads
const scraper = new OfferUpScraper();
scraper.init();

export {};
