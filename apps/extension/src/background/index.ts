/**
 * Background Service Worker
 * Handles communication between content scripts and the SaaS backend
 */

import type { ScrapedListingMessage, SyncResponse } from '../lib/types';

// API base URL (will be configured via extension settings)
const API_BASE_URL = 'https://api.arbitrage.app';

/**
 * Handle messages from content scripts
 */
chrome.runtime.onMessage.addListener(
  (message: ScrapedListingMessage, _sender, sendResponse) => {
    if (message.type === 'LISTING_SCRAPED') {
      handleListingScraped(message.payload)
        .then(sendResponse)
        .catch((error) => {
          console.error('Error handling scraped listing:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Indicates async response
    }

    if (message.type === 'GET_AUTH_TOKEN') {
      getAuthToken()
        .then(sendResponse)
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });
      return true;
    }

    return false;
  }
);

/**
 * Handle a scraped listing from a content script
 */
async function handleListingScraped(
  listing: ScrapedListingMessage['payload']
): Promise<SyncResponse> {
  try {
    const token = await getAuthToken();

    if (!token) {
      return {
        success: false,
        error: 'Not authenticated. Please log in.',
      };
    }

    const response = await fetch(`${API_BASE_URL}/api/listings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(listing),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error syncing listing:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get the authentication token from storage
 */
async function getAuthToken(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['authToken'], (result) => {
      resolve(result.authToken || null);
    });
  });
}

/**
 * Set up periodic sync alarm
 */
chrome.alarms.create('syncListings', { periodInMinutes: 15 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'syncListings') {
    console.log('Periodic sync triggered');
    // TODO: Implement batch sync of cached listings
  }
});

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Extension installed');
    // Open onboarding page
    chrome.tabs.create({
      url: `${API_BASE_URL}/onboarding?source=extension`,
    });
  }
});

export {};
