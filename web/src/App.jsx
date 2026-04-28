import { useState, useCallback, useEffect, useRef } from 'react';
import StationBoard from './components/StationBoard.jsx';
import JourneyDetail from './components/JourneyDetail.jsx';
import Bookmarks from './components/Bookmarks.jsx';
import Search from './components/Search.jsx';
import { useStationBoard } from './hooks/useStationBoard.js';
import { searchStations } from './utils/api.js';
import './App.css';

const DEFAULT_STATION = { id: '8503000', name: 'Zürich HB' };
const BOOKMARKS_KEY = 'stationboard_bookmarks';
const LAST_STATION_KEY = 'stationboard_last_station';
const RECENT_KEY = 'stationboard_recent';
const MAX_RECENT = 20;
const BG_TIMEOUT_MS = 30 * 60_000; // 30 minutes

function loadBookmarks() {
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveBookmarks(bookmarks) {
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
}

function loadLastStation() {
  try {
    const raw = localStorage.getItem(LAST_STATION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.id && parsed?.name) return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_STATION;
}

function saveLastStation(station) {
  localStorage.setItem(LAST_STATION_KEY, JSON.stringify({ id: station.id, name: station.name }));
}

function loadRecent() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecent(list) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
}

/** Dedupe key for a recent entry. */
function recentKey(entry) {
  if (entry.type === 'station') return `station:${entry.id}`;
  return `journey:${entry.journey.journeyRef}|${entry.journey.operatingDayRef}`;
}

/** Record a recently accessed station or journey. */
function trackRecent(entry) {
  const list = loadRecent();
  const key = recentKey(entry);
  const filtered = list.filter((e) => recentKey(e) !== key);
  filtered.unshift({ ...entry, accessedAt: new Date().toISOString() });
  const trimmed = filtered.slice(0, MAX_RECENT);
  saveRecent(trimmed);
  return trimmed;
}

export default function App() {
  const [type, setType] = useState('departure');
  const [menuOpen, setMenuOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState(loadBookmarks);
  const [recentAccesses, setRecentAccesses] = useState(loadRecent);
  const [isResettingNearby, setIsResettingNearby] = useState(false);
  const menuRef = useRef(null);
  const hiddenAtRef = useRef(null);
  const resetAbortControllerRef = useRef(null);

  // Navigation stack: each entry is { view, station?, journey? }
  const [navStack, setNavStack] = useState(() => [
    { view: 'station', station: loadLastStation() },
  ]);

  const current = navStack[navStack.length - 1];
  const currentStation = current.station || DEFAULT_STATION;

  const { journeys, isLoadingTop, isLoadingBottom, error, loadFuture, loadPast, refresh } =
    useStationBoard(type, currentStation.id);

  // Persist the last viewed station whenever it changes
  useEffect(() => {
    if (current.view === 'station' && currentStation?.id) {
      saveLastStation(currentStation);
    }
  }, [current.view, currentStation]);

  // Reset nav stack when returning from background after >30 minutes
  useEffect(() => {
    async function checkNearbyAndReset() {
      // 1. Basic fallback if geolocation is not available or permission not granted
      const fallback = () => {
        const lastStation = loadLastStation();
        setNavStack([{ view: 'station', station: lastStation }]);
        setType('departure');
        setIsResettingNearby(false);
      };

      if (!navigator.geolocation) {
        fallback();
        return;
      }

      try {
        // Only proceed if permission was previously granted (don't prompt)
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        if (permission.state !== 'granted') {
          fallback();
          return;
        }
      } catch (e) {
        // Browser might not support permissions.query for geolocation
        fallback();
        return;
      }

      // 2. Start nearby search
      setIsResettingNearby(true);
      const controller = new AbortController();
      resetAbortControllerRef.current = controller;

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const { latitude, longitude, accuracy } = pos.coords;
            const latlon = `${latitude},${longitude}`;
            const results = await searchStations(undefined, latlon, accuracy);

            // Find bookmarked stations among search results
            const bookmarkedIds = new Set(loadBookmarks().map(b => b.id));
            const matches = results
              .filter(s => bookmarkedIds.has(s.id))
              .sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity));

            if (matches.length > 0) {
              const bestMatch = matches[0];
              setNavStack([{ view: 'station', station: { id: bestMatch.id, name: bestMatch.label } }]);
              setType('departure');
              setIsResettingNearby(false);
            } else {
              fallback();
            }
          } catch (err) {
            if (err.name !== 'AbortError') fallback();
          }
        },
        () => fallback(),
        { timeout: 10000 }
      );
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
      } else if (hiddenAtRef.current) {
        const elapsed = Date.now() - hiddenAtRef.current;
        hiddenAtRef.current = null;
        if (elapsed >= BG_TIMEOUT_MS) {
          checkNearbyAndReset();
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (resetAbortControllerRef.current) resetAbortControllerRef.current.abort();
    };
  }, []);

  const handleCancelReset = useCallback(() => {
    if (resetAbortControllerRef.current) {
      resetAbortControllerRef.current.abort();
      resetAbortControllerRef.current = null;
    }
    const lastStation = loadLastStation();
    setNavStack([{ view: 'station', station: lastStation }]);
    setType('departure');
    setIsResettingNearby(false);
  }, []);

  // Close overflow menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [menuOpen]);

  const isBookmarked = bookmarks.some((b) => b.id === currentStation.id);

  const handleToggleBookmark = useCallback(() => {
    setBookmarks((prev) => {
      let next;
      if (prev.some((b) => b.id === currentStation.id)) {
        next = prev.filter((b) => b.id !== currentStation.id);
      } else {
        next = [...prev, { id: currentStation.id, name: currentStation.name }];
      }
      saveBookmarks(next);
      return next;
    });
    setMenuOpen(false);
  }, [currentStation]);

  const handleRemoveBookmark = useCallback((id) => {
    setBookmarks((prev) => {
      const next = prev.filter((b) => b.id !== id);
      saveBookmarks(next);
      return next;
    });
  }, []);

  const handleReorderBookmarks = useCallback((fromIdx, toIdx) => {
    setBookmarks((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      saveBookmarks(next);
      return next;
    });
  }, []);

  const handleJourneyClick = useCallback((journey) => {
    setNavStack((prev) => {
      const station = prev[prev.length - 1].station;
      setRecentAccesses(trackRecent({
        type: 'journey',
        journey: {
          journeyRef: journey.journeyRef,
          operatingDayRef: journey.operatingDayRef,
          name: journey.name,
          destination: journey.destination,
        },
        station: station ? { id: station.id, name: station.name } : undefined,
      }));
      return [...prev, { view: 'journey', journey, station }];
    });
  }, []);

  const handleStopClick = useCallback((station) => {
    if (!station?.ref) return;
    setRecentAccesses(trackRecent({ type: 'station', id: station.ref, name: station.name }));
    setNavStack((prev) => [
      ...prev,
      { view: 'station', station: { id: station.ref, name: station.name } },
    ]);
    setType('departure');
  }, []);

  const handleOpenBookmarks = useCallback(() => {
    setNavStack((prev) => [...prev, { view: 'bookmarks' }]);
  }, []);

  const handleOpenSearch = useCallback(() => {
    setNavStack((prev) => [...prev, { view: 'search' }]);
  }, []);

  const handleSearchSelect = useCallback((station) => {
    setRecentAccesses(trackRecent({ type: 'station', id: station.id, name: station.name }));
    setNavStack((prev) => [
      ...prev,
      { view: 'station', station: { id: station.id, name: station.name } },
    ]);
    setType('departure');
  }, []);

  const handleBookmarkSelect = useCallback((bookmark) => {
    setRecentAccesses(trackRecent({ type: 'station', id: bookmark.id, name: bookmark.name }));
    setNavStack((prev) => [
      ...prev,
      { view: 'station', station: { id: bookmark.id, name: bookmark.name } },
    ]);
    setType('departure');
  }, []);

  const handleRecentJourneySelect = useCallback((entry) => {
    // Re-track to update accessedAt
    setRecentAccesses(trackRecent(entry));
    setNavStack((prev) => [
      ...prev,
      {
        view: 'journey',
        journey: entry.journey,
        station: entry.station,
      },
    ]);
  }, []);

  const handleBack = useCallback(() => {
    setNavStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const canGoBack = navStack.length > 1;

  // ── Nearby Reset Loading ──
  if (isResettingNearby) {
    return (
      <div className="full-screen-loader">
        <div className="loader-content">
          <div className="loader-spinner" />
          <div className="loader-text">Loading nearby stations…</div>
          <button className="loader-cancel-btn" onClick={handleCancelReset}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Search view ──
  if (current.view === 'search') {
    return (
      <div className="app">
        <Search
          onSelectStation={handleSearchSelect}
          onBack={handleBack}
        />
      </div>
    );
  }

  // ── Bookmarks view ──
  if (current.view === 'bookmarks') {
    return (
      <div className="app">
        <Bookmarks
          bookmarks={bookmarks}
          recentAccesses={recentAccesses}
          onSelectStation={handleBookmarkSelect}
          onSelectJourney={handleRecentJourneySelect}
          onBack={handleBack}
          onRemoveBookmark={handleRemoveBookmark}
          onReorderBookmarks={handleReorderBookmarks}
        />
      </div>
    );
  }

  // ── Journey detail view ──
  if (current.view === 'journey' && current.journey) {
    return (
      <div className="app">
        <JourneyDetail
          journey={current.journey}
          onBack={handleBack}
          onStopClick={handleStopClick}
        />
      </div>
    );
  }

  // ── Station board view ──
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="header-title-row">
            {canGoBack && (
              <button
                className="header-back-btn"
                onClick={handleBack}
                aria-label="Go back"
                id="station-back-btn"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            )}
            <div className="header-title-group">
              <h1 className="header-station">{currentStation.name}</h1>
            </div>
          </div>

          <div className="header-controls">
            {/* Departure / Arrival dropdown */}
            <div className="type-dropdown-wrap">
              <select
                id="type-select"
                className="type-dropdown"
                value={type}
                onChange={(e) => setType(e.target.value)}
                aria-label="Board type"
              >
                <option value="departure">Departures</option>
                <option value="arrival">Arrivals</option>
              </select>
              <svg className="type-dropdown-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>

            {/* Bookmarks button */}
            <button
              className="header-icon-btn"
              onClick={handleOpenBookmarks}
              aria-label="Bookmarks"
              id="header-bookmarks-btn"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </button>

            {/* 3-dot overflow menu */}
            <div className="overflow-menu-wrap" ref={menuRef}>
              <button
                className="overflow-btn"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="More options"
                aria-expanded={menuOpen}
                id="overflow-menu-btn"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="1.8" />
                  <circle cx="12" cy="12" r="1.8" />
                  <circle cx="12" cy="19" r="1.8" />
                </svg>
              </button>

              {menuOpen && (
                <div className="overflow-menu" role="menu" id="overflow-menu">
                  <button
                    className="overflow-menu-item"
                    role="menuitem"
                    id="menu-refresh"
                    onClick={() => { setMenuOpen(false); refresh(); }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10" />
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                    </svg>
                    Refresh
                  </button>
                  <div className="overflow-menu-divider" />
                  <button
                    className="overflow-menu-item"
                    role="menuitem"
                    id="menu-search"
                    onClick={() => { setMenuOpen(false); handleOpenSearch(); }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    Search
                  </button>
                  <div className="overflow-menu-divider" />
                  <button
                    className="overflow-menu-item"
                    role="menuitem"
                    id="menu-add-bookmark"
                    onClick={handleToggleBookmark}
                  >
                    <svg viewBox="0 0 24 24" fill={isBookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                    {isBookmarked ? 'Remove bookmark' : 'Add to bookmarks'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="board-column-headers">
          <span className="col-time">Time</span>
          <span className="col-service">Line</span>
          <span className="col-destination">
            {type === 'departure' ? 'Destination' : 'Origin'}
          </span>
          <span className="col-platform">Pl.</span>
        </div>
        <StationBoard
          journeys={journeys}
          type={type}
          isLoadingTop={isLoadingTop}
          isLoadingBottom={isLoadingBottom}
          error={error}
          onLoadPast={loadPast}
          onLoadFuture={loadFuture}
          onJourneyClick={handleJourneyClick}
        />
      </main>
    </div>
  );
}
