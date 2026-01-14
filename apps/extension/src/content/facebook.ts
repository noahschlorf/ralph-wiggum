import { BaseScraper } from '../lib/scraper';
import type { ScrapedListingData } from '../lib/types';
import type { Marketplace } from '@arbitrage/shared';

/**
 * Facebook Marketplace scraper with resilient fallback selectors
 * Note: Facebook frequently changes their DOM structure, so multiple
 * selector strategies are used for resilience.
 */
export class FacebookScraper extends BaseScraper {
  marketplace: Marketplace = 'FACEBOOK';

  // Primary selectors (as of Jan 2025 - may break)
  private static readonly SELECTORS = {
    title: [
      // Primary: Main title span
      'span.x1lliihq.x6ikm8r.x10wlt62.x1n2onr6',
      // Fallback: Various title patterns
      '[data-testid="marketplace-pdp"] h1',
      'h1',
      '[role="main"] span[dir="auto"]:first-of-type',
    ],
    price: [
      // Primary: Price span
      'span.x1s688f',
      'span.x193iq5w.xeuugli.x13faqbe.x1vvkbs',
      // Fallback patterns
      '[data-testid="price"]',
      'span[dir="auto"]:has-text("$")',
    ],
    location: [
      // Primary: Location span
      'span.x1jchvi3.x1fcty0u.x40yjcy',
      '[data-testid="location"]',
      // Fallback patterns
      'span[dir="auto"]:has-text(",")',
    ],
    seller: [
      // Seller name patterns
      '[data-testid="seller-name"]',
      'a[role="link"] span[dir="auto"]',
    ],
    description: [
      // Description patterns
      '[data-testid="description"]',
      'div[data-ad-preview="message"]',
    ],
    images: [
      // Image selectors
      'img.x1lliihq.x193iq5w',
      'img[class*="x1lliihq"]',
      '[data-testid="marketplace-pdp"] img',
      'img[src*="fbcdn"]',
    ],
  };

  isListingPage(): boolean {
    return /facebook\.com\/marketplace\/item\/\d+/.test(location.href);
  }

  extractListing(): ScrapedListingData | null {
    try {
      const title = this.extractTitle();
      if (!title) return null;

      const externalId = this.extractItemId();
      if (!externalId) return null;

      const priceText = this.extractWithFallback(FacebookScraper.SELECTORS.price);
      const price = this.parsePrice(priceText);

      return {
        externalId,
        marketplace: this.marketplace,
        title,
        description: this.extractDescription(),
        price,
        currency: 'USD', // Facebook Marketplace is primarily USD
        condition: undefined, // FB doesn't have standardized conditions
        location: this.extractLocation(),
        sellerName: this.extractSeller(),
        sellerRating: undefined, // FB doesn't expose seller ratings
        imageUrls: this.extractImages(),
        listingUrl: location.href,
      };
    } catch (error) {
      console.error('[Arbitrage] Error extracting Facebook listing:', error);
      return null;
    }
  }

  /**
   * Extract item ID from URL
   */
  private extractItemId(): string | null {
    const match = location.href.match(/\/item\/(\d+)/);
    return match?.[1] ?? null;
  }

  /**
   * Extract title with fallback selectors
   */
  private extractTitle(): string | undefined {
    return this.extractWithFallback(FacebookScraper.SELECTORS.title);
  }

  /**
   * Extract description
   */
  private extractDescription(): string | undefined {
    return this.extractWithFallback(FacebookScraper.SELECTORS.description);
  }

  /**
   * Extract location
   */
  private extractLocation(): string | undefined {
    const location = this.extractWithFallback(FacebookScraper.SELECTORS.location);
    // Clean up location text
    return location?.replace(/\s+/g, ' ').trim();
  }

  /**
   * Extract seller name
   */
  private extractSeller(): string | undefined {
    return this.extractWithFallback(FacebookScraper.SELECTORS.seller);
  }

  /**
   * Extract images with multiple selector strategies
   */
  private extractImages(): string[] {
    const images: string[] = [];

    for (const selector of FacebookScraper.SELECTORS.images) {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => {
          const src = el.getAttribute('src');
          if (src && this.isValidImageUrl(src)) {
            images.push(src);
          }
        });
        if (images.length > 0) break; // Use first successful selector
      } catch {
        continue;
      }
    }

    return [...new Set(images)]; // Deduplicate
  }

  /**
   * Check if URL is a valid Facebook image
   */
  private isValidImageUrl(url: string): boolean {
    return (
      url.startsWith('https://') &&
      (url.includes('fbcdn') || url.includes('facebook')) &&
      !url.includes('emoji') &&
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
        continue; // Selector might be invalid, try next
      }
    }
    return undefined;
  }

  /**
   * Override parsePrice to handle Facebook-specific formats
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
const scraper = new FacebookScraper();
scraper.init();

export {};
