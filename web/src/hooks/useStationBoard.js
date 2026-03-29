import { useState, useCallback, useRef, useEffect } from 'react';
import { fetchStationBoard } from '../utils/api.js';

const DEFAULT_STATION_ID = '8503000';

/**
 * Extract the relevant time from a journey based on type.
 */
function getJourneyTime(journey, type) {
  const stop = journey.stop;
  if (!stop) return null;
  const timeObj = type === 'departure' ? stop.departure : stop.arrival;
  return timeObj?.planned || timeObj?.estimated || null;
}

/**
 * Build a unique key for deduplication.
 */
function journeyKey(journey) {
  return `${journey.journeyRef}|${journey.operatingDayRef}`;
}

/**
 * Sort journeys by their time.
 */
function sortByTime(list, type) {
  return [...list].sort((a, b) => {
    const ta = getJourneyTime(a, type);
    const tb = getJourneyTime(b, type);
    if (!ta || !tb) return 0;
    return new Date(ta) - new Date(tb);
  });
}

/**
 * Compute the average time gap (in ms) between consecutive sorted journeys.
 */
function computeAverageGap(journeys, type) {
  if (journeys.length < 2) return 30 * 60 * 1000; // default 30 min
  let totalGap = 0;
  let count = 0;
  for (let i = 1; i < journeys.length; i++) {
    const t1 = getJourneyTime(journeys[i - 1], type);
    const t2 = getJourneyTime(journeys[i], type);
    if (t1 && t2) {
      totalGap += new Date(t2) - new Date(t1);
      count++;
    }
  }
  return count > 0 ? totalGap / count : 30 * 60 * 1000;
}

/**
 * Custom hook managing infinite-scroll station board data.
 *
 * Smart RPC logic for scrolling backward:
 * - Estimates a timestamp offset based on average gap between journeys.
 * - If the returned results don't overlap with existing data, drops them
 *   and retries with the gap halved until overlap is found.
 */
export function useStationBoard(type, stationId = DEFAULT_STATION_ID) {
  const [journeys, setJourneys] = useState([]);
  const [isLoadingTop, setIsLoadingTop] = useState(false);
  const [isLoadingBottom, setIsLoadingBottom] = useState(false);
  const [error, setError] = useState(null);

  // Use refs to avoid stale closures in async callbacks
  const seenKeys = useRef(new Set());
  const journeysRef = useRef([]);
  const loadingRef = useRef({ top: false, bottom: false });

  // Keep ref in sync with state
  useEffect(() => {
    journeysRef.current = journeys;
  }, [journeys]);

  /**
   * Merge new journeys into existing list, deduplicating by key.
   */
  const mergeAndSet = useCallback((newOnes) => {
    const existing = journeysRef.current;
    const merged = [...existing];
    let added = 0;
    for (const j of newOnes) {
      const key = journeyKey(j);
      if (!seenKeys.current.has(key)) {
        seenKeys.current.add(key);
        merged.push(j);
        added++;
      }
    }
    if (added > 0) {
      const sorted = sortByTime(merged, type);
      journeysRef.current = sorted;
      setJourneys(sorted);
    }
    return added;
  }, [type]);

  /**
   * Check if any of the new journeys overlap with existing data.
   */
  const hasOverlap = useCallback((newJourneys) => {
    for (const j of newJourneys) {
      if (seenKeys.current.has(journeyKey(j))) {
        return true;
      }
    }
    return false;
  }, []);

  /**
   * Load initial data (current time).
   */
  const loadInitial = useCallback(async (boardType) => {
    setIsLoadingBottom(true);
    setError(null);
    try {
      const data = await fetchStationBoard(stationId, boardType);
      seenKeys.current.clear();
      for (const j of data) {
        seenKeys.current.add(journeyKey(j));
      }
      const sorted = sortByTime(data, boardType);
      journeysRef.current = sorted;
      setJourneys(sorted);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoadingBottom(false);
    }
  }, []);

  // Reset and reload when type or station changes
  useEffect(() => {
    seenKeys.current.clear();
    journeysRef.current = [];
    setJourneys([]);
    setError(null);
    loadingRef.current = { top: false, bottom: false };
    loadInitial(type);
  }, [type, stationId, loadInitial]);

  /**
   * Load future journeys (scroll down).
   */
  const loadFuture = useCallback(async () => {
    if (loadingRef.current.bottom) return;
    const current = journeysRef.current;
    if (current.length === 0) return;

    const lastTime = getJourneyTime(current[current.length - 1], type);
    if (!lastTime) return;

    loadingRef.current.bottom = true;
    setIsLoadingBottom(true);

    try {
      // Add 1 minute to avoid re-fetching the exact last result
      const ts = new Date(new Date(lastTime).getTime() + 60000).toISOString();
      const data = await fetchStationBoard(stationId, type, ts);
      if (data.length > 0) {
        mergeAndSet(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoadingBottom(false);
      loadingRef.current.bottom = false;
    }
  }, [type, mergeAndSet]);

  /**
   * Load past journeys (scroll up).
   * Uses smart retry: if results don't overlap, halves the gap and retries.
   */
  const loadPast = useCallback(async () => {
    if (loadingRef.current.top) return;
    const current = journeysRef.current;
    if (current.length === 0) return;

    const earliestTime = getJourneyTime(current[0], type);
    if (!earliestTime) return;

    loadingRef.current.top = true;
    setIsLoadingTop(true);

    try {
      const avgGap = computeAverageGap(current, type);
      let gapMs = avgGap * 30; // aim for ~30 results worth of time
      const maxRetries = 5;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const ts = new Date(new Date(earliestTime).getTime() - gapMs).toISOString();
        const data = await fetchStationBoard(stationId, type, ts);

        if (data.length === 0) {
          // No more data in the past
          break;
        }

        if (hasOverlap(data) || attempt === maxRetries - 1) {
          // Results overlap with our existing data — merge them
          mergeAndSet(data);
          break;
        }

        // No overlap — gap was too large, drop results and retry with half the gap
        gapMs = Math.max(gapMs / 2, 60000); // minimum 1 minute
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoadingTop(false);
      loadingRef.current.top = false;
    }
  }, [type, mergeAndSet, hasOverlap]);

  return {
    journeys,
    isLoadingTop,
    isLoadingBottom,
    error,
    loadFuture,
    loadPast,
  };
}
