import { useState, useCallback, useEffect, useRef } from 'react';
import StationBoard from './components/StationBoard.jsx';
import JourneyDetail from './components/JourneyDetail.jsx';
import Bookmarks from './components/Bookmarks.jsx';
import Search from './components/Search.jsx';
import { useStationBoard } from './hooks/useStationBoard.js';
import { searchStations } from './utils/api.js';
import './App.css';

const DEFAULT_STATION = { id: '8503000', name: 'Zürich HB', lat: 47.378177, lon: 8.540192 };
const BOOKMARKS_KEY = 'stationboard_bookmarks';
const LAST_STATION_KEY = 'stationboard_last_station';
const RECENT_KEY = 'stationboard_recent';
const MAX_RECENT = 20;
const BG_TIMEOUT_MS = 60_000; // 1 minute

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
  localStorage.setItem(LAST_STATION_KEY, JSON.stringify({
    id: station.id,
    name: station.name,
    lat: station.lat,
    lon: station.lon
  }));
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

/** Normalize a station ID (resolves SLOID vs numeric differences). */
function normalizeStationId(id) {
  if (!id) return '';
  if (id.includes('sloid:')) {
    const parts = id.split(':');
    const idx = parts.indexOf('sloid');
    if (idx !== -1 && parts[idx + 1]) {
      const num = parts[idx + 1];
      if (num.length === 4) {
        return '850' + num;
      }
    }
  }
  return id;
}

/** Check if two stations represent the same station. */
function isSameStation(aId, aName, bId, bName) {
  if (aId && bId) {
    const normA = normalizeStationId(aId);
    const normB = normalizeStationId(bId);
    if (normA === normB) return true;
  }
  if (aName && bName) {
    return aName.toLowerCase().trim() === bName.toLowerCase().trim();
  }
  return false;
}

