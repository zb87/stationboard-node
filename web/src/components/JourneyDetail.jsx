import { useState, useEffect } from 'react';
import { fetchJourneyStops } from '../utils/api.js';
import { formatTime, getDelayMinutes } from '../utils/time.js';
import './JourneyDetail.css';

/**
 * Determine where the train currently is relative to the stops list.
 *
 * Returns an object:
 *   { type: 'at', index }       — train is at stop[index]
 *   { type: 'between', fromIndex, toIndex, fraction }
 *   { type: 'before' }          — before the first stop
 *   { type: 'after' }           — past the last stop
 *   null                        — unable to determine
 */
function getTrainPosition(stops, now) {
  if (!stops || stops.length === 0) return null;

  /** Get the "effective" time for a stop (use estimated if available, else planned) */
  function effectiveTime(stop) {
    const dep = stop.departure?.estimated || stop.departure?.planned;
    const arr = stop.arrival?.estimated || stop.arrival?.planned;
    // Use departure if available, fallback to arrival
    return dep || arr;
  }

  const times = stops.map((s) => {
    const t = effectiveTime(s);
    return t ? new Date(t).getTime() : null;
  });

  const nowMs = now.getTime();

  // Before first stop
  if (times[0] !== null && nowMs < times[0]) {
    return { type: 'before' };
  }

  // After last stop
  const lastIdx = times.length - 1;
  if (times[lastIdx] !== null && nowMs > times[lastIdx]) {
    return { type: 'after' };
  }

  // Find which segment we're in
  for (let i = 0; i < stops.length; i++) {
    if (times[i] === null) continue;

    // At this stop (within 30-second window)
    const arrTime = stop => {
      const a = stop.arrival?.estimated || stop.arrival?.planned;
      return a ? new Date(a).getTime() : null;
    };
    const depTime = stop => {
      const d = stop.departure?.estimated || stop.departure?.planned;
      return d ? new Date(d).getTime() : null;
    };

    const arr = arrTime(stops[i]);
    const dep = depTime(stops[i]);

    // If train is between arrival and departure of same stop
    if (arr !== null && dep !== null && nowMs >= arr && nowMs <= dep) {
      return { type: 'at', index: i };
    }

    // If only one of them and we're close
    if (times[i] !== null && Math.abs(nowMs - times[i]) < 30000) {
      return { type: 'at', index: i };
    }

    // Between this stop and the next
    if (i < stops.length - 1) {
      const nextTime = times[i + 1];
      if (nextTime !== null && times[i] !== null && nowMs >= times[i] && nowMs <= nextTime) {
        const total = nextTime - times[i];
        const elapsed = nowMs - times[i];
        const fraction = total > 0 ? elapsed / total : 0;
        return { type: 'between', fromIndex: i, toIndex: i + 1, fraction };
      }
    }
  }

  return null;
}

/**
 * Determine stop's temporal state (past / active / future) for styling.
 */
function getStopState(stop, position, index) {
  if (!position) return '';
  if (position.type === 'before') return 'future';
  if (position.type === 'after') return 'past';
  if (position.type === 'at') {
    if (index < position.index) return 'past';
    if (index === position.index) return '';
    return 'future';
  }
  if (position.type === 'between') {
    if (index <= position.fromIndex) return 'past';
    return 'future';
  }
  return '';
}

function BackArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function StopRow({ stop, index, isFirst, isLast, position }) {
  const arrDelay = getDelayMinutes(stop.arrival?.planned, stop.arrival?.estimated);
  const depDelay = getDelayMinutes(stop.departure?.planned, stop.departure?.estimated);

  const stopState = getStopState(stop, position, index);
  const isActive = position?.type === 'at' && position.index === index;

  const platform = stop.platform?.estimated || stop.platform?.planned;

  // Determine if this is a "passing" stop (has only times but isn't a scheduled stop)
  const hasArrival = stop.arrival?.planned;
  const hasDeparture = stop.departure?.planned;
  const isMuted = !isFirst && !isLast && !hasArrival && !hasDeparture;

  let rowClass = 'stop-row';
  if (stop.cancelled) rowClass += ' cancelled';
  if (stopState) rowClass += ` ${stopState}`;
  if (isMuted) rowClass += ' muted-stop';

  return (
    <div className={rowClass} style={{ animationDelay: `${index * 40}ms` }}>
      {/* Time column */}
      <div className="stop-time-col">
        {hasArrival && (
          <div className="stop-time-group">
            <span className={`stop-time ${hasDeparture ? 'muted' : ''}`}>
              {formatTime(stop.arrival.planned)}
            </span>
            {arrDelay !== null && (
              <span className={`stop-delay ${arrDelay > 0 ? 'delay-late' : 'delay-early'}`}>
                {arrDelay > 0 ? `+${arrDelay}` : arrDelay}
              </span>
            )}
          </div>
        )}
        {hasDeparture && (
          <div className="stop-time-group">
            <span className="stop-time">
              {formatTime(stop.departure.planned)}
            </span>
            {depDelay !== null && (
              <span className={`stop-delay ${depDelay > 0 ? 'delay-late' : 'delay-early'}`}>
                {depDelay > 0 ? `+${depDelay}` : depDelay}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Timeline column */}
      <div className="stop-timeline-col">
        <div className="stop-timeline-line-top" />
        <div className={`stop-timeline-dot ${isActive ? 'active' : ''}`} />
        <div className="stop-timeline-line-bottom" />
      </div>

      {/* Station info */}
      <div className="stop-info-col">
        <span className="stop-station-name">{stop.station?.name}</span>
        {platform && (
          <span className="stop-platform">
            <span className="stop-platform-label">Pl.</span>
            {platform}
          </span>
        )}
      </div>
    </div>
  );
}

export default function JourneyDetail({ journey, onBack }) {
  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(new Date());

  // Fetch stops on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchJourneyStops(journey.journeyRef, journey.operatingDayRef);
        if (!cancelled) {
          setStops(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [journey.journeyRef, journey.operatingDayRef]);

  // Update "now" every 10s for live train position
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const position = getTrainPosition(stops, now);
  const destination = journey.destination?.name || '';

  return (
    <div className="journey-detail">
      <div className="journey-detail-header">
        <button
          className="journey-detail-back"
          onClick={onBack}
          aria-label="Go back"
          id="journey-back-btn"
        >
          <BackArrowIcon />
        </button>
        <div className="journey-detail-title-group">
          <div className="journey-detail-title">
            <div className={`journey-badge ${getServiceColorClass(journey.name)}`}>
              {journey.name}
            </div>
            <span className="header-station" style={{ fontSize: '1.1rem' }}>
              → {destination}
            </span>
          </div>
          <span className="journey-detail-subtitle">Journey details</span>
        </div>
      </div>

      {loading && (
        <div className="journey-detail-loading">
          <div className="loading-dots">
            <span></span><span></span><span></span>
          </div>
          <span>Loading stops…</span>
        </div>
      )}

      {error && (
        <div className="journey-detail-error">
          <span className="error-icon">⚠</span>
          {error}
        </div>
      )}

      {!loading && !error && stops.length === 0 && (
        <div className="journey-detail-loading">
          <span>No stop data available</span>
        </div>
      )}

      {!loading && stops.length > 0 && (
        <div className="journey-stops-scroll">
          {stops.map((stop, i) => (
            <StopRow
              key={`${stop.station?.ref || i}-${i}`}
              stop={stop}
              index={i}
              isFirst={i === 0}
              isLast={i === stops.length - 1}
              position={position}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Reuse the same badge color logic from JourneyRow.
 */
function getServiceColorClass(name) {
  const n = (name || '').toUpperCase();
  if (n.startsWith('S')) return 'badge-sbahn';
  if (n.startsWith('IR') || n.startsWith('IC') || n.startsWith('EC')) return 'badge-intercity';
  if (n.startsWith('RE')) return 'badge-regio';
  if (n.startsWith('TGV') || n.startsWith('RJ')) return 'badge-highspeed';
  if (n.startsWith('T') || n.startsWith('TRAM')) return 'badge-tram';
  if (n.startsWith('B') || n.startsWith('BUS')) return 'badge-bus';
  return 'badge-default';
}
