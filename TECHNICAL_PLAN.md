# Marketplace Arbitrage Tool - Technical Plan

## Project Overview

A SaaS platform with Chrome extension for resellers to find arbitrage opportunities across major marketplaces.

---

## Requirements Summary

| Category | Decision |
|----------|----------|
| **Marketplaces** | eBay, FB Marketplace, Craigslist, OfferUp, Mercari, Poshmark, Amazon |
| **Platform** | SaaS Web App + Chrome Extension (hybrid) |
| **Features** | Scraping, filtering, price alerts, arbitrage detection, profit calculator |
| **Scraping** | Extension scrapes authenticated sessions → sends to SaaS backend |
| **APIs** | eBay Browse API, Keepa API, Amazon PA-API |
| **Storage** | PostgreSQL (Supabase/Neon) |
| **Stack** | Next.js 14 + TypeScript + Prisma + TailwindCSS |
| **Testing** | 90%+ coverage, Unit/Integration/E2E, Full TDD |
| **CI/CD** | GitHub Actions, automated testing, Vercel deploy |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     CHROME EXTENSION                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Scraper    │  │  Content    │  │  Background Service     │  │
│  │  Modules    │  │  Scripts    │  │  Worker                 │  │
│  │  (per site) │  │  (UI inject)│  │  (API sync, alerts)     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ WebSocket / REST API
┌─────────────────────────────────────────────────────────────────┐
│                     NEXT.JS SAAS BACKEND                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  API Routes │  │  Auth       │  │  Background Jobs        │  │
│  │  /api/*     │  │  (NextAuth) │  │  (Inngest/QStash)       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Arbitrage  │  │  Price      │  │  Notification           │  │
│  │  Engine     │  │  Tracker    │  │  Service                │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DATA LAYER                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  PostgreSQL │  │  Redis      │  │  External APIs          │  │
│  │  (Supabase) │  │  (Upstash)  │  │  (eBay, Keepa, Amazon)  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
marketplace-arbitrage/
├── apps/
│   ├── web/                      # Next.js SaaS application
│   │   ├── src/
│   │   │   ├── app/              # App router pages
│   │   │   ├── components/       # React components
│   │   │   ├── lib/              # Utilities, API clients
│   │   │   ├── services/         # Business logic
│   │   │   │   ├── arbitrage/    # Arbitrage detection engine
│   │   │   │   ├── pricing/      # Price comparison, profit calc
│   │   │   │   ├── alerts/       # Notification system
│   │   │   │   └── scrapers/     # Server-side API integrations
│   │   │   └── types/            # TypeScript types
│   │   ├── prisma/               # Database schema
│   │   └── __tests__/            # Test files
│   │
│   └── extension/                # Chrome extension
│       ├── src/
│       │   ├── background/       # Service worker
│       │   ├── content/          # Content scripts per marketplace
│       │   │   ├── ebay.ts
│       │   │   ├── facebook.ts
│       │   │   ├── craigslist.ts
│       │   │   ├── offerup.ts
│       │   │   ├── mercari.ts
│       │   │   ├── poshmark.ts
│       │   │   └── amazon.ts
│       │   ├── popup/            # Extension popup UI
│       │   └── lib/              # Shared utilities
│       ├── manifest.json
│       └── __tests__/
│
├── packages/
│   ├── shared/                   # Shared types, utils
│   │   ├── src/
│   │   │   ├── types/            # Shared TypeScript interfaces
│   │   │   ├── utils/            # Common utilities
│   │   │   └── validators/       # Zod schemas
│   │   └── __tests__/
│   │
│   └── api-clients/              # External API integrations
│       ├── src/
│       │   ├── ebay/             # eBay Browse API client
│       │   ├── keepa/            # Keepa API client
│       │   └── amazon/           # Amazon PA-API client
│       └── __tests__/
│
├── turbo.json                    # Turborepo config
├── package.json                  # Root package.json
└── .github/
    └── workflows/
        └── ci.yml                # GitHub Actions CI/CD
```

---

## Database Schema (Prisma)

```prisma
// Core models

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  image         String?
  subscription  SubscriptionTier @default(FREE)

  watchlists    Watchlist[]
  alerts        Alert[]
  listings      ScrapedListing[]

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

enum SubscriptionTier {
  FREE
  PRO
  ENTERPRISE
}

model Watchlist {
  id            String    @id @default(cuid())
  name          String
  userId        String
  user          User      @relation(fields: [userId], references: [id])

  keywords      String[]
  marketplaces  Marketplace[]
  minPrice      Float?
  maxPrice      Float?
  condition     String[]

  alerts        Alert[]

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

enum Marketplace {
  EBAY
  FACEBOOK
  CRAIGSLIST
  OFFERUP
  MERCARI
  POSHMARK
  AMAZON
}

model ScrapedListing {
  id            String      @id @default(cuid())
  externalId    String
  marketplace   Marketplace

  title         String
  description   String?
  price         Float
  currency      String      @default("USD")
  condition     String?
  location      String?
  sellerName    String?
  sellerRating  Float?
  imageUrls     String[]
  listingUrl    String

  userId        String
  user          User        @relation(fields: [userId], references: [id])

  priceHistory  PricePoint[]
  arbitrageOpps ArbitrageOpportunity[]

  scrapedAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  @@unique([externalId, marketplace])
  @@index([marketplace, price])
  @@index([title])
}

model PricePoint {
  id            String          @id @default(cuid())
  listingId     String
  listing       ScrapedListing  @relation(fields: [listingId], references: [id])

  price         Float
  recordedAt    DateTime        @default(now())
}

model ArbitrageOpportunity {
  id              String          @id @default(cuid())

  sourceListingId String
  sourceListing   ScrapedListing  @relation(fields: [sourceListingId], references: [id])

  targetMarketplace Marketplace
  estimatedSellPrice Float

  // Profit calculation
  purchasePrice   Float
  platformFees    Float
  shippingCost    Float
  estimatedProfit Float
  profitMargin    Float           // Percentage

  confidence      Float           // 0-1 score
  status          OpportunityStatus @default(ACTIVE)

  createdAt       DateTime        @default(now())
  expiresAt       DateTime?

  @@index([estimatedProfit])
  @@index([status])
}

enum OpportunityStatus {
  ACTIVE
  EXPIRED
  PURCHASED
  SOLD
  DISMISSED
}

model Alert {
  id            String      @id @default(cuid())
  userId        String
  user          User        @relation(fields: [userId], references: [id])
  watchlistId   String?
  watchlist     Watchlist?  @relation(fields: [watchlistId], references: [id])

  type          AlertType
  threshold     Float?      // For price alerts

  channels      AlertChannel[]
  isActive      Boolean     @default(true)

  createdAt     DateTime    @default(now())
}

enum AlertType {
  PRICE_DROP
  NEW_LISTING
  ARBITRAGE_OPPORTUNITY
  PRICE_THRESHOLD
}

enum AlertChannel {
  EMAIL
  PUSH
  SMS
  WEBHOOK
}
```

---

## Phase 1: Foundation (MVP)

### 1.1 Project Setup
- [x] Initialize Turborepo monorepo
- [ ] Set up Next.js 14 with App Router
- [ ] Configure TypeScript strict mode
- [ ] Set up Prisma with Supabase
- [ ] Configure TailwindCSS + shadcn/ui
- [ ] Set up authentication (NextAuth.js)
- [ ] Configure ESLint + Prettier

### 1.2 Shared Package
- [ ] Define TypeScript interfaces for listings, marketplaces
- [ ] Create Zod validation schemas
- [ ] Build utility functions (price formatting, date handling)

### 1.3 Chrome Extension Foundation
- [ ] Manifest V3 setup
- [ ] Background service worker
- [ ] Content script injection system
- [ ] Extension popup UI (React)
- [ ] Communication with SaaS backend (auth, sync)

### 1.4 Testing Infrastructure
- [ ] Vitest for unit tests
- [ ] Playwright for E2E tests
- [ ] MSW for API mocking
- [ ] GitHub Actions CI pipeline
- [ ] Coverage reporting (90%+ target)

---

## Phase 2: Scraping & Data Collection

### 2.1 Content Scripts (per marketplace)
- [ ] eBay scraper
- [ ] Facebook Marketplace scraper
- [ ] Craigslist scraper
- [ ] OfferUp scraper
- [ ] Mercari scraper
- [ ] Poshmark scraper
- [ ] Amazon scraper

### 2.2 API Integrations
- [ ] eBay Browse API client
- [ ] Keepa API client (Amazon price history)
- [ ] Amazon Product Advertising API client

### 2.3 Data Pipeline
- [ ] Listing normalization service
- [ ] Deduplication logic
- [ ] Price history tracking
- [ ] Image URL handling

---

## Phase 3: Core Features

### 3.1 Arbitrage Engine
- [ ] Cross-platform price comparison
- [ ] Fee calculation per marketplace
  - eBay: 13.25% final value fee
  - Mercari: 10% fee
  - Poshmark: 20% fee
  - Amazon: 15% referral fee (category dependent)
- [ ] Shipping cost estimation
- [ ] Profit margin calculation
- [ ] Confidence scoring algorithm

### 3.2 Alert System
- [ ] Real-time price drop detection
- [ ] New listing notifications
- [ ] Arbitrage opportunity alerts
- [ ] Email notifications (Resend)
- [ ] Push notifications (web-push)
- [ ] Webhook support

### 3.3 Dashboard
- [ ] Watchlist management
- [ ] Saved searches
- [ ] Opportunity feed
- [ ] Profit/loss tracking
- [ ] Analytics & insights

---

## Phase 4: Advanced Features

### 4.1 Profit Calculator
- [ ] Per-platform fee breakdown
- [ ] Shipping calculator
- [ ] Tax estimation
- [ ] ROI projections

### 4.2 Inventory Management
- [ ] Track purchased items
- [ ] List items across platforms
- [ ] Sales tracking
- [ ] Profit/loss reporting

### 4.3 Smart Features
- [ ] ML-based pricing suggestions
- [ ] Demand prediction
- [ ] Best time to list
- [ ] Category insights

---

## Testing Strategy

### Unit Tests (Vitest)
- All utility functions
- Zod schema validation
- Price calculation logic
- Arbitrage detection algorithms
- API client methods

### Integration Tests
- API route handlers
- Database operations (Prisma)
- External API integrations (mocked)
- Authentication flows

### E2E Tests (Playwright)
- User registration/login
- Watchlist CRUD
- Alert configuration
- Dashboard interactions
- Extension popup flows

### Coverage Requirements
- **Minimum**: 90% line coverage
- **Branches**: 85% branch coverage
- **Functions**: 95% function coverage

---

## CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm lint
      - run: pnpm type-check
      - run: pnpm test:coverage
      - run: pnpm test:e2e

      - name: Upload coverage
        uses: codecov/codecov-action@v3

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

---

## Tech Stack Summary

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14, React 18, TailwindCSS, shadcn/ui |
| **Backend** | Next.js API Routes, tRPC (optional) |
| **Database** | PostgreSQL (Supabase), Prisma ORM |
| **Cache** | Redis (Upstash) |
| **Auth** | NextAuth.js |
| **Extension** | Manifest V3, TypeScript, React |
| **Testing** | Vitest, Playwright, MSW |
| **CI/CD** | GitHub Actions, Vercel |
| **Email** | Resend |
| **Background Jobs** | Inngest or Vercel Cron |

---

## Implementation Order (TDD Approach)

1. **Week 1: Foundation**
   - Project scaffolding
   - Database schema & migrations
   - Auth setup
   - CI/CD pipeline

2. **Week 2: Shared Types & Core Logic**
   - TypeScript interfaces
   - Zod schemas
   - Price calculation utilities (tests first!)
   - Arbitrage detection algorithm (tests first!)

3. **Week 3: API Clients**
   - eBay API client (tests first!)
   - Keepa API client (tests first!)
   - Amazon PA-API client (tests first!)

4. **Week 4: Extension MVP**
   - Extension scaffolding
   - eBay content script (tests first!)
   - Background worker
   - Popup UI

5. **Week 5-6: Full Scraping**
   - Remaining marketplace scrapers
   - Data normalization
   - Sync to backend

6. **Week 7-8: Dashboard & Alerts**
   - Dashboard UI
   - Alert system
   - Email/push notifications

7. **Week 9-10: Polish & Launch**
   - E2E tests
   - Performance optimization
   - Chrome Web Store submission
   - Production deployment

---

## Approval Checklist

Please confirm:

- [ ] Architecture looks correct
- [ ] Database schema covers your needs
- [ ] Phase prioritization makes sense
- [ ] Tech stack is approved
- [ ] Testing requirements are understood
- [ ] Ready to proceed with TDD implementation

---

**AWAITING YOUR APPROVAL TO BEGIN IMPLEMENTATION**

Once you approve, I will start with TDD:
1. Write tests first
2. Implement to make tests pass
3. Refactor as needed
4. Move to next feature
