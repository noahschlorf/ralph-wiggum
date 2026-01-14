'use client';

interface ArbitrageCardProps {
  opportunity: {
    id?: string;
    sourceMarketplace: string;
    targetMarketplace: string;
    sourcePrice: number;
    targetPrice: number;
    grossProfit: number;
    fees: number;
    shippingCost: number;
    netProfit: number;
    profitMargin: number;
    roi: number;
    sourceListing: {
      title: string;
      url: string;
      images?: string[];
    };
    targetListing: {
      title: string;
      url: string;
    };
  };
  showDetails?: boolean;
}

const marketplaceColors: Record<string, string> = {
  EBAY: 'bg-blue-500',
  AMAZON: 'bg-orange-500',
  FACEBOOK: 'bg-blue-600',
  CRAIGSLIST: 'bg-purple-500',
  OFFERUP: 'bg-green-500',
  MERCARI: 'bg-red-500',
  POSHMARK: 'bg-pink-500',
};

export function ArbitrageCard({ opportunity, showDetails = false }: ArbitrageCardProps) {
  const isHighProfit = opportunity.profitMargin >= 30;

  return (
    <div
      data-testid="arbitrage-card"
      className={`rounded-lg border p-4 shadow-sm transition-shadow hover:shadow-md ${
        isHighProfit ? 'high-profit border-green-500 bg-green-50' : 'border-gray-200 bg-white'
      }`}
    >
      {/* Header with title */}
      <div className="mb-3 flex items-start justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          {opportunity.sourceListing.title}
        </h3>
        <span
          className={`rounded-full px-2 py-1 text-xs font-bold ${
            isHighProfit ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700'
          }`}
        >
          {opportunity.profitMargin.toFixed(2)}%
        </span>
      </div>

      {/* Marketplace flow */}
      <div className="mb-4 flex items-center gap-2">
        <span
          className={`rounded px-2 py-1 text-xs font-medium text-white ${
            marketplaceColors[opportunity.sourceMarketplace] || 'bg-gray-500'
          }`}
        >
          {opportunity.sourceMarketplace}
        </span>
        <span className="text-gray-400">→</span>
        <span
          className={`rounded px-2 py-1 text-xs font-medium text-white ${
            marketplaceColors[opportunity.targetMarketplace] || 'bg-gray-500'
          }`}
        >
          {opportunity.targetMarketplace}
        </span>
      </div>

      {/* Price comparison */}
      <div className="mb-4 grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-sm text-gray-500">Buy</p>
          <p className="text-lg font-bold text-gray-900">${opportunity.sourcePrice.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Sell</p>
          <p className="text-lg font-bold text-gray-900">${opportunity.targetPrice.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Profit</p>
          <p className="text-lg font-bold text-green-600">${opportunity.netProfit.toFixed(2)}</p>
        </div>
      </div>

      {/* Details section */}
      {showDetails && (
        <div className="border-t border-gray-100 pt-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Gross Profit:</span>
              <span className="font-medium">${opportunity.grossProfit.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">ROI:</span>
              <span className="font-medium">{opportunity.roi.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Fees:</span>
              <span className="font-medium text-red-500">-${opportunity.fees.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Shipping:</span>
              <span className="font-medium text-red-500">-${opportunity.shippingCost.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Action links */}
      <div className="mt-4 flex gap-2">
        <a
          href={opportunity.sourceListing.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded bg-blue-500 px-3 py-2 text-center text-sm font-medium text-white hover:bg-blue-600"
        >
          View Source
        </a>
        <a
          href={opportunity.targetListing.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded bg-gray-500 px-3 py-2 text-center text-sm font-medium text-white hover:bg-gray-600"
        >
          View Target
        </a>
      </div>
    </div>
  );
}

export default ArbitrageCard;
