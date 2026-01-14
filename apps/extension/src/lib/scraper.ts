import type { Marketplace, ListingCondition } from '@arbitrage/shared';
import type { ScrapedListingData } from './types';

/**
 * Base scraper class for marketplace content scripts
 */
export abstract class BaseScraper {
  abstract marketplace: Marketplace;

  /**
   * Check if we're on a listing page
   */
  abstract isListingPage(): boolean;

  /**
   * Extract listing data from the current page
   */
  abstract extractListing(): ScrapedListingData | null;

  /**
   * Initialize the scraper and set up observers
   */
  init(): void {
    if (!this.isListingPage()) {
      return;
    }

    // Wait for page to fully load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.scrape());
    } else {
      this.scrape();
    }

    // Set up mutation observer for SPAs
    this.observeUrlChanges();
  }

  /**
   * Scrape the current page and send to background
   */
  scrape(): void {
    const listing = this.extractListing();

    if (listing) {
      this.sendToBackground(listing);
    }
  }

  /**
   * Send scraped listing to background service worker
   */
  protected sendToBackground(listing: ScrapedListingData): void {
    chrome.runtime.sendMessage(
      {
        type: 'LISTING_SCRAPED',
        payload: listing,
      },
      (response) => {
        if (response?.success) {
          console.log('[Arbitrage] Listing synced successfully');
        } else {
          console.error('[Arbitrage] Failed to sync listing:', response?.error);
        }
      }
    );
  }

  /**
   * Observe URL changes for SPAs
   */
  protected observeUrlChanges(): void {
    let lastUrl = location.href;

    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        if (this.isListingPage()) {
          // Wait for new content to load
          setTimeout(() => this.scrape(), 1000);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Helper to safely extract text content
   */
  protected getText(selector: string): string | undefined {
    const element = document.querySelector(selector);
    return element?.textContent?.trim();
  }

  /**
   * Helper to safely extract attribute
   */
  protected getAttribute(selector: string, attr: string): string | undefined {
    const element = document.querySelector(selector);
    return element?.getAttribute(attr) ?? undefined;
  }

  /**
   * Helper to extract all matching elements' text
   */
  protected getAllText(selector: string): string[] {
    const elements = document.querySelectorAll(selector);
    return Array.from(elements)
      .map((el) => el.textContent?.trim())
      .filter((text): text is string => !!text);
  }

  /**
   * Helper to extract all matching elements' attributes
   */
  protected getAllAttributes(selector: string, attr: string): string[] {
    const elements = document.querySelectorAll(selector);
    return Array.from(elements)
      .map((el) => el.getAttribute(attr))
      .filter((val): val is string => !!val);
  }

  /**
   * Helper to parse price string to number
   */
  protected parsePrice(priceString: string | undefined): number {
    if (!priceString) return 0;
    const cleaned = priceString.replace(/[^0-9.]/g, '');
    return parseFloat(cleaned) || 0;
  }

  /**
   * Map condition strings to enum
   */
  protected mapCondition(conditionStr: string | undefined): ListingCondition | undefined {
    if (!conditionStr) return undefined;

    const lower = conditionStr.toLowerCase().trim();

    // Poshmark-specific conditions (NWT = New With Tags, NWOT = New Without Tags)
    if (lower === 'nwt' || lower === 'nwot') {
      return 'NEW';
    }
    if (lower.includes('new') && !lower.includes('like')) {
      return 'NEW';
    }
    if (lower.includes('like new') || lower.includes('mint')) {
      return 'LIKE_NEW';
    }
    if (lower.includes('good') || lower.includes('excellent')) {
      return 'GOOD';
    }
    if (lower.includes('fair') || lower.includes('acceptable')) {
      return 'FAIR';
    }
    if (lower.includes('poor') || lower.includes('for parts')) {
      return 'POOR';
    }

    return undefined;
  }
}
