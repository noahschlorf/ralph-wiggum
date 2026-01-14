import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock chrome API
const mockChrome = {
  runtime: {
    sendMessage: vi.fn(),
  },
};
vi.stubGlobal('chrome', mockChrome);

import { MercariScraper } from '../../src/content/mercari';

describe('MercariScraper', () => {
  let scraper: MercariScraper;

  beforeEach(() => {
    scraper = new MercariScraper();
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('isListingPage', () => {
    it('should return true for Mercari item pages', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.mercari.com/us/item/m12345678901' },
        writable: true,
      });

      expect(scraper.isListingPage()).toBe(true);
    });

    it('should return true for alternate item URL format', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://mercari.com/item/m12345678901/' },
        writable: true,
      });

      expect(scraper.isListingPage()).toBe(true);
    });

    it('should return false for search pages', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.mercari.com/search/?keyword=iphone' },
        writable: true,
      });

      expect(scraper.isListingPage()).toBe(false);
    });

    it('should return false for home page', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.mercari.com/' },
        writable: true,
      });

      expect(scraper.isListingPage()).toBe(false);
    });
  });

  describe('extractListing', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.mercari.com/us/item/m12345678901' },
        writable: true,
      });
    });

    it('should extract listing with standard selectors', () => {
      document.body.innerHTML = `
        <div data-testid="ItemInfo">
          <h1 data-testid="ItemName">Nintendo Switch OLED</h1>
          <p data-testid="Price">$280</p>
          <p data-testid="ItemCondition">Like new</p>
          <span data-testid="SellerName">tech_seller</span>
          <p data-testid="Description">Great condition, barely used</p>
          <img data-testid="ItemImage" src="https://static.mercdn.net/item/123.jpg" />
        </div>
      `;

      const listing = scraper.extractListing();

      expect(listing).not.toBeNull();
      expect(listing?.externalId).toBe('m12345678901');
      expect(listing?.marketplace).toBe('MERCARI');
      expect(listing?.title).toBe('Nintendo Switch OLED');
      expect(listing?.price).toBe(280);
      expect(listing?.currency).toBe('USD');
      expect(listing?.condition).toBe('Like new');
    });

    it('should handle missing optional fields gracefully', () => {
      document.body.innerHTML = `
        <div>
          <h1 data-testid="ItemName">Simple Item</h1>
          <p data-testid="Price">$50</p>
        </div>
      `;

      const listing = scraper.extractListing();

      expect(listing).not.toBeNull();
      expect(listing?.title).toBe('Simple Item');
      expect(listing?.price).toBe(50);
      expect(listing?.condition).toBeUndefined();
      expect(listing?.sellerName).toBeUndefined();
    });

    it('should return null if title is missing', () => {
      document.body.innerHTML = `
        <div>
          <p data-testid="Price">$100</p>
        </div>
      `;

      const listing = scraper.extractListing();
      expect(listing).toBeNull();
    });

    it('should extract multiple images', () => {
      document.body.innerHTML = `
        <div>
          <h1 data-testid="ItemName">Multi Image Item</h1>
          <p data-testid="Price">$200</p>
          <img data-testid="ItemImage" src="https://static.mercdn.net/img1.jpg" />
          <img data-testid="ItemThumbnail" src="https://static.mercdn.net/img2.jpg" />
          <img data-testid="ItemThumbnail" src="https://static.mercdn.net/img3.jpg" />
        </div>
      `;

      const listing = scraper.extractListing();

      expect(listing?.imageUrls.length).toBeGreaterThanOrEqual(1);
    });

    it('should use fallback selectors when primary fail', () => {
      document.body.innerHTML = `
        <div>
          <h1 class="mer-heading">Vintage Camera</h1>
          <span class="mer-price">$150</span>
        </div>
      `;

      const listing = scraper.extractListing();

      expect(listing).not.toBeNull();
      expect(listing?.title).toBe('Vintage Camera');
      expect(listing?.price).toBe(150);
    });
  });

  describe('price parsing', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.mercari.com/us/item/m999' },
        writable: true,
      });
    });

    const priceTests = [
      { input: '$1,234', expected: 1234 },
      { input: '$99.99', expected: 99.99 },
      { input: '$0', expected: 0 },
      { input: '500', expected: 500 },
      { input: '$1,234.56', expected: 1234.56 },
    ];

    priceTests.forEach(({ input, expected }) => {
      it(`should parse "${input}" as ${expected}`, () => {
        document.body.innerHTML = `
          <h1 data-testid="ItemName">Test Item</h1>
          <p data-testid="Price">${input}</p>
        `;

        const listing = scraper.extractListing();
        expect(listing?.price).toBe(expected);
      });
    });
  });

  describe('condition mapping', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.mercari.com/us/item/m999' },
        writable: true,
      });
    });

    const conditionTests = [
      { input: 'New', expected: 'New' },
      { input: 'Like new', expected: 'Like new' },
      { input: 'Good', expected: 'Good' },
      { input: 'Fair', expected: 'Fair' },
      { input: 'Poor', expected: 'Poor' },
    ];

    conditionTests.forEach(({ input, expected }) => {
      it(`should extract condition "${input}"`, () => {
        document.body.innerHTML = `
          <h1 data-testid="ItemName">Test Item</h1>
          <p data-testid="Price">$100</p>
          <p data-testid="ItemCondition">${input}</p>
        `;

        const listing = scraper.extractListing();
        expect(listing?.condition).toBe(expected);
      });
    });
  });
});
