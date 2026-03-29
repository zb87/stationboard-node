const API_BASE = '';
const MIN_INTERVAL_MS = 1000;
let lastCallTime = 0;
let pendingDelay = Promise.resolve();

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
 * Fetch station board data (departures or arrivals).
 * Rate-limited to at most 1 request per second.
 * @param {string} stationId
 * @param {'departure'|'arrival'} type
 * @param {string} [timestamp] - ISO 8601 timestamp
 * @returns {Promise<import('./types').Journey[]>}
 */
export async function fetchStationBoard(stationId, type, timestamp) {
  await rateLimit();
  const params = timestamp ? `?timestamp=${encodeURIComponent(timestamp)}` : '';
  const res = await fetch(`${API_BASE}/station/${encodeURIComponent(stationId)}/${type}${params}`);
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch all stops for a specific journey.
 * Rate-limited to at most 1 request per second.
 * @param {string} journeyRef
 * @param {string} operatingDayRef
 * @returns {Promise<import('./types').Stop[]>}
 */
export async function fetchJourneyStops(journeyRef, operatingDayRef) {
  await rateLimit();
  const res = await fetch(
    `${API_BASE}/journey/${encodeURIComponent(journeyRef)}/${encodeURIComponent(operatingDayRef)}`
  );
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}
