import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock chrome API
const mockChrome = {
  runtime: {
    sendMessage: vi.fn(),
  },
};
vi.stubGlobal('chrome', mockChrome);

import { OfferUpScraper } from '../../src/content/offerup';

describe('OfferUpScraper', () => {
  let scraper: OfferUpScraper;

  beforeEach(() => {
    scraper = new OfferUpScraper();
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('isListingPage', () => {
    it('should return true for OfferUp item pages', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://offerup.com/item/detail/1234567890' },
        writable: true,
      });

      expect(scraper.isListingPage()).toBe(true);
    });

    it('should return true for www subdomain', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.offerup.com/item/detail/9876543210' },
        writable: true,
      });

      expect(scraper.isListingPage()).toBe(true);
    });

    it('should return false for search pages', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://offerup.com/search/?q=iphone' },
        writable: true,
      });

      expect(scraper.isListingPage()).toBe(false);
    });

    it('should return false for home page', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://offerup.com/' },
        writable: true,
      });

      expect(scraper.isListingPage()).toBe(false);
    });

    it('should return false for category pages', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://offerup.com/explore/electronics' },
        writable: true,
      });

      expect(scraper.isListingPage()).toBe(false);
    });
  });

  describe('extractListing', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://offerup.com/item/detail/1234567890' },
        writable: true,
      });
    });

    it('should extract listing with standard selectors', () => {
      document.body.innerHTML = `
        <div data-testid="item-details">
          <h1 data-testid="item-title">PlayStation 5 Console</h1>
          <span data-testid="item-price">$450</span>
          <span data-testid="item-condition">Like new</span>
          <span data-testid="item-location">Seattle, WA</span>
          <a data-testid="seller-name" href="/profile/seller123">GameDeals</a>
          <div data-testid="item-description">Perfect condition, barely used</div>
          <img data-testid="item-image" src="https://images.offerup.com/img1.jpg" />
        </div>
      `;

      const listing = scraper.extractListing();

      expect(listing).not.toBeNull();
      expect(listing?.externalId).toBe('1234567890');
      expect(listing?.marketplace).toBe('OFFERUP');
      expect(listing?.title).toBe('PlayStation 5 Console');
      expect(listing?.price).toBe(450);
      expect(listing?.currency).toBe('USD');
      expect(listing?.condition).toBe('Like new');
      expect(listing?.location).toBe('Seattle, WA');
    });

    it('should handle missing optional fields gracefully', () => {
      document.body.innerHTML = `
        <div>
          <h1 data-testid="item-title">Basic Item</h1>
          <span data-testid="item-price">$25</span>
        </div>
      `;

      const listing = scraper.extractListing();

      expect(listing).not.toBeNull();
      expect(listing?.title).toBe('Basic Item');
      expect(listing?.price).toBe(25);
      expect(listing?.condition).toBeUndefined();
      expect(listing?.sellerName).toBeUndefined();
    });

    it('should return null if title is missing', () => {
      document.body.innerHTML = `
        <div>
          <span data-testid="item-price">$100</span>
        </div>
      `;

      const listing = scraper.extractListing();
      expect(listing).toBeNull();
    });

    it('should extract multiple images', () => {
      document.body.innerHTML = `
        <div>
          <h1 data-testid="item-title">Multi Image Item</h1>
          <span data-testid="item-price">$200</span>
          <div data-testid="image-gallery">
            <img src="https://images.offerup.com/img1.jpg" />
            <img src="https://images.offerup.com/img2.jpg" />
            <img src="https://images.offerup.com/img3.jpg" />
          </div>
        </div>
      `;

      const listing = scraper.extractListing();

      expect(listing?.imageUrls.length).toBeGreaterThanOrEqual(1);
    });

    it('should use fallback selectors when primary fail', () => {
      document.body.innerHTML = `
        <div>
          <h1 class="item-title">Vintage Record Player</h1>
          <span class="price">$175</span>
          <span class="location">Portland, OR</span>
        </div>
      `;

      const listing = scraper.extractListing();

      expect(listing).not.toBeNull();
      expect(listing?.title).toBe('Vintage Record Player');
      expect(listing?.price).toBe(175);
    });

    it('should handle Free items', () => {
      document.body.innerHTML = `
        <div>
          <h1 data-testid="item-title">Free Moving Boxes</h1>
          <span data-testid="item-price">Free</span>
        </div>
      `;

      const listing = scraper.extractListing();

      expect(listing?.price).toBe(0);
    });
  });

  describe('price parsing', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://offerup.com/item/detail/999' },
        writable: true,
      });
    });

    const priceTests = [
      { input: '$1,234', expected: 1234 },
      { input: '$99.99', expected: 99.99 },
      { input: '$0', expected: 0 },
      { input: 'Free', expected: 0 },
      { input: '$2,500', expected: 2500 },
    ];

    priceTests.forEach(({ input, expected }) => {
      it(`should parse "${input}" as ${expected}`, () => {
        document.body.innerHTML = `
          <h1 data-testid="item-title">Test Item</h1>
          <span data-testid="item-price">${input}</span>
        `;

        const listing = scraper.extractListing();
        expect(listing?.price).toBe(expected);
      });
    });
  });
});
