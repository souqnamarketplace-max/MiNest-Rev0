/**
 * CountryContext — Global country state (Canada/USA)
 * Auto-detects, persists to localStorage + user profile
 * Fetches live CAD/USD exchange rate from open API
 */
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';

const CountryContext = createContext({
  country: 'Canada',
  setCountry: () => {},
  currency: 'CAD',
  flag: '🍁',
  isLoaded: false,
  exchangeRate: 1,        // CAD to USD rate (e.g. 0.73)
  convertPrice: (amount) => amount,  // Convert CAD price to active currency
});

const COUNTRY_CONFIG = {
  'Canada': { currency: 'CAD', flag: '🍁', short: 'CA' },
  'United States': { currency: 'USD', flag: '🇺🇸', short: 'US' },
};

const SESSION_KEY = 'minest-country-user-set';
const RATE_CACHE_KEY = 'minest-cad-usd-rate';
const RATE_CACHE_TTL = 3600000; // 1 hour in ms

function detectCountry() {
  try {
    const stored = localStorage.getItem('minest-country');
    if (stored && COUNTRY_CONFIG[stored]) return stored;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const usTimezones = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Phoenix', 'America/Anchorage', 'America/Honolulu'];
    if (usTimezones.includes(tz)) return 'United States';
    const lang = navigator.language || 'en-CA';
    if (lang.endsWith('-US')) return 'United States';
    return 'Canada';
  } catch {
    return 'Canada';
  }
}

// Fetch live CAD→USD exchange rate with caching
async function fetchExchangeRate() {
  try {
    // Check cache first
    const cached = localStorage.getItem(RATE_CACHE_KEY);
    if (cached) {
      try {
        const { rate, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < RATE_CACHE_TTL) return rate;
      } catch {}
    }
    // Try multiple CORS-friendly exchange rate sources
    const sources = [
      'https://open.er-api.com/v6/latest/CAD',
      'https://api.exchangerate-api.com/v4/latest/CAD',
    ];
    for (const url of sources) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) continue;
        const data = await res.json();
        // Handle different API response formats
        const rate = data.rates?.USD || data.conversion_rates?.USD || null;
        if (rate) {
          localStorage.setItem(RATE_CACHE_KEY, JSON.stringify({ rate, timestamp: Date.now() }));
          return rate;
        }
      } catch {}
    }
    throw new Error('All sources failed');
  } catch {
    // Fallback: use cached rate if available, otherwise use Apr 2026 approximate
    try {
      const cached = localStorage.getItem(RATE_CACHE_KEY);
      if (cached) {
        const { rate } = JSON.parse(cached);
        if (rate) return rate;
      }
    } catch {}
    // Hard fallback: 1 CAD = 0.73 USD (Apr 2026 approximate)
    return 0.73;
  }
}

export function CountryProvider({ children }) {
  const { user } = useAuth();
  const [country, setCountryState] = useState('Canada');
  const [isLoaded, setIsLoaded] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(0.73); // CAD to USD

  // Initial detection on mount
  useEffect(() => {
    const detected = detectCountry();
    setCountryState(detected);
    setIsLoaded(true);
  }, []);

  // Fetch live exchange rate on mount
  useEffect(() => {
    fetchExchangeRate().then(rate => setExchangeRate(rate));
  }, []);

  // Sync with user profile when logged in — but ONLY if user hasn't manually set it this session
  useEffect(() => {
    if (!user?.id) return;
    const userSetThisSession = sessionStorage.getItem(SESSION_KEY);
    if (userSetThisSession) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('preferred_country')
          .eq('user_id', user.id)
          .maybeSingle();
        if (data?.preferred_country && COUNTRY_CONFIG[data.preferred_country]) {
          const localStored = localStorage.getItem('minest-country');
          if (!localStored || !COUNTRY_CONFIG[localStored]) {
            setCountryState(data.preferred_country);
            localStorage.setItem('minest-country', data.preferred_country);
          }
        }
      } catch {}
    })();
  }, [user?.id]);

  const setCountry = async (newCountry) => {
    if (!COUNTRY_CONFIG[newCountry]) return;
    setCountryState(newCountry);
    localStorage.setItem('minest-country', newCountry);
    sessionStorage.setItem(SESSION_KEY, '1');
    if (user?.id) {
      try {
        await supabase
          .from('user_profiles')
          .update({ preferred_country: newCountry })
          .eq('user_id', user.id);
      } catch {}
    }
  };

  // Convert a CAD price to the active currency
  const convertPrice = (cadAmount) => {
    if (!cadAmount) return 0;
    if (country === 'United States') {
      return Math.round(cadAmount * exchangeRate);
    }
    return Math.round(cadAmount);
  };

  const config = COUNTRY_CONFIG[country] || COUNTRY_CONFIG['Canada'];

  return (
    <CountryContext.Provider value={{
      country,
      setCountry,
      currency: config.currency,
      flag: config.flag,
      short: config.short,
      isLoaded,
      exchangeRate,
      convertPrice,
    }}>
      {children}
    </CountryContext.Provider>
  );
}

export function useCountry() {
  return useContext(CountryContext);
}
