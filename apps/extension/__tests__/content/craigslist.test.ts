import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock chrome API
const mockChrome = {
  runtime: {
    sendMessage: vi.fn(),
  },
};
vi.stubGlobal('chrome', mockChrome);

import { CraigslistScraper } from '../../src/content/craigslist';

describe('CraigslistScraper', () => {
  let scraper: CraigslistScraper;

  beforeEach(() => {
    scraper = new CraigslistScraper();
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('isListingPage', () => {
    it('should return true for Craigslist item pages', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://sfbay.craigslist.org/sfc/ele/d/san-francisco-iphone-14-pro/7654321012.html' },
        writable: true,
      });

      expect(scraper.isListingPage()).toBe(true);
    });

    it('should return true for different city subdomains', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://newyork.craigslist.org/mnh/mob/d/new-york-macbook-pro/1234567890.html' },
        writable: true,
      });

      expect(scraper.isListingPage()).toBe(true);
    });

    it('should return false for search pages', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://sfbay.craigslist.org/search/sss?query=iphone' },
        writable: true,
      });

      expect(scraper.isListingPage()).toBe(false);
    });

    it('should return false for home page', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://sfbay.craigslist.org/' },
        writable: true,
      });

      expect(scraper.isListingPage()).toBe(false);
    });

    it('should return false for category pages', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://sfbay.craigslist.org/d/for-sale/search/sss' },
        writable: true,
      });

      expect(scraper.isListingPage()).toBe(false);
    });
  });

  describe('extractListing', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://sfbay.craigslist.org/sfc/ele/d/san-francisco-vintage-camera/7654321012.html' },
        writable: true,
      });
    });

    it('should extract listing with standard selectors', () => {
      document.body.innerHTML = `
        <section class="body">
          <h1 class="postingtitle">
            <span class="postingtitletext">
              <span class="titletextonly">Vintage Film Camera - Canon AE-1</span>
              <span class="price">$250</span>
            </span>
          </h1>
          <section id="postingbody">
            Great condition, works perfectly. Includes lens and strap.
          </section>
          <div class="mapaddress">San Francisco, CA</div>
          <figure class="iw">
            <div class="gallery">
              <img src="https://images.craigslist.org/img1.jpg" />
              <img src="https://images.craigslist.org/img2.jpg" />
            </div>
          </figure>
        </section>
      `;

      const listing = scraper.extractListing();

      expect(listing).not.toBeNull();
      expect(listing?.externalId).toBe('7654321012');
      expect(listing?.marketplace).toBe('CRAIGSLIST');
      expect(listing?.title).toBe('Vintage Film Camera - Canon AE-1');
      expect(listing?.price).toBe(250);
      expect(listing?.currency).toBe('USD');
      expect(listing?.location).toBe('San Francisco, CA');
    });

    it('should handle missing optional fields gracefully', () => {
      document.body.innerHTML = `
        <section class="body">
          <h1 class="postingtitle">
            <span class="postingtitletext">
              <span class="titletextonly">Free Couch</span>
            </span>
          </h1>
        </section>
      `;

      const listing = scraper.extractListing();

      expect(listing).not.toBeNull();
      expect(listing?.title).toBe('Free Couch');
      expect(listing?.price).toBe(0);
      // Location extracted from URL as fallback
      expect(listing?.location).toBe('sfbay');
      expect(listing?.description).toBeUndefined();
    });

    it('should return null if title is missing', () => {
      document.body.innerHTML = `
        <section class="body">
          <span class="price">$100</span>
        </section>
      `;

      const listing = scraper.extractListing();
      expect(listing).toBeNull();
    });

    it('should extract images from gallery', () => {
      document.body.innerHTML = `
        <section class="body">
          <span class="titletextonly">Multi Image Item</span>
          <span class="price">$200</span>
          <div id="thumbs">
            <a href="https://images.craigslist.org/full1.jpg">
              <img src="https://images.craigslist.org/thumb1.jpg" />
            </a>
            <a href="https://images.craigslist.org/full2.jpg">
              <img src="https://images.craigslist.org/thumb2.jpg" />
            </a>
          </div>
        </section>
      `;

      const listing = scraper.extractListing();

      expect(listing?.imageUrls.length).toBeGreaterThanOrEqual(1);
    });

    it('should use fallback selectors when primary fail', () => {
      document.body.innerHTML = `
        <section class="body">
          <h2 id="titletextonly">Antique Table</h2>
          <span class="price">$400</span>
        </section>
      `;

      const listing = scraper.extractListing();

      expect(listing).not.toBeNull();
      expect(listing?.title).toBe('Antique Table');
      expect(listing?.price).toBe(400);
    });

    it('should extract city from URL when not in DOM', () => {
      document.body.innerHTML = `
        <section class="body">
          <span class="titletextonly">Local Pickup Item</span>
          <span class="price">$50</span>
        </section>
      `;

      const listing = scraper.extractListing();

      // Should extract 'sfbay' from URL
      expect(listing?.location).toContain('sfbay');
    });
  });

  describe('price parsing', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://sfbay.craigslist.org/sfc/ele/d/test/7654321012.html' },
        writable: true,
      });
    });

    const priceTests = [
      { input: '$1,234', expected: 1234 },
      { input: '$99', expected: 99 },
      { input: '$0', expected: 0 },
      { input: '', expected: 0 }, // Free items often have no price
      { input: '$1,234,567', expected: 1234567 },
    ];

    priceTests.forEach(({ input, expected }) => {
      it(`should parse "${input}" as ${expected}`, () => {
        document.body.innerHTML = `
          <span class="titletextonly">Test Item</span>
          <span class="price">${input}</span>
        `;

        const listing = scraper.extractListing();
        expect(listing?.price).toBe(expected);
      });
    });
  });
});
