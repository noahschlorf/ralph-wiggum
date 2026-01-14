'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArbitrageCard } from '@/components/arbitrage/ArbitrageCard';

type SortOption = 'profitMargin' | 'netProfit' | 'roi';

interface ArbitrageOpportunity {
  id: string;
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
}

export default function DashboardPage() {
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [filters, setFilters] = useState({
    minProfitMargin: 10,
    sortBy: 'profitMargin' as SortOption,
  });

  const fetchOpportunities = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/arbitrage?minProfitMargin=${filters.minProfitMargin}`);
      const data = await response.json();
      setOpportunities(data.opportunities || []);
    } catch (error) {
      console.error('Error fetching opportunities:', error);
    } finally {
      setLoading(false);
    }
  }, [filters.minProfitMargin]);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  async function analyzeListings() {
    try {
      setAnalyzing(true);
      const response = await fetch('/api/arbitrage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceMarketplaces: ['FACEBOOK', 'CRAIGSLIST', 'OFFERUP', 'MERCARI'],
          targetMarketplaces: ['EBAY', 'AMAZON'],
          minProfitMargin: filters.minProfitMargin,
          saveResults: true,
        }),
      });
      const data = await response.json();
      setOpportunities(data.opportunities || []);
    } catch (error) {
      console.error('Error analyzing listings:', error);
    } finally {
      setAnalyzing(false);
    }
  }

  const sortedOpportunities = [...opportunities].sort((a, b) => {
    switch (filters.sortBy) {
      case 'netProfit':
        return b.netProfit - a.netProfit;
      case 'roi':
        return b.roi - a.roi;
      default:
        return b.profitMargin - a.profitMargin;
    }
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">
              Arbitrage Dashboard
            </h1>
            <button
              onClick={analyzeListings}
              disabled={analyzing}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {analyzing ? 'Analyzing...' : 'Find Opportunities'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Filters */}
        <div className="mb-6 rounded-lg bg-white p-4 shadow">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Min Profit Margin
              </label>
              <select
                value={filters.minProfitMargin}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, minProfitMargin: Number(e.target.value) }))
                }
                className="mt-1 rounded border-gray-300 shadow-sm"
              >
                <option value={5}>5%+</option>
                <option value={10}>10%+</option>
                <option value={20}>20%+</option>
                <option value={30}>30%+</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Sort By
              </label>
              <select
                value={filters.sortBy}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, sortBy: e.target.value as SortOption }))
                }
                className="mt-1 rounded border-gray-300 shadow-sm"
              >
                <option value="profitMargin">Profit Margin</option>
                <option value="netProfit">Net Profit</option>
                <option value="roi">ROI</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="rounded-lg bg-white p-4 shadow">
            <p className="text-sm text-gray-500">Total Opportunities</p>
            <p className="text-2xl font-bold text-gray-900">{opportunities.length}</p>
          </div>
          <div className="rounded-lg bg-white p-4 shadow">
            <p className="text-sm text-gray-500">Avg Profit Margin</p>
            <p className="text-2xl font-bold text-green-600">
              {opportunities.length > 0
                ? (opportunities.reduce((acc, o) => acc + o.profitMargin, 0) / opportunities.length).toFixed(1)
                : 0}%
            </p>
          </div>
          <div className="rounded-lg bg-white p-4 shadow">
            <p className="text-sm text-gray-500">Total Potential Profit</p>
            <p className="text-2xl font-bold text-green-600">
              ${opportunities.reduce((acc, o) => acc + o.netProfit, 0).toFixed(2)}
            </p>
          </div>
          <div className="rounded-lg bg-white p-4 shadow">
            <p className="text-sm text-gray-500">High Profit (&gt;30%)</p>
            <p className="text-2xl font-bold text-blue-600">
              {opportunities.filter((o) => o.profitMargin >= 30).length}
            </p>
          </div>
        </div>

        {/* Opportunities Grid */}
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
          </div>
        ) : sortedOpportunities.length === 0 ? (
          <div className="rounded-lg bg-white p-8 text-center shadow">
            <p className="text-gray-500">
              No arbitrage opportunities found. Try analyzing listings or adjusting filters.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedOpportunities.map((opportunity, index) => (
              <ArbitrageCard
                key={opportunity.id || index}
                opportunity={opportunity}
                showDetails
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
