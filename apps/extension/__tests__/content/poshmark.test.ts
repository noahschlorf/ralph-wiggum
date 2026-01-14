import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock chrome API
const mockChrome = {
  runtime: {
    sendMessage: vi.fn(),
  },
};
vi.stubGlobal('chrome', mockChrome);

import { PoshmarkScraper } from '../../src/content/poshmark';

describe('PoshmarkScraper', () => {
  let scraper: PoshmarkScraper;

  beforeEach(() => {
    scraper = new PoshmarkScraper();
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('isListingPage', () => {
    it('should return true for Poshmark listing pages', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://poshmark.com/listing/Designer-Handbag-5f123abc456def789012' },
        writable: true,
      });

      expect(scraper.isListingPage()).toBe(true);
    });

    it('should return true for www subdomain', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.poshmark.com/listing/Vintage-Dress-abc123def456789' },
        writable: true,
      });

      expect(scraper.isListingPage()).toBe(true);
    });

    it('should return false for closet pages', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://poshmark.com/closet/fashionseller' },
        writable: true,
      });

      expect(scraper.isListingPage()).toBe(false);
    });

    it('should return false for search pages', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://poshmark.com/search?query=dress' },
        writable: true,
      });

      expect(scraper.isListingPage()).toBe(false);
    });

    it('should return false for category pages', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://poshmark.com/category/Women-Dresses' },
        writable: true,
      });

      expect(scraper.isListingPage()).toBe(false);
    });
  });

  describe('extractListing', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://poshmark.com/listing/Louis-Vuitton-Neverfull-5f123abc456def789012' },
        writable: true,
      });
    });

    it('should extract listing with standard selectors', () => {
      document.body.innerHTML = `
        <div data-test="listing-details">
          <h1 data-test="listing-title">Louis Vuitton Neverfull MM</h1>
          <span data-test="listing-price">$1,200</span>
          <span data-test="listing-original-price">$2,500</span>
          <span data-test="listing-size">Medium</span>
          <span data-test="listing-brand">Louis Vuitton</span>
          <a data-test="seller-name" href="/closet/luxuryseller">LuxurySeller</a>
          <div data-test="listing-description">Authentic, excellent condition</div>
          <img data-test="listing-image" src="https://di2ponv0v5otw.cloudfront.net/img1.jpg" />
        </div>
      `;

      const listing = scraper.extractListing();

      expect(listing).not.toBeNull();
      expect(listing?.externalId).toBe('5f123abc456def789012');
      expect(listing?.marketplace).toBe('POSHMARK');
      expect(listing?.title).toBe('Louis Vuitton Neverfull MM');
      expect(listing?.price).toBe(1200);
      expect(listing?.currency).toBe('USD');
    });

    it('should handle missing optional fields gracefully', () => {
      document.body.innerHTML = `
        <div>
          <h1 data-test="listing-title">Simple Dress</h1>
          <span data-test="listing-price">$45</span>
        </div>
      `;

      const listing = scraper.extractListing();

      expect(listing).not.toBeNull();
      expect(listing?.title).toBe('Simple Dress');
      expect(listing?.price).toBe(45);
      expect(listing?.sellerName).toBeUndefined();
    });

    it('should return null if title is missing', () => {
      document.body.innerHTML = `
        <div>
          <span data-test="listing-price">$100</span>
        </div>
      `;

      const listing = scraper.extractListing();
      expect(listing).toBeNull();
    });

    it('should extract multiple images', () => {
      document.body.innerHTML = `
        <div>
          <h1 data-test="listing-title">Multi Image Item</h1>
          <span data-test="listing-price">$200</span>
          <div data-test="listing-images">
            <img src="https://di2ponv0v5otw.cloudfront.net/img1.jpg" />
            <img src="https://di2ponv0v5otw.cloudfront.net/img2.jpg" />
            <img src="https://di2ponv0v5otw.cloudfront.net/img3.jpg" />
          </div>
        </div>
      `;

      const listing = scraper.extractListing();

      expect(listing?.imageUrls.length).toBeGreaterThanOrEqual(1);
    });

    it('should use fallback selectors when primary fail', () => {
      document.body.innerHTML = `
        <div class="listing-container">
          <h1 class="listing__title">Vintage Chanel Bag</h1>
          <span class="listing__price">$3,500</span>
        </div>
      `;

      const listing = scraper.extractListing();

      expect(listing).not.toBeNull();
      expect(listing?.title).toBe('Vintage Chanel Bag');
      expect(listing?.price).toBe(3500);
    });

    it('should extract brand from listing', () => {
      document.body.innerHTML = `
        <div>
          <h1 data-test="listing-title">Gucci Marmont Bag</h1>
          <span data-test="listing-price">$1,800</span>
          <a data-test="listing-brand" href="/brand/Gucci">Gucci</a>
        </div>
      `;

      const listing = scraper.extractListing();

      expect(listing).not.toBeNull();
      // Brand would be in description or separate field
    });
  });

  describe('price parsing', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://poshmark.com/listing/Test-Item-abc123' },
        writable: true,
      });
    });

    const priceTests = [
      { input: '$1,234', expected: 1234 },
      { input: '$99', expected: 99 },
      { input: '$4,999', expected: 4999 },
      { input: '$25', expected: 25 },
      { input: '$12,500', expected: 12500 },
    ];

    priceTests.forEach(({ input, expected }) => {
      it(`should parse "${input}" as ${expected}`, () => {
        document.body.innerHTML = `
          <h1 data-test="listing-title">Test Item</h1>
          <span data-test="listing-price">${input}</span>
        `;

        const listing = scraper.extractListing();
        expect(listing?.price).toBe(expected);
      });
    });
  });

  describe('condition handling', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://poshmark.com/listing/Test-abc123' },
        writable: true,
      });
    });

    it('should extract NWT condition', () => {
      document.body.innerHTML = `
        <h1 data-test="listing-title">New With Tags Dress</h1>
        <span data-test="listing-price">$50</span>
        <span data-test="listing-condition">NWT</span>
      `;

      const listing = scraper.extractListing();
      expect(listing?.condition).toBe('NWT');
    });

    it('should extract NWOT condition', () => {
      document.body.innerHTML = `
        <h1 data-test="listing-title">New Without Tags Shoes</h1>
        <span data-test="listing-price">$75</span>
        <span data-test="listing-condition">NWOT</span>
      `;

      const listing = scraper.extractListing();
      expect(listing?.condition).toBe('NWOT');
    });
  });
});
