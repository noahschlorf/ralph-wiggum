import { BaseScraper } from '../lib/scraper';
import type { ScrapedListingData } from '../lib/types';
import type { Marketplace } from '@arbitrage/shared';

/**
 * Amazon scraper
 * TODO: Implement extraction logic
 */
export class AmazonScraper extends BaseScraper {
  marketplace: Marketplace = 'AMAZON';

  isListingPage(): boolean {
    return /amazon\.com\/.*\/dp\/[A-Z0-9]+/.test(location.href);
  }

  extractListing(): ScrapedListingData | null {
    // TODO: Implement Amazon scraping
    console.log('[Arbitrage] Amazon scraper not yet implemented');
    return null;
  }
}

const scraper = new AmazonScraper();
scraper.init();

export {};
