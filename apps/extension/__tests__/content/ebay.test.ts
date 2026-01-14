import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock chrome API
const mockChrome = {
  runtime: {
    sendMessage: vi.fn(),
  },
};
vi.stubGlobal('chrome', mockChrome);

// Import after mocking
import { EbayScraper } from '../../src/content/ebay';

describe('EbayScraper', () => {
  let scraper: EbayScraper;

  beforeEach(() => {
    scraper = new EbayScraper();
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('isListingPage', () => {
    it('should return true for eBay item pages', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.ebay.com/itm/123456789' },
        writable: true,
      });

      expect(scraper.isListingPage()).toBe(true);
    });

    it('should return false for search pages', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.ebay.com/sch/i.html?_nkw=iphone' },
        writable: true,
      });

      expect(scraper.isListingPage()).toBe(false);
    });

    it('should return false for category pages', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.ebay.com/b/Electronics/1234' },
        writable: true,
      });

      expect(scraper.isListingPage()).toBe(false);
    });
  });

  describe('extractListing', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.ebay.com/itm/123456789' },
        writable: true,
      });
    });

    it('should extract listing data from page', () => {
      document.body.innerHTML = `
        <h1 class="x-item-title__mainTitle">
          <span class="ux-textspans ux-textspans--BOLD">iPhone 14 Pro Max 256GB</span>
        </h1>
        <div class="x-price-primary">
          <span class="ux-textspans">US $899.99</span>
        </div>
        <div class="x-item-condition-text">
          <span class="ux-textspans">New</span>
        </div>
        <span class="ux-textspans ux-textspans--SECONDARY" itemprop="itemLocation">
          New York, United States
        </span>
        <div class="x-sellercard-atf__info">
          <span class="ux-textspans ux-textspans--BOLD">top_seller_123</span>
        </div>
        <div class="x-sellercard-atf__data-item">
          <span class="ux-textspans ux-textspans--SECONDARY">99.8% positive feedback</span>
        </div>
        <div class="ux-image-carousel-item">
          <img src="https://i.ebayimg.com/images/g/abc123/s-l1600.jpg" />
        </div>
      `;

      const listing = scraper.extractListing();

      expect(listing).not.toBeNull();
      expect(listing?.externalId).toBe('123456789');
      expect(listing?.marketplace).toBe('EBAY');
      expect(listing?.title).toBe('iPhone 14 Pro Max 256GB');
      expect(listing?.price).toBe(899.99);
      expect(listing?.currency).toBe('USD');
      expect(listing?.condition).toBe('NEW');
      expect(listing?.location).toBe('New York, United States');
      expect(listing?.listingUrl).toBe('https://www.ebay.com/itm/123456789');
    });

    it('should handle missing optional fields', () => {
      document.body.innerHTML = `
        <h1 class="x-item-title__mainTitle">
          <span class="ux-textspans ux-textspans--BOLD">Basic Item</span>
        </h1>
        <div class="x-price-primary">
          <span class="ux-textspans">$50.00</span>
        </div>
      `;

      const listing = scraper.extractListing();

      expect(listing).not.toBeNull();
      expect(listing?.title).toBe('Basic Item');
      expect(listing?.price).toBe(50);
      expect(listing?.condition).toBeUndefined();
      expect(listing?.location).toBeUndefined();
      expect(listing?.sellerName).toBeUndefined();
    });

    it('should return null if title is missing', () => {
      document.body.innerHTML = `
        <div class="x-price-primary">
          <span class="ux-textspans">$50.00</span>
        </div>
      `;

      const listing = scraper.extractListing();
      expect(listing).toBeNull();
    });

    it('should extract multiple images', () => {
      document.body.innerHTML = `
        <h1 class="x-item-title__mainTitle">
          <span class="ux-textspans ux-textspans--BOLD">Multi Image Item</span>
        </h1>
        <div class="x-price-primary">
          <span class="ux-textspans">$100.00</span>
        </div>
        <div class="ux-image-carousel-item">
          <img src="https://i.ebayimg.com/images/image1.jpg" />
        </div>
        <div class="ux-image-carousel-item">
          <img src="https://i.ebayimg.com/images/image2.jpg" />
        </div>
        <div class="ux-image-carousel-item">
          <img src="https://i.ebayimg.com/images/image3.jpg" />
        </div>
      `;

      const listing = scraper.extractListing();

      expect(listing?.imageUrls).toHaveLength(3);
      expect(listing?.imageUrls).toContain('https://i.ebayimg.com/images/image1.jpg');
    });

    it('should parse seller rating percentage', () => {
      document.body.innerHTML = `
        <h1 class="x-item-title__mainTitle">
          <span class="ux-textspans ux-textspans--BOLD">Test Item</span>
        </h1>
        <div class="x-price-primary">
          <span class="ux-textspans">$75.00</span>
        </div>
        <div class="x-sellercard-atf__data-item">
          <span class="ux-textspans ux-textspans--SECONDARY">98.5% positive feedback</span>
        </div>
      `;

      const listing = scraper.extractListing();
      expect(listing?.sellerRating).toBe(4.93); // 98.5% converted to 5-star scale
    });
  });

  describe('condition mapping', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.ebay.com/itm/123456789' },
        writable: true,
      });
    });

    const conditionTestCases = [
      { input: 'New', expected: 'NEW' },
      { input: 'Brand New', expected: 'NEW' },
      { input: 'New with tags', expected: 'NEW' },
      { input: 'Like New', expected: 'LIKE_NEW' },
      { input: 'Open box', expected: 'LIKE_NEW' },
      { input: 'Excellent - Refurbished', expected: 'GOOD' },
      { input: 'Very Good', expected: 'GOOD' },
      { input: 'Good', expected: 'GOOD' },
      { input: 'Acceptable', expected: 'FAIR' },
      { input: 'For parts or not working', expected: 'POOR' },
    ];

    conditionTestCases.forEach(({ input, expected }) => {
      it(`should map "${input}" to ${expected}`, () => {
        document.body.innerHTML = `
          <h1 class="x-item-title__mainTitle">
            <span class="ux-textspans ux-textspans--BOLD">Test</span>
          </h1>
          <div class="x-price-primary">
            <span class="ux-textspans">$10.00</span>
          </div>
          <div class="x-item-condition-text">
            <span class="ux-textspans">${input}</span>
          </div>
        `;

        const listing = scraper.extractListing();
        expect(listing?.condition).toBe(expected);
      });
    });
  });
});
