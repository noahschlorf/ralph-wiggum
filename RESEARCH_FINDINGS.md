# Marketplace Arbitrage Tool - Research Findings

## Web Research Summary (January 2025)

---

## 1. Marketplace Scraping Landscape

### Facebook Marketplace
**Challenge Level: HIGH**
- No official API exists for Marketplace listings
- DOM is heavily obfuscated with dynamic class names
- Structure changes frequently, breaking scrapers
- Requires authenticated session

**Key Selectors (may break):**
```javascript
// Container: '.x8gbvx8 .x3ct3a4'
// Name: '.xvq8zen'
// Location: '.xuxw1ft'
// Price: '.x1s688f'
```

**Recommended Approach:**
- Use multi-selector fallback strategy
- Build flexible scrapers that expect DOM changes
- Consider AI-powered field recognition for resilience

**Sources:**
- [Scrapfly Facebook Scraping Guide](https://scrapfly.io/blog/posts/how-to-scrape-facebook)
- [Multilogin Facebook Marketplace Guide 2025](https://multilogin.com/blog/web-scraping-on-facebook-marketplace/)
- [passivebot/facebook-marketplace-scraper](https://github.com/passivebot/facebook-marketplace-scraper)

---

### Mercari
**Challenge Level: MEDIUM**
- No public API available
- Cleaner DOM than Facebook
- Can use ScrapingBee or Apify for data extraction

**Sources:**
- [ScrapingBee Mercari Scraper API](https://www.scrapingbee.com/scrapers/mercari-api/)
- [Apify Mercari Product Search Scraper](https://apify.com/stealth_mode/mercari-product-search-scraper)

---

### eBay
**Challenge Level: LOW**
- Official Browse API available (v1.10.0)
- Well-documented TypeScript libraries
- Most reliable for arbitrage detection

**Best Library: `ebay-api` (hendt)**
```bash
npm install ebay-api
```

```typescript
import eBayApi from 'ebay-api';

const eBay = new eBayApi({
  appId: 'YOUR_APP_ID',
  certId: 'YOUR_CERT_ID',
  sandbox: false,
});

// Get item details
const item = await eBay.buy.browse.getItem('v1|123456789|0');
```

**Sources:**
- [ebay-api GitHub](https://github.com/hendt/ebay-api)
- [ebay-api Documentation](https://hendt.gitbook.io/ebay-api/)
- [eBay Developer Program SDKs](https://developer.ebay.com/develop/sdks-and-widgets)

---

### Amazon (via Keepa)
**Challenge Level: MEDIUM**
- Amazon SP-API only provides current prices (no history)
- Keepa provides comprehensive price history data
- Paid API with quota system

**Keepa API Details:**
- Pricing: €19/month (~$21)
- Quota: 24,000 ASINs/day (replenishes 5%/hour)
- Data includes: price history, buy box history, sales rank

**Data Format:**
```javascript
// Keepa timestamps: Add 21,564,000 and multiply by 60,000 for Unix time
// Prices are in cents
```

**Sources:**
- [Keepa.com](https://keepa.com/)
- [Keepa Python API Docs](https://keepaapi.readthedocs.io/en/latest/index.html)
- [Amazon Price History with Keepa](https://andrewkushnerov.medium.com/get-amazon-price-history-from-keepa-a313e0fc95bb)

---

## 2. Competitor Analysis

### Tactical Arbitrage (Market Leader)
- **Price:** $59-129/month
- **Features:**
  - Scans 1,500+ online stores
  - 24 million product matches daily
  - AI-powered search
  - Custom filters (ROI, sales rank, prep costs)
- **Weakness:** Overwhelming for beginners, slow on large scans

### ArbiSource
- Best alternative to Tactical Arbitrage
- Scans hundreds of stores quickly
- Good filtering options

### SmartScout
- Brand-level intelligence focus
- Helps avoid saturated markets
- Filters by revenue, seller count, Amazon in-stock rate

### Key Differentiators to Build:
1. **Cross-marketplace arbitrage** (they focus on Amazon→Amazon)
2. **Local marketplace integration** (FB, Craigslist, OfferUp)
3. **Real-time browser extension** (not just server scanning)
4. **Lower price point** for indie resellers

**Sources:**
- [Tactical Arbitrage Review 2026](https://www.thesellingguys.com/tactical-arbitrage-review/)
- [Best Online Arbitrage Tools 2025](https://www.threecolts.com/blog/best-online-arbitrage-tools/)
- [18 Best Software Tools for Amazon OA Sellers](https://www.smartscout.com/amazon-software-comparison/18-best-software-tools-for-amazon-online-arbitrage-sellers)

---

## 3. Chrome Extension Best Practices

### Recommended Architecture
1. **Manifest V3** - Required for modern extensions
2. **Content Scripts** - One per marketplace for DOM extraction
3. **Background Service Worker** - API sync, notifications
4. **Local-first** - Process data locally, sync periodically

### Avoiding Detection
- Use natural scraping delays (1-3 seconds between actions)
- Respect robots.txt where applicable
- Scrape only pages the user visits (don't auto-crawl)
- Store session data locally, don't expose tokens

### Top Extension Patterns
- **Instant Data Scraper** - Auto-detects tables/lists
- **Web Scraper** - Uses "sitemap" concept for complex navigation
- **Chat4Data** - AI-based natural language extraction

**Sources:**
- [7 Best Web Scrapers for Chrome 2025](https://www.octoparse.com/blog/top-web-scrapers-for-chrome)
- [12 Best Chrome Extension Data Scraper Tools 2025](https://ultimatewebscraper.com/blog/chrome-extension-data-scraper)
- [Chrome Extensions for Web Scraping Guide](https://outscraper.com/chrome-extensions-web-scraping-guide/)

---

## 4. Legal & Ethical Considerations

### Important Warnings
- Facebook explicitly prohibits unauthorized scraping
- Violating ToS can result in account suspension and legal action
- Build for personal use with user's own authenticated session
- Never store or redistribute scraped personal data

### Recommended Safeguards
1. Only scrape data user explicitly requests
2. Process in user's browser, minimize server storage
3. Don't auto-scrape without user action
4. Implement rate limiting to avoid detection
5. Provide clear privacy policy

---

## 5. Technology Recommendations

### For eBay Integration
```bash
pnpm add ebay-api
```
Use `@hendt/ebay-api` - TypeScript, supports all eBay APIs

### For Keepa Integration
- Create custom API client (no official Node.js library)
- Handle quota management and rate limiting

### For Scraping Resilience
- Use multiple fallback selectors
- Implement MutationObserver for SPA navigation
- Add self-healing selector logic with confidence scoring

### For Real-time Updates
- WebSocket connection to backend
- Browser extension alarms for periodic sync
- Push notifications via web-push

---

## 6. Implementation Priority (Updated)

### Phase 1: Core Foundation ✅ DONE
- Turborepo monorepo
- Shared types, validators, utilities
- eBay scraper with tests
- Chrome extension skeleton

### Phase 2: API Integrations (NEXT)
1. eBay Browse API client
2. Keepa API client
3. Server-side listing storage

### Phase 3: Remaining Scrapers
1. Facebook Marketplace (complex, fallback selectors)
2. Mercari (medium difficulty)
3. Craigslist (simple, static DOM)
4. OfferUp (medium)
5. Poshmark (medium)
6. Amazon (use Keepa data instead)

### Phase 4: Arbitrage Engine
1. Cross-platform price comparison
2. Fee calculation per marketplace
3. Profit margin estimation
4. Confidence scoring algorithm

### Phase 5: Dashboard & Alerts
1. Next.js dashboard UI
2. Watchlist management
3. Real-time alerts (email, push)
4. Analytics & insights

---

## 7. Marketplace Fee Reference

| Marketplace | Seller Fee | Notes |
|-------------|-----------|-------|
| eBay | 13.25% | Final value fee |
| Mercari | 10% | Flat fee |
| Poshmark | 20% | Flat fee |
| Amazon | 15% | Varies by category (8-45%) |
| Facebook | 0% | Free for local |
| Craigslist | 0% | Free |
| OfferUp | 0% | Free for local |

---

## Summary

This research confirms our architecture is sound. Key adjustments:

1. **Use official eBay API** instead of scraping (more reliable)
2. **Integrate Keepa** for Amazon price history (required for arbitrage)
3. **Build resilient FB scraper** with fallback selectors
4. **Focus on local-first processing** to avoid ToS issues
5. **Differentiate from Tactical Arbitrage** with cross-marketplace focus

Ready to implement Phase 2: API Integrations.