/** Dedupe key for a recent entry. */
function recentKey(entry) {
  if (entry.type === 'station') return `station:${normalizeStationId(entry.id)}`;
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

/** Calculate distance between two coordinates in meters. */
function getDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default function App() {
  const [type, setType] = useState('departure');
  const [menuOpen, setMenuOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState(loadBookmarks);
  const [recentAccesses, setRecentAccesses] = useState(loadRecent);
  const [userLocation, setUserLocation] = useState(null);
  const [closestApiStations, setClosestApiStations] = useState([]);
  const [bgRefreshTrigger, setBgRefreshTrigger] = useState(0);
  const menuRef = useRef(null);
  const hiddenAtRef = useRef(null);
  const resolvingIdsRef = useRef(new Set());
  const isFirstMountRef = useRef(true);

  // Navigation stack: each entry is { view, station?, journey? }
  const [navStack, setNavStack] = useState(() => [
    { view: 'station', station: loadLastStation() },
  ]);

  const current = navStack[navStack.length - 1];
  const currentStation = current.station || DEFAULT_STATION;

  const { journeys, isLoadingTop, isLoadingBottom, isSilentLoading, error, loadFuture, loadPast, refresh } =
    useStationBoard(type, currentStation.id);

  // Persist the last viewed station whenever it changes
  useEffect(() => {
    if (current.view === 'station' && currentStation?.id) {
      saveLastStation(currentStation);
    }
  }, [current.view, currentStation]);

  const getPosition = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          timestamp: Date.now(),
        });
      },
      (err) => {
        console.error('Error getting location:', err);
      },
      { timeout: 10000 }
    );
  }, []);

  // Geolocation on start
  useEffect(() => {
    getPosition();
  }, [getPosition]);

  // Fetch closest API stations when userLocation is updated
  useEffect(() => {
    if (!userLocation?.lat || !userLocation?.lon) return;

    const controller = new AbortController();
    const latlon = `${userLocation.lat},${userLocation.lon}`;
    const params = new URLSearchParams({ latlon });

    fetch(`/search?${params}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const stationsOnly = (data || [])
          .filter(item => item.id)
          .map(item => ({
            id: item.id,
            name: item.label,
            lat: item.lat,
            lon: item.lon,
            dist: item.dist
          }));
        setClosestApiStations(stationsOnly);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Error fetching closest stations:', err);
        }
      });

    return () => controller.abort();
  }, [userLocation]);

  // Geolocation on background return (> 1 minute)
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
      } else if (hiddenAtRef.current) {
        const elapsed = Date.now() - hiddenAtRef.current;
        hiddenAtRef.current = null;
        if (elapsed > BG_TIMEOUT_MS) {
          getPosition();
          setBgRefreshTrigger((prev) => prev + 1);
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [getPosition]);

  // Trigger silent refresh on background return
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }
    if (current.view === 'station') {
      refresh(true);
    }
  }, [bgRefreshTrigger, current.view, refresh]);

  // Background coordinate resolver
  useEffect(() => {
    const stationsToResolve = [];
    for (const b of bookmarks) {
      if (b.id && (b.lat == null || b.lon == null)) {
        const normId = normalizeStationId(b.id);
        if (!resolvingIdsRef.current.has(normId)) {
          stationsToResolve.push({ id: b.id, name: b.name });
        }
      }
    }
    for (const r of recentAccesses) {
      if (r.type === 'station' && r.id && (r.lat == null || r.lon == null)) {
        const normId = normalizeStationId(r.id);
        if (!resolvingIdsRef.current.has(normId)) {
          stationsToResolve.push({ id: r.id, name: r.name });
        }
      }
    }

    if (stationsToResolve.length === 0) return;

    const target = stationsToResolve[0];
    const targetNormId = normalizeStationId(target.id);
    resolvingIdsRef.current.add(targetNormId);

    async function resolveCoordinates() {
      try {
        const res = await fetch(`/search?text=${encodeURIComponent(target.name)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const results = await res.json();
        const match = results.find(item => 
          isSameStation(item.id, item.label, target.id, target.name)
        );
        if (match && match.lat != null && match.lon != null) {
          setBookmarks(prev => {
            const next = prev.map(b => 
              isSameStation(b.id, b.name, target.id, target.name)
                ? { ...b, lat: match.lat, lon: match.lon }
                : b
            );
            saveBookmarks(next);
            return next;
          });
          setRecentAccesses(prev => {
            const next = prev.map(r => 
              r.type === 'station' && isSameStation(r.id, r.name, target.id, target.name)
                ? { ...r, lat: match.lat, lon: match.lon }
                : r
            );
            saveRecent(next);
            return next;
          });
        }
      } catch (err) {
        console.error(`Failed to resolve coordinates for station ${target.id}:`, err);
      }
    }

    resolveCoordinates();
  }, [bookmarks, recentAccesses]);

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

  const isBookmarked = bookmarks.some((b) => isSameStation(b.id, b.name, currentStation.id, currentStation.name));

  const handleToggleBookmark = useCallback(() => {
    setBookmarks((prev) => {
      let next;
      if (prev.some((b) => isSameStation(b.id, b.name, currentStation.id, currentStation.name))) {
        next = prev.filter((b) => !isSameStation(b.id, b.name, currentStation.id, currentStation.name));
      } else {
        next = [...prev, {
          id: currentStation.id,
          name: currentStation.name,
          lat: currentStation.lat,
          lon: currentStation.lon
        }];
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
    setRecentAccesses(trackRecent({
      type: 'station',
      id: station.ref,
      name: station.name,
      lat: station.lat,
      lon: station.lon
    }));
    setNavStack((prev) => [
      ...prev,
      {
        view: 'station',
        station: {
          id: station.ref,
          name: station.name,
          lat: station.lat,
          lon: station.lon
        }
      },
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
    setRecentAccesses(trackRecent({
      type: 'station',
      id: station.id,
      name: station.name,
      lat: station.lat,
      lon: station.lon
    }));
    setNavStack((prev) => [
      ...prev,
      {
        view: 'station',
        station: {
          id: station.id,
          name: station.name,
          lat: station.lat,
          lon: station.lon
        }
      },
    ]);
    setType('departure');
  }, []);

  const handleBookmarkSelect = useCallback((bookmark) => {
    setRecentAccesses(trackRecent({
      type: 'station',
      id: bookmark.id,
      name: bookmark.name,
      lat: bookmark.lat,
      lon: bookmark.lon
    }));
    setNavStack((prev) => [
      ...prev,
      {
        view: 'station',
        station: {
          id: bookmark.id,
          name: bookmark.name,
          lat: bookmark.lat,
          lon: bookmark.lon
        }
      },
    ]);
    setType('departure');
  }, []);

  const handleChipSelect = useCallback((station) => {
    setRecentAccesses(trackRecent({
      type: 'station',
      id: station.id,
      name: station.name,
      lat: station.lat,
      lon: station.lon
    }));
    setNavStack((prev) => [
      ...prev,
      {
        view: 'station',
        station: {
          id: station.id,
          name: station.name,
          lat: station.lat,
          lon: station.lon
        }
      },
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

  // No full screen nearby reset loader used anymore

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
          bgRefreshTrigger={bgRefreshTrigger}
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
              <span className="header-subtitle">{type === 'departure' ? 'Departures' : 'Arrivals'}</span>
            </div>
          </div>

          <div className="header-controls">
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

            {/* Refresh button in header */}
            <button
              className="header-icon-btn"
              onClick={() => refresh(true)}
              aria-label="Refresh board"
              id="header-refresh-btn"
            >
              {isSilentLoading ? (
                <div className="silent-loader-btn-spinner" />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
              )}
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
                    className={`overflow-menu-item ${type === 'departure' ? 'active' : ''}`}
                    role="menuitem"
                    id="menu-type-departure"
                    onClick={() => { setMenuOpen(false); setType('departure'); }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ visibility: type === 'departure' ? 'visible' : 'hidden' }}
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Departures
                  </button>
                  <button
                    className={`overflow-menu-item ${type === 'arrival' ? 'active' : ''}`}
                    role="menuitem"
                    id="menu-type-arrival"
                    onClick={() => { setMenuOpen(false); setType('arrival'); }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ visibility: type === 'arrival' ? 'visible' : 'hidden' }}
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Arrivals
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

      {(() => {
        const currentId = currentStation.id;
        const currentName = currentStation.name;

        // Filter API stations to get the closest two (excluding current station)
        const apiCandidates = closestApiStations.filter(s => 
          !isSameStation(s.id, s.name, currentId, currentName)
        );
        const top2Api = apiCandidates.slice(0, 2);

        const recentStations = recentAccesses
          .filter(entry => entry.type === 'station')
          .map(entry => ({ id: entry.id, name: entry.name, lat: entry.lat, lon: entry.lon }));

        const combined = [];
        const seenNames = new Set();
        const seenIds = new Set();

        for (const s of [...bookmarks, ...recentStations]) {
          if (!s.id || !s.name) continue;

          const normId = normalizeStationId(s.id);
          const normName = s.name.toLowerCase().trim();

          if (seenIds.has(normId) || seenNames.has(normName)) {
            // Keep the one with coordinates if we have duplicates
            const idx = combined.findIndex(existing => 
              normalizeStationId(existing.id) === normId || 
              existing.name.toLowerCase().trim() === normName
            );
            if (idx !== -1) {
              const existing = combined[idx];
              if ((existing.lat == null || existing.lon == null) && (s.lat != null && s.lon != null)) {
                combined[idx] = s;
              }
            }
            continue;
          }

          seenIds.add(normId);
          seenNames.add(normName);
          combined.push(s);
        }

        // Filter out current active station and the top 2 API stations
        const candidates = combined.filter(s => {
          const isCurrent = isSameStation(s.id, s.name, currentId, currentName);
          const inTop2Api = top2Api.some(api => isSameStation(api.id, api.name, s.id, s.name));
          return !isCurrent && !inTop2Api;
        });

        const userLat = userLocation?.lat;
        const userLon = userLocation?.lon;

        const sortedCandidates = candidates.map(s => {
          let dist = Infinity;
          if (userLat != null && userLon != null && s.lat != null && s.lon != null) {
            dist = getDistance(userLat, userLon, s.lat, s.lon);
          }
          return { ...s, dist };
        });

        sortedCandidates.sort((a, b) => {
          if (a.dist !== b.dist) {
            return a.dist - b.dist;
          }
          return a.name.localeCompare(b.name);
        });

        const top8Rest = sortedCandidates.slice(0, 10 - top2Api.length);
        const top10Nearby = [...top2Api, ...top8Rest];

        if (current.view === 'station' && top10Nearby.length > 0) {
          return (
            <div className="nearby-stations-row" id="nearby-stations-row">
              {top10Nearby.map((station) => {
                const hasDist = station.dist !== Infinity && station.dist != null;
                const distText = hasDist
                  ? (station.dist < 1000
                      ? `${Math.round(station.dist)}m`
                      : `${(station.dist / 1000).toFixed(1)}km`)
                  : null;
                return (
                  <button
                    key={station.id}
                    className="nearby-station-chip"
                    onClick={() => handleChipSelect(station)}
                    title={station.name}
                  >
                    <span className="chip-name">{station.name}</span>
                    {hasDist && <span className="chip-dist">{distText}</span>}
                  </button>
                );
              })}
            </div>
          );
        }
        return null;
      })()}

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
