import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock chrome API
const mockChrome = {
  runtime: {
    sendMessage: vi.fn(),
  },
};
vi.stubGlobal('chrome', mockChrome);

import { FacebookScraper } from '../../src/content/facebook';

describe('FacebookScraper', () => {
  let scraper: FacebookScraper;

  beforeEach(() => {
    scraper = new FacebookScraper();
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('isListingPage', () => {
    it('should return true for Facebook Marketplace item pages', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.facebook.com/marketplace/item/123456789' },
        writable: true,
      });

      expect(scraper.isListingPage()).toBe(true);
    });

    it('should return false for marketplace search pages', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.facebook.com/marketplace/search' },
        writable: true,
      });

      expect(scraper.isListingPage()).toBe(false);
    });

    it('should return false for main marketplace page', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.facebook.com/marketplace' },
        writable: true,
      });

      expect(scraper.isListingPage()).toBe(false);
    });

    it('should return false for regular Facebook pages', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.facebook.com/profile/123' },
        writable: true,
      });

      expect(scraper.isListingPage()).toBe(false);
    });
  });

  describe('extractListing', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.facebook.com/marketplace/item/123456789' },
        writable: true,
      });
    });

    it('should extract listing with primary selectors', () => {
      // Simulate Facebook's DOM structure (simplified)
      document.body.innerHTML = `
        <div data-testid="marketplace-pdp">
          <span class="x1lliihq x6ikm8r x10wlt62 x1n2onr6">iPhone 14 Pro Max 256GB</span>
          <span class="x193iq5w xeuugli x13faqbe x1vvkbs x10flber x1lliihq x1s928wv xhkezso x1gmr53x x1cpjm7i x1fgarty x1943h6x x1tu3fi x3x7a5m x1lkfr7t x1lbecb7 x1s688f xzsf02u">$899</span>
          <span class="x1jchvi3 x1fcty0u x40yjcy">San Francisco, CA</span>
          <img class="x1lliihq x193iq5w" src="https://example.com/image1.jpg" />
        </div>
      `;

      const listing = scraper.extractListing();

      expect(listing).not.toBeNull();
      expect(listing?.externalId).toBe('123456789');
      expect(listing?.marketplace).toBe('FACEBOOK');
      expect(listing?.title).toBe('iPhone 14 Pro Max 256GB');
      expect(listing?.price).toBe(899);
      expect(listing?.currency).toBe('USD');
    });

    it('should handle missing optional fields gracefully', () => {
      document.body.innerHTML = `
        <div>
          <span class="x1lliihq x6ikm8r x10wlt62 x1n2onr6">Basic Item For Sale</span>
          <span class="x193iq5w xeuugli x13faqbe x1vvkbs x10flber x1lliihq x1s928wv xhkezso x1gmr53x x1cpjm7i x1fgarty x1943h6x x1tu3fi x3x7a5m x1lkfr7t x1lbecb7 x1s688f xzsf02u">$50</span>
        </div>
      `;

      const listing = scraper.extractListing();

      expect(listing).not.toBeNull();
      expect(listing?.title).toBe('Basic Item For Sale');
      expect(listing?.price).toBe(50);
      expect(listing?.location).toBeUndefined();
      expect(listing?.sellerName).toBeUndefined();
    });

    it('should return null if title is missing', () => {
      document.body.innerHTML = `
        <div>
          <span class="x1s688f">$100</span>
        </div>
      `;

      const listing = scraper.extractListing();
      expect(listing).toBeNull();
    });

    it('should extract multiple images', () => {
      document.body.innerHTML = `
        <div>
          <span class="x1lliihq x6ikm8r x10wlt62 x1n2onr6">Multi Image Item</span>
          <span class="x1s688f">$200</span>
          <img class="x1lliihq" src="https://scontent.fbcdn.net/img1.jpg" />
          <img class="x1lliihq" src="https://scontent.fbcdn.net/img2.jpg" />
          <img class="x1lliihq" src="https://scontent.fbcdn.net/img3.jpg" />
        </div>
      `;

      const listing = scraper.extractListing();

      expect(listing?.imageUrls.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle Free items', () => {
      document.body.innerHTML = `
        <div>
          <span class="x1lliihq x6ikm8r x10wlt62 x1n2onr6">Free Couch</span>
          <span class="x1s688f">Free</span>
        </div>
      `;

      const listing = scraper.extractListing();

      expect(listing?.price).toBe(0);
    });

    it('should use fallback selectors when primary fail', () => {
      // Facebook changes selectors frequently, so test fallback
      document.body.innerHTML = `
        <div>
          <h1>Vintage Guitar</h1>
          <span data-testid="price">$500</span>
          <span data-testid="location">Austin, TX</span>
        </div>
      `;

      const listing = scraper.extractListing();

      // Should still extract with fallback selectors
      expect(listing).not.toBeNull();
      expect(listing?.title).toBe('Vintage Guitar');
    });
  });

  describe('price parsing', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.facebook.com/marketplace/item/999' },
        writable: true,
      });
    });

    const priceTests = [
      { input: '$1,234', expected: 1234 },
      { input: '$99.99', expected: 99.99 },
      { input: '$0', expected: 0 },
      { input: 'Free', expected: 0 },
      { input: '$1,234,567', expected: 1234567 },
      { input: '500', expected: 500 },
    ];

    priceTests.forEach(({ input, expected }) => {
      it(`should parse "${input}" as ${expected}`, () => {
        document.body.innerHTML = `
          <span class="x1lliihq x6ikm8r x10wlt62 x1n2onr6">Test Item</span>
          <span class="x1s688f">${input}</span>
        `;

        const listing = scraper.extractListing();
        expect(listing?.price).toBe(expected);
      });
    });
  });
});
