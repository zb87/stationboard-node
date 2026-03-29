import { useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import JourneyRow from './JourneyRow.jsx';
import { formatDateHeader, isSameDay } from '../utils/time.js';
import './StationBoard.css';

/**
 * Get the relevant time string from a journey for the given type.
 */
function getTimeForJourney(journey, type) {
  const stop = journey.stop;
  if (!stop) return null;
  const timeObj = type === 'departure' ? stop.departure : stop.arrival;
  return timeObj?.planned || timeObj?.estimated || null;
}

export default function StationBoard({
  journeys,
  type,
  isLoadingTop,
  isLoadingBottom,
  error,
  onLoadPast,
  onLoadFuture,
}) {
  const scrollRef = useRef(null);
  const firstJourneyRef = useRef(null);
  const prevScrollHeightRef = useRef(0);
  const pendingPastLoad = useRef(false);
  const hasInitScrolled = useRef(false);

  // ── On initial load / type change, scroll to the first journey (hiding the "load earlier" button) ──
  useEffect(() => {
    if (journeys.length > 0 && !hasInitScrolled.current) {
      requestAnimationFrame(() => {
        if (firstJourneyRef.current) {
          firstJourneyRef.current.scrollIntoView({ block: 'start' });
        }
        hasInitScrolled.current = true;
      });
    }
  }, [journeys.length]);

  // Reset on type change (journeys cleared to empty)
  useEffect(() => {
    if (journeys.length === 0) {
      hasInitScrolled.current = false;
    }
  }, [journeys.length]);

  // ── Scroll position preservation after prepending past items ──
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    if (pendingPastLoad.current && prevScrollHeightRef.current > 0) {
      const newScrollHeight = container.scrollHeight;
      const delta = newScrollHeight - prevScrollHeightRef.current;
      if (delta > 0) {
        container.scrollTop += delta;
      }
      pendingPastLoad.current = false;
      prevScrollHeightRef.current = 0;
    }
  }, [journeys]);

  // ── Handle "Load earlier" button click ──
  const handleLoadEarlier = useCallback(() => {
    const container = scrollRef.current;
    if (container) {
      prevScrollHeightRef.current = container.scrollHeight;
      pendingPastLoad.current = true;
    }
    onLoadPast();
  }, [onLoadPast]);

  // Group journeys by date and insert date headers
  const renderItems = useCallback(() => {
    const items = [];
    let lastDate = null;

    for (let i = 0; i < journeys.length; i++) {
      const journey = journeys[i];
      const time = getTimeForJourney(journey, type);

      if (time) {
        const currentDate = new Date(time);
        if (!lastDate || !isSameDay(lastDate.toISOString(), currentDate.toISOString())) {
          items.push(
            <div key={`date-${currentDate.toDateString()}`} className="date-header">
              {formatDateHeader(currentDate)}
            </div>
          );
          lastDate = currentDate;
        }
      }

      const isFirst = i === 0;
      items.push(
        <div key={`${journey.journeyRef}|${journey.operatingDayRef}`} ref={isFirst ? firstJourneyRef : null}>
          <JourneyRow journey={journey} type={type} />
        </div>
      );
    }

    return items;
  }, [journeys, type]);

  return (
    <div className="station-board" ref={scrollRef}>
      {/* "Load earlier" button — hidden above the fold by default */}
      {journeys.length > 0 && (
        <div className="load-earlier">
          {isLoadingTop ? (
            <div className="loading-dots">
              <span></span><span></span><span></span>
            </div>
          ) : (
            <button
              className="load-earlier-btn"
              onClick={handleLoadEarlier}
              id="load-earlier-btn"
            >
              Load earlier connections
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠</span>
          {error}
        </div>
      )}

      {journeys.length === 0 && !isLoadingBottom && !isLoadingTop && !error && (
        <div className="empty-state">
          <span className="empty-icon">🚂</span>
          <span>No services found</span>
        </div>
      )}

      {renderItems()}

      {/* "Load later" button at the bottom */}
      {journeys.length > 0 && (
        <div className="load-later">
          {isLoadingBottom ? (
            <div className="loading-dots">
              <span></span><span></span><span></span>
            </div>
          ) : (
            <button
              className="load-later-btn"
              onClick={onLoadFuture}
              id="load-later-btn"
            >
              Load later connections
            </button>
          )}
        </div>
      )}
    </div>
  );
}
