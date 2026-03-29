import { useState, useCallback, useRef, useEffect } from 'react';
import { fetchStationBoard } from '../utils/api.js';

const STATION_ID = '8503000';

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
 * - If the returned results don't overlap with existing data, retries
 *   with the gap halved until overlap is found.
 */
export function useStationBoard(type) {
  const [journeys, setJourneys] = useState([]);
  const [isLoadingTop, setIsLoadingTop] = useState(false);
  const [isLoadingBottom, setIsLoadingBottom] = useState(false);
  const [error, setError] = useState(null);
  const seenKeys = useRef(new Set());
  const loadingRef = useRef({ top: false, bottom: false });

  // Reset when type changes
  useEffect(() => {
    seenKeys.current.clear();
    setJourneys([]);
    setError(null);
    loadInitial();
  }, [type]);

  const sortJourneys = useCallback(
    (list) => {
      return [...list].sort((a, b) => {
        const ta = getJourneyTime(a, type);
        const tb = getJourneyTime(b, type);
        if (!ta || !tb) return 0;
        return new Date(ta) - new Date(tb);
      });
    },
    [type]
  );

  const mergeJourneys = useCallback(
    (existing, newOnes) => {
      const merged = [...existing];
      for (const j of newOnes) {
        const key = journeyKey(j);
        if (!seenKeys.current.has(key)) {
          seenKeys.current.add(key);
          merged.push(j);
        }
      }
      return sortJourneys(merged);
    },
    [sortJourneys]
  );

  /**
   * Check if new results overlap with existing journeys.
   */
  const hasOverlap = useCallback((newJourneys) => {
    for (const j of newJourneys) {
      if (seenKeys.current.has(journeyKey(j))) {
        return true;
      }
    }
    return false;
  }, []);

  const loadInitial = useCallback(async () => {
    setIsLoadingBottom(true);
    setError(null);
    try {
      const data = await fetchStationBoard(STATION_ID, type);
      seenKeys.current.clear();
      for (const j of data) {
        seenKeys.current.add(journeyKey(j));
      }
      setJourneys(sortJourneys(data));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoadingBottom(false);
    }
  }, [type, sortJourneys]);

  const loadFuture = useCallback(async () => {
    if (loadingRef.current.bottom) return;
    loadingRef.current.bottom = true;
    setIsLoadingBottom(true);
    try {
      setJourneys((prev) => {
        if (prev.length === 0) return prev;
        const lastTime = getJourneyTime(prev[prev.length - 1], type);
        if (!lastTime) return prev;
        // Add 1 minute to avoid re-fetching the exact same results
        const ts = new Date(new Date(lastTime).getTime() + 60000).toISOString();
        fetchStationBoard(STATION_ID, type, ts).then((data) => {
          if (data.length > 0) {
            setJourneys((current) => mergeJourneys(current, data));
          }
          setIsLoadingBottom(false);
          loadingRef.current.bottom = false;
        }).catch((err) => {
          setError(err.message);
          setIsLoadingBottom(false);
          loadingRef.current.bottom = false;
        });
        return prev;
      });
    } catch {
      setIsLoadingBottom(false);
      loadingRef.current.bottom = false;
    }
  }, [type, mergeJourneys]);

  const loadPast = useCallback(async () => {
    if (loadingRef.current.top) return;
    loadingRef.current.top = true;
    setIsLoadingTop(true);

    try {
      // Read current state
      let currentJourneys;
      setJourneys((prev) => {
        currentJourneys = prev;
        return prev;
      });

      if (!currentJourneys || currentJourneys.length === 0) {
        setIsLoadingTop(false);
        loadingRef.current.top = false;
        return;
      }

      const earliestTime = getJourneyTime(currentJourneys[0], type);
      if (!earliestTime) {
        setIsLoadingTop(false);
        loadingRef.current.top = false;
        return;
      }

      const avgGap = computeAverageGap(currentJourneys, type);
      let gapMs = avgGap * 30; // aim for ~30 results worth of time
      const maxRetries = 5;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const ts = new Date(new Date(earliestTime).getTime() - gapMs).toISOString();
        const data = await fetchStationBoard(STATION_ID, type, ts);

        if (data.length === 0) {
          // No more data in the past
          break;
        }

        if (hasOverlap(data) || attempt === maxRetries - 1) {
          // Good — results overlap with our existing data, merge them
          setJourneys((prev) => mergeJourneys(prev, data));
          break;
        }

        // No overlap — gap was too large, retry with half the gap
        gapMs = Math.max(gapMs / 2, 60000); // minimum 1 minute
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoadingTop(false);
      loadingRef.current.top = false;
    }
  }, [type, mergeJourneys, hasOverlap]);

  return {
    journeys,
    isLoadingTop,
    isLoadingBottom,
    error,
    loadFuture,
    loadPast,
  };
}
