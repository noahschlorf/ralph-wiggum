import { BaseScraper } from '../lib/scraper';
import type { ScrapedListingData } from '../lib/types';
import type { Marketplace } from '@arbitrage/shared';

/**
 * Craigslist scraper
 * Note: Craigslist has relatively stable HTML structure but varies by city
 */
export class CraigslistScraper extends BaseScraper {
  marketplace: Marketplace = 'CRAIGSLIST';

  // Selector strategies for resilience
  private static readonly SELECTORS = {
    title: [
      'span.titletextonly',
      '#titletextonly',
      'h1.postingtitle span.postingtitletext span.titletextonly',
      '.postingtitletext',
      'h1',
      'h2#titletextonly',
    ],
    price: [
      'span.price',
      '.postingtitletext .price',
      '.attrgroup span.price',
      '[class*="price"]',
    ],
    location: [
      '.mapaddress',
      'div.mapaddress',
      'small',
      '[data-latitude]',
    ],
    description: [
      '#postingbody',
      'section#postingbody',
      '.posting-body',
    ],
    images: [
      '#thumbs a',
      '.gallery img',
      '.swipe img',
      'figure.iw img',
      'img[src*="craigslist.org"]',
    ],
  };

  isListingPage(): boolean {
    return /craigslist\.org\/.*\/\d+\.html/.test(location.href);
  }

  extractListing(): ScrapedListingData | null {
    try {
      const title = this.extractTitle();
      if (!title) return null;

      const externalId = this.extractItemId();
      if (!externalId) return null;

      const priceText = this.extractWithFallback(CraigslistScraper.SELECTORS.price);
      const price = this.parsePrice(priceText);

      return {
        externalId,
        marketplace: this.marketplace,
        title,
        description: this.extractDescription(),
        price,
        currency: 'USD',
        condition: undefined, // Craigslist doesn't have standardized conditions
        location: this.extractLocation(),
        sellerName: undefined, // Craigslist listings are anonymous
        sellerRating: undefined,
        imageUrls: this.extractImages(),
        listingUrl: location.href,
      };
    } catch (error) {
      console.error('[Arbitrage] Error extracting Craigslist listing:', error);
      return null;
    }
  }

  /**
   * Extract item ID from URL
   */
  private extractItemId(): string | null {
    const match = location.href.match(/\/(\d+)\.html/);
    return match?.[1] ?? null;
  }

  /**
   * Extract title with fallback selectors
   */
  private extractTitle(): string | undefined {
    return this.extractWithFallback(CraigslistScraper.SELECTORS.title);
  }

  /**
   * Extract description
   */
  private extractDescription(): string | undefined {
    const text = this.extractWithFallback(CraigslistScraper.SELECTORS.description);
    // Clean up Craigslist description (remove QR code notice, etc.)
    return text?.replace(/QR Code Link to This Post/g, '').trim();
  }

  /**
   * Extract location - try DOM first, fall back to URL
   */
  private extractLocation(): string | undefined {
    const domLocation = this.extractWithFallback(CraigslistScraper.SELECTORS.location);
    if (domLocation) {
      return domLocation.trim();
    }

    // Fall back to extracting city from URL
    const cityMatch = location.href.match(/\/\/([^.]+)\.craigslist\.org/);
    if (cityMatch) {
      return cityMatch[1];
    }

    return undefined;
  }

  /**
   * Extract images from gallery or thumbs
   */
  private extractImages(): string[] {
    const images: string[] = [];

    // Try to get full-size images from thumbnail links
    const thumbLinks = document.querySelectorAll('#thumbs a');
    thumbLinks.forEach((a) => {
      const href = a.getAttribute('href');
      if (href && this.isValidImageUrl(href)) {
        images.push(href);
      }
    });

    if (images.length > 0) {
      return [...new Set(images)];
    }

    // Fall back to img tags
    for (const selector of CraigslistScraper.SELECTORS.images) {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => {
          const src = el.getAttribute('src') || el.getAttribute('href');
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
   * Check if URL is a valid Craigslist image
   */
  private isValidImageUrl(url: string): boolean {
    return (
      url.startsWith('https://') &&
      url.includes('craigslist.org') &&
      !url.includes('static') &&
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
const scraper = new CraigslistScraper();
scraper.init();

export {};
