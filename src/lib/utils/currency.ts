/**
 * Live Currency Exchange Rate Service & Persistent Default Store
 * Provides CNY (¥) <-> USD ($) conversion where the last synced rate
 * automatically becomes and remains the permanent default.
 */

const FALLBACK_DEFAULT_RATE = 7.25;
const RATE_STORAGE_KEY = 'sourcing_usd_cny_rate';
const RATE_TIMESTAMP_KEY = 'sourcing_rate_timestamp';
const RATE_CHANGED_EVENT = 'sourcing-rate-changed';

export interface ExchangeRateInfo {
  rate: number; // 1 USD = rate CNY (e.g. 7.25)
  lastUpdated: string;
  source: 'live' | 'cache' | 'default';
}

/**
 * Returns the active default exchange rate.
 * Uses the last synced/saved rate from localStorage permanently.
 */
export function getStoredExchangeRate(): number {
  if (typeof window === 'undefined') return FALLBACK_DEFAULT_RATE;
  try {
    const saved = localStorage.getItem(RATE_STORAGE_KEY);
    const parsed = saved ? parseFloat(saved) : NaN;
    return !isNaN(parsed) && parsed > 0 ? parsed : FALLBACK_DEFAULT_RATE;
  } catch {
    return FALLBACK_DEFAULT_RATE;
  }
}

/**
 * Persistently stores the exchange rate as the new permanent default
 * and broadcasts an event to keep all open components in sync.
 */
export function setStoredExchangeRate(rate: number): void {
  if (typeof window === 'undefined' || isNaN(rate) || rate <= 0) return;
  try {
    localStorage.setItem(RATE_STORAGE_KEY, String(rate));
    localStorage.setItem(RATE_TIMESTAMP_KEY, new Date().toISOString());

    // Dispatch cross-component change notification
    window.dispatchEvent(
      new CustomEvent(RATE_CHANGED_EVENT, {
        detail: { rate, timestamp: new Date().toISOString() },
      })
    );
  } catch (err) {
    console.error('Error saving exchange rate to localStorage:', err);
  }
}

/**
 * Fetches live exchange rate from open API and immediately sets it
 * as the persistent default. If offline, returns the last saved default.
 */
export async function fetchLiveExchangeRate(): Promise<ExchangeRateInfo> {
  const lastSavedRate = getStoredExchangeRate();
  const lastTimestamp =
    typeof window !== 'undefined'
      ? localStorage.getItem(RATE_TIMESTAMP_KEY) || new Date().toISOString()
      : new Date().toISOString();

  // Try fetching live rates from open API
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

    const data = await res.json();
    const cnyRate = data?.rates?.CNY;

    if (typeof cnyRate === 'number' && cnyRate > 0) {
      const formattedRate = Number(cnyRate.toFixed(4));
      // Save permanently as the new default
      setStoredExchangeRate(formattedRate);
      return {
        rate: formattedRate,
        lastUpdated: new Date().toISOString(),
        source: 'live',
      };
    }
  } catch (err) {
    console.warn('Could not fetch live rate, using persisted default:', err);
  }

  return {
    rate: lastSavedRate,
    lastUpdated: lastTimestamp,
    source: lastSavedRate !== FALLBACK_DEFAULT_RATE ? 'cache' : 'default',
  };
}

export function convertCNYtoUSD(cnyAmount: number, rate = getStoredExchangeRate()): number {
  if (!cnyAmount || isNaN(cnyAmount) || !rate || rate <= 0) return 0;
  return Number((cnyAmount / rate).toFixed(2));
}

export function convertUSDtoCNY(usdAmount: number, rate = getStoredExchangeRate()): number {
  if (!usdAmount || isNaN(usdAmount) || !rate || rate <= 0) return 0;
  return Number((usdAmount * rate).toFixed(2));
}
