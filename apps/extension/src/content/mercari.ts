import { BaseScraper } from '../lib/scraper';
import type { ScrapedListingData } from '../lib/types';
import type { Marketplace } from '@arbitrage/shared';

/**
 * Mercari marketplace scraper
 * Supports both mercari.com/us/item and mercari.com/item URL formats
 */
export class MercariScraper extends BaseScraper {
  marketplace: Marketplace = 'MERCARI';

  // Selector strategies for resilience
  private static readonly SELECTORS = {
    title: [
      '[data-testid="ItemName"]',
      'h1[class*="mer-heading"]',
      'h1.mer-heading',
      '[class*="ItemName"] h1',
      'h1',
    ],
    price: [
      '[data-testid="Price"]',
      'span[class*="mer-price"]',
      '.mer-price',
      '[class*="Price"]',
      'p:has-text("$")',
    ],
    condition: [
      '[data-testid="ItemCondition"]',
      '[data-testid="Condition"]',
      '[class*="ItemCondition"]',
      '[class*="Condition"]',
    ],
    seller: [
      '[data-testid="SellerName"]',
      '[class*="SellerName"]',
      'a[href*="/u/"] span',
    ],
    description: [
      '[data-testid="Description"]',
      '[data-testid="ItemDescription"]',
      '[class*="Description"]',
    ],
    images: [
      '[data-testid="ItemImage"]',
      '[data-testid="ItemThumbnail"]',
      'img[src*="mercdn.net"]',
      'img[class*="item-image"]',
    ],
  };

  isListingPage(): boolean {
    // Match: /us/item/m12345 or /item/m12345
    return /mercari\.com\/(us\/)?item\/m\d+/.test(location.href);
  }

  extractListing(): ScrapedListingData | null {
    try {
      const title = this.extractTitle();
      if (!title) return null;

      const externalId = this.extractItemId();
      if (!externalId) return null;

      const priceText = this.extractWithFallback(MercariScraper.SELECTORS.price);
      const price = this.parsePrice(priceText);

      return {
        externalId,
        marketplace: this.marketplace,
        title,
        description: this.extractDescription(),
        price,
        currency: 'USD',
        condition: this.extractCondition(),
        location: undefined, // Mercari doesn't show seller location publicly
        sellerName: this.extractSeller(),
        sellerRating: undefined,
        imageUrls: this.extractImages(),
        listingUrl: location.href,
      };
    } catch (error) {
      console.error('[Arbitrage] Error extracting Mercari listing:', error);
      return null;
    }
  }

  /**
   * Extract item ID from URL
   */
  private extractItemId(): string | null {
    const match = location.href.match(/\/item\/(m\d+)/);
    return match?.[1] ?? null;
  }

  /**
   * Extract title with fallback selectors
   */
  private extractTitle(): string | undefined {
    return this.extractWithFallback(MercariScraper.SELECTORS.title);
  }

  /**
   * Extract description
   */
  private extractDescription(): string | undefined {
    return this.extractWithFallback(MercariScraper.SELECTORS.description);
  }

  /**
   * Extract condition
   */
  private extractCondition(): string | undefined {
    return this.extractWithFallback(MercariScraper.SELECTORS.condition);
  }

  /**
   * Extract seller name
   */
  private extractSeller(): string | undefined {
    return this.extractWithFallback(MercariScraper.SELECTORS.seller);
  }

  /**
   * Extract images
   */
  private extractImages(): string[] {
    const images: string[] = [];

    for (const selector of MercariScraper.SELECTORS.images) {
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
   * Check if URL is a valid Mercari image
   */
  private isValidImageUrl(url: string): boolean {
    return (
      url.startsWith('https://') &&
      (url.includes('mercdn.net') || url.includes('mercari')) &&
      !url.includes('avatar') &&
      !url.includes('profile')
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
const scraper = new MercariScraper();
scraper.init();

export {};
