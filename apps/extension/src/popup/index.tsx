import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { ExtensionSettings } from '../lib/types';
import { DEFAULT_SETTINGS } from '../lib/types';

interface PopupState {
  isAuthenticated: boolean;
  settings: ExtensionSettings;
  recentListings: number;
  opportunities: number;
}

function Popup() {
  const [state, setState] = useState<PopupState>({
    isAuthenticated: false,
    settings: DEFAULT_SETTINGS,
    recentListings: 0,
    opportunities: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadState();
  }, []);

  async function loadState() {
    try {
      const result = await chrome.storage.local.get([
        'authToken',
        'settings',
        'cachedListings',
      ]);

      setState({
        isAuthenticated: !!result.authToken,
        settings: result.settings || DEFAULT_SETTINGS,
        recentListings: result.cachedListings?.length || 0,
        opportunities: 0, // Will be fetched from API
      });
    } catch (error) {
      console.error('Error loading state:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    // Open login page in new tab
    chrome.tabs.create({
      url: 'https://api.arbitrage.app/auth/login?source=extension',
    });
  }

  async function handleLogout() {
    await chrome.storage.local.remove(['authToken', 'userId']);
    setState((prev) => ({ ...prev, isAuthenticated: false }));
  }

  async function toggleAutoScrape() {
    const newSettings = {
      ...state.settings,
      enableAutoScrape: !state.settings.enableAutoScrape,
    };
    await chrome.storage.local.set({ settings: newSettings });
    setState((prev) => ({ ...prev, settings: newSettings }));
  }

  function openDashboard() {
    chrome.tabs.create({
      url: 'https://api.arbitrage.app/dashboard',
    });
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Marketplace Arbitrage</h1>
        <p style={styles.subtitle}>Find deals across marketplaces</p>
      </header>

      {!state.isAuthenticated ? (
        <div style={styles.authSection}>
          <p style={styles.authText}>Sign in to sync your listings and find opportunities</p>
          <button style={styles.primaryButton} onClick={handleLogin}>
            Sign In
          </button>
        </div>
      ) : (
        <>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{state.recentListings}</div>
              <div style={styles.statLabel}>Scraped Today</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{state.opportunities}</div>
              <div style={styles.statLabel}>Opportunities</div>
            </div>
          </div>

          <div style={styles.settingsSection}>
            <div style={styles.settingRow}>
              <span>Auto-scrape listings</span>
              <button
                style={{
                  ...styles.toggle,
                  backgroundColor: state.settings.enableAutoScrape ? '#4ade80' : '#64748b',
                }}
                onClick={toggleAutoScrape}
              >
                {state.settings.enableAutoScrape ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          <div style={styles.actions}>
            <button style={styles.primaryButton} onClick={openDashboard}>
              Open Dashboard
            </button>
            <button style={styles.secondaryButton} onClick={handleLogout}>
              Sign Out
            </button>
          </div>
        </>
      )}

      <footer style={styles.footer}>
        <a href="https://arbitrage.app" target="_blank" rel="noopener" style={styles.link}>
          arbitrage.app
        </a>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '400px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '20px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#fff',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '13px',
    color: '#94a3b8',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    color: '#94a3b8',
  },
  authSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
  },
  authText: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: '14px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    marginBottom: '20px',
  },
  statCard: {
    backgroundColor: '#16213e',
    borderRadius: '8px',
    padding: '16px',
    textAlign: 'center',
  },
  statValue: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#4ade80',
  },
  statLabel: {
    fontSize: '12px',
    color: '#94a3b8',
    marginTop: '4px',
  },
  settingsSection: {
    marginBottom: '20px',
  },
  settingRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    backgroundColor: '#16213e',
    borderRadius: '8px',
  },
  toggle: {
    padding: '6px 12px',
    borderRadius: '4px',
    border: 'none',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '12px',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: 'auto',
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    color: '#94a3b8',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    width: '100%',
  },
  footer: {
    textAlign: 'center',
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid #334155',
  },
  link: {
    color: '#64748b',
    textDecoration: 'none',
    fontSize: '12px',
  },
};

const root = createRoot(document.getElementById('root')!);
root.render(<Popup />);
