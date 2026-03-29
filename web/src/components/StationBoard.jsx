import { useRef, useCallback, useEffect } from 'react';
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
  const topSentinelRef = useRef(null);
  const bottomSentinelRef = useRef(null);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (entry.target === topSentinelRef.current) {
              onLoadPast();
            } else if (entry.target === bottomSentinelRef.current) {
              onLoadFuture();
            }
          }
        }
      },
      {
        root: container,
        rootMargin: '500px',
        threshold: 0,
      }
    );

    if (topSentinelRef.current) observer.observe(topSentinelRef.current);
    if (bottomSentinelRef.current) observer.observe(bottomSentinelRef.current);

    return () => observer.disconnect();
  }, [onLoadPast, onLoadFuture, journeys.length]);

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

      items.push(
        <JourneyRow
          key={`${journey.journeyRef}|${journey.operatingDayRef}`}
          journey={journey}
          type={type}
        />
      );
    }

    return items;
  }, [journeys, type]);

  return (
    <div className="station-board" ref={scrollRef}>
      {/* Top sentinel for loading past */}
      <div ref={topSentinelRef} className="scroll-sentinel" />

      {isLoadingTop && (
        <div className="loading-indicator loading-top">
          <div className="loading-dots">
            <span></span><span></span><span></span>
          </div>
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

      {isLoadingBottom && (
        <div className="loading-indicator loading-bottom">
          <div className="loading-dots">
            <span></span><span></span><span></span>
          </div>
        </div>
      )}

      {/* Bottom sentinel for loading future */}
      <div ref={bottomSentinelRef} className="scroll-sentinel" />
    </div>
  );
}
