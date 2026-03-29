/**
 * Format an ISO timestamp to HH:MM in the user's local timezone.
 * @param {string} isoString
 * @returns {string}
 */
export function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString('de-CH', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Compute the delay in minutes between planned and estimated times.
 * Returns a positive number for delays, negative for early, or null if on-time / no estimate.
 * @param {string} planned - ISO timestamp
 * @param {string} estimated - ISO timestamp
 * @returns {number|null}
 */
export function getDelayMinutes(planned, estimated) {
  if (!planned || !estimated) return null;
  const diff = Math.round((new Date(estimated) - new Date(planned)) / 60000);
  return diff === 0 ? null : diff;
}

/**
 * Format a date to a human-readable date header (e.g., "Sat, 29 Mar").
 * @param {Date} date
 * @returns {string}
 */
export function formatDateHeader(date) {
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Check if two ISO timestamps are on the same calendar day (local time).
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function isSameDay(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}
