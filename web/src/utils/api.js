const API_BASE = '';
const MIN_INTERVAL_MS = 1000;
const CACHE_TTL_MS = 5000;
let lastCallTime = 0;
let pendingDelay = Promise.resolve();

/** Inflight requests keyed by URL — deduplicates concurrent identical calls. */
const inflight = new Map();

/** Recent response cache keyed by URL — entries expire after CACHE_TTL_MS. */
const cache = new Map();

/**
 * Ensure at most 1 RPC per second by waiting if needed.
 */
async function rateLimit() {
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < MIN_INTERVAL_MS) {
    const wait = MIN_INTERVAL_MS - elapsed;
    // Chain delays so concurrent callers queue up sequentially
    pendingDelay = pendingDelay.then(
      () => new Promise((resolve) => setTimeout(resolve, wait))
    );
    await pendingDelay;
  }
  lastCallTime = Date.now();
}

/**
 * Deduplicated & cached fetch.
 * - If the same URL is already inflight, reuses the same promise.
 * - If a successful response for the same URL is cached within CACHE_TTL_MS, returns it.
 * @param {string} url
 * @returns {Promise<any>}
 */
async function dedupedFetch(url) {
  // 1. Check cache
  const cached = cache.get(url);
  if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
    return cached.data;
  }

  // 2. Check inflight
  if (inflight.has(url)) {
    return inflight.get(url);
  }

  // 3. Make the request
  const promise = (async () => {
    await rateLimit();
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }
    const data = await res.json();

    // Store in cache
    cache.set(url, { data, time: Date.now() });

    return data;
  })();

  // Store as inflight
  inflight.set(url, promise);

  // Clean up inflight entry when done (success or failure)
  promise.finally(() => {
    inflight.delete(url);
  });

  return promise;
}

/**
 * Fetch station board data (departures or arrivals).
 * Deduplicates identical inflight requests and caches responses for 5s.
 * @param {string} stationId
 * @param {'departure'|'arrival'} type
 * @param {string} [timestamp] - ISO 8601 timestamp
 * @returns {Promise<import('./types').Journey[]>}
 */
export async function fetchStationBoard(stationId, type, timestamp) {
  const params = timestamp ? `?timestamp=${encodeURIComponent(timestamp)}` : '';
  const url = `${API_BASE}/station/${encodeURIComponent(stationId)}/${type}${params}`;
  return dedupedFetch(url);
}

/**
 * Fetch all stops for a specific journey.
 * Deduplicates identical inflight requests and caches responses for 5s.
 * @param {string} journeyRef
 * @param {string} operatingDayRef
 * @returns {Promise<import('./types').Stop[]>}
 */
export async function fetchJourneyStops(journeyRef, operatingDayRef) {
  const url = `${API_BASE}/journey/${encodeURIComponent(journeyRef)}/${encodeURIComponent(operatingDayRef)}`;
  return dedupedFetch(url);
}
