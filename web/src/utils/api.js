const API_BASE = '';

/**
 * Fetch station board data (departures or arrivals).
 * @param {string} stationId
 * @param {'departure'|'arrival'} type
 * @param {string} [timestamp] - ISO 8601 timestamp
 * @returns {Promise<import('./types').Journey[]>}
 */
export async function fetchStationBoard(stationId, type, timestamp) {
  const params = timestamp ? `?timestamp=${encodeURIComponent(timestamp)}` : '';
  const res = await fetch(`${API_BASE}/station/${encodeURIComponent(stationId)}/${type}${params}`);
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}
