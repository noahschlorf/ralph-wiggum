import { BaseScraper } from '../lib/scraper';
import type { ScrapedListingData } from '../lib/types';
import type { Marketplace } from '@arbitrage/shared';

/**
 * Poshmark marketplace scraper
 * Poshmark is focused on fashion/clothing resale
 */
export class PoshmarkScraper extends BaseScraper {
  marketplace: Marketplace = 'POSHMARK';

  // Selector strategies for resilience
  private static readonly SELECTORS = {
    title: [
      '[data-test="listing-title"]',
      'h1.listing__title',
      'h1[class*="listing"]',
      '[class*="ListingTitle"]',
      'h1',
    ],
    price: [
      '[data-test="listing-price"]',
      'span.listing__price',
      '[class*="listing-price"]',
      '[class*="Price"]',
    ],
    condition: [
      '[data-test="listing-condition"]',
      '[class*="condition"]',
      '[class*="Condition"]',
    ],
    brand: [
      '[data-test="listing-brand"]',
      'a[href*="/brand/"]',
      '[class*="brand"]',
      '[class*="Brand"]',
    ],
    size: [
      '[data-test="listing-size"]',
      '[class*="size"]',
      '[class*="Size"]',
    ],
    seller: [
      '[data-test="seller-name"]',
      'a[href*="/closet/"]',
      '[class*="seller"]',
      '[class*="Seller"]',
    ],
    description: [
      '[data-test="listing-description"]',
      '[class*="description"]',
      '[class*="Description"]',
    ],
    images: [
      '[data-test="listing-image"]',
      '[data-test="listing-images"] img',
      'img[src*="cloudfront.net"]',
      'img[src*="poshmark"]',
    ],
  };

  isListingPage(): boolean {
    // Poshmark listings have hex ID at end: /listing/Title-Here-5f123abc456def789012
    return /poshmark\.com\/listing\/.*-[a-f0-9]+$/.test(location.href);
  }

  extractListing(): ScrapedListingData | null {
    try {
      const title = this.extractTitle();
      if (!title) return null;

      const externalId = this.extractItemId();
      if (!externalId) return null;

      const priceText = this.extractWithFallback(PoshmarkScraper.SELECTORS.price);
      const price = this.parsePrice(priceText);

      return {
        externalId,
        marketplace: this.marketplace,
        title,
        description: this.extractDescription(),
        price,
        currency: 'USD',
        condition: this.mapCondition(this.extractCondition()),
        location: undefined, // Poshmark doesn't show location publicly
        sellerName: this.extractSeller(),
        sellerRating: undefined,
        imageUrls: this.extractImages(),
        listingUrl: location.href,
      };
    } catch (error) {
      console.error('[Arbitrage] Error extracting Poshmark listing:', error);
      return null;
    }
  }

  /**
   * Extract item ID from URL (hex string at end)
   */
  private extractItemId(): string | null {
    const match = location.href.match(/-([a-f0-9]+)$/);
    return match?.[1] ?? null;
  }

  /**
   * Extract title with fallback selectors
   */
  private extractTitle(): string | undefined {
    return this.extractWithFallback(PoshmarkScraper.SELECTORS.title);
  }

  /**
   * Extract description
   */
  private extractDescription(): string | undefined {
    const desc = this.extractWithFallback(PoshmarkScraper.SELECTORS.description);
    const brand = this.extractWithFallback(PoshmarkScraper.SELECTORS.brand);
    const size = this.extractWithFallback(PoshmarkScraper.SELECTORS.size);

    // Combine description with brand and size info
    const parts = [desc, brand ? `Brand: ${brand}` : '', size ? `Size: ${size}` : '']
      .filter(Boolean)
      .join('\n');

    return parts || undefined;
  }

  /**
   * Extract condition (NWT, NWOT, etc.)
   */
  private extractCondition(): string | undefined {
    return this.extractWithFallback(PoshmarkScraper.SELECTORS.condition);
  }

  /**
   * Extract seller name
   */
  private extractSeller(): string | undefined {
    return this.extractWithFallback(PoshmarkScraper.SELECTORS.seller);
  }

  /**
   * Extract images
   */
  private extractImages(): string[] {
    const images: string[] = [];

    for (const selector of PoshmarkScraper.SELECTORS.images) {
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
   * Check if URL is a valid Poshmark image
   */
  private isValidImageUrl(url: string): boolean {
    return (
      url.startsWith('https://') &&
      (url.includes('cloudfront.net') || url.includes('poshmark')) &&
      !url.includes('avatar') &&
      !url.includes('profile') &&
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
}

// Initialize scraper when script loads
const scraper = new PoshmarkScraper();
scraper.init();

export {};
