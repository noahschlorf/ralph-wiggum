import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ArbitrageCard } from '../../src/components/arbitrage/ArbitrageCard';

describe('ArbitrageCard', () => {
  const mockOpportunity = {
    id: '1',
    sourceMarketplace: 'FACEBOOK' as const,
    targetMarketplace: 'EBAY' as const,
    sourcePrice: 100,
    targetPrice: 180,
    grossProfit: 80,
    fees: 23.4,
    shippingCost: 10,
    netProfit: 46.6,
    profitMargin: 25.89,
    roi: 46.6,
    sourceListing: {
      title: 'iPhone 14 Pro Max',
      url: 'https://facebook.com/marketplace/item/123',
      images: ['https://example.com/img.jpg'],
    },
    targetListing: {
      title: 'iPhone 14 Pro Max 256GB',
      url: 'https://ebay.com/itm/456',
    },
  };

  it('should render opportunity details', () => {
    render(<ArbitrageCard opportunity={mockOpportunity} />);

    expect(screen.getByText('iPhone 14 Pro Max')).toBeInTheDocument();
    expect(screen.getByText(/\$46\.60/)).toBeInTheDocument();
    expect(screen.getByText(/25\.89%/)).toBeInTheDocument();
  });

  it('should show source and target prices', () => {
    render(<ArbitrageCard opportunity={mockOpportunity} />);

    expect(screen.getByText(/\$100/)).toBeInTheDocument();
    expect(screen.getByText(/\$180/)).toBeInTheDocument();
  });

  it('should display marketplace badges', () => {
    render(<ArbitrageCard opportunity={mockOpportunity} />);

    expect(screen.getByText('FACEBOOK')).toBeInTheDocument();
    expect(screen.getByText('EBAY')).toBeInTheDocument();
  });

  it('should show profit breakdown on expand', async () => {
    render(<ArbitrageCard opportunity={mockOpportunity} showDetails />);

    expect(screen.getByText(/Fees:/)).toBeInTheDocument();
    expect(screen.getByText(/Shipping:/)).toBeInTheDocument();
  });

  it('should highlight high profit opportunities', () => {
    const highProfitOpp = {
      ...mockOpportunity,
      profitMargin: 50,
      netProfit: 100,
    };

    render(<ArbitrageCard opportunity={highProfitOpp} />);

    // High profit should have special styling
    const card = screen.getByTestId('arbitrage-card');
    expect(card).toHaveClass('high-profit');
  });

  it('should render links to source and target listings', () => {
    render(<ArbitrageCard opportunity={mockOpportunity} />);

    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThanOrEqual(1);
  });
});
