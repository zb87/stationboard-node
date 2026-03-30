import { useState, useEffect, useRef, useCallback } from 'react';
import './Search.css';

const ICON_MAP = {
  'sl-icon-type-train': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="16" rx="2" />
      <path d="M4 11h16" />
      <path d="M12 3v8" />
      <path d="M8 19l-2 3" />
      <path d="M16 19l2 3" />
      <circle cx="9" cy="15" r="1" />
      <circle cx="15" cy="15" r="1" />
    </svg>
  ),
  'sl-icon-type-tram': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <path d="M5 12h14" />
      <path d="M9 19l-2 3" />
      <path d="M15 19l2 3" />
      <circle cx="9" cy="16" r="0.8" />
      <circle cx="15" cy="16" r="0.8" />
      <path d="M9 2l3 3 3-3" />
    </svg>
  ),
  'sl-icon-type-bus': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6v6" />
      <path d="M16 6v6" />
      <path d="M2 12h20" />
      <path d="M7 18h10" />
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="8" cy="16" r="1" />
      <circle cx="16" cy="16" r="1" />
    </svg>
  ),
};

function getIcon(iconclass) {
  return ICON_MAP[iconclass] || (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="10" r="3" />
      <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z" />
    </svg>
  );
}

function formatDist(dist) {
  if (dist == null) return null;
  const m = Math.round(dist);
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${m} m`;
}

export default function Search({ onSelectStation, onBack }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [locating, setLocating] = useState(false);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  // Auto-focus the input on mount
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      setError(null);
      return;
    }

    const timer = setTimeout(() => {
      // Abort previous in-flight request
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setError(null);

      fetch(`/search?text=${encodeURIComponent(query.trim())}`, {
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          setResults(data);
          setIsLoading(false);
        })
        .catch((err) => {
          if (err.name === 'AbortError') return;
          setError(err.message);
          setIsLoading(false);
        });
    }, 250);

    return () => {
      clearTimeout(timer);
    };
  }, [query]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const handleSelect = useCallback(
    (station) => {
      if (!station.id) return; // Can't navigate without an id
      onSelectStation({ id: station.id, name: station.label });
    },
    [onSelectStation]
  );

  const handleClear = useCallback(() => {
    setQuery('');
    setResults(null);
    inputRef.current?.focus();
  }, []);

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }
    setLocating(true);
    setError(null);
    setQuery('');
    setResults(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const latlon = `${latitude},${longitude}`;
        const params = new URLSearchParams({ latlon });
        if (accuracy != null) params.set('accuracy', Math.round(accuracy).toString());

        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setIsLoading(true);
        fetch(`/search?${params}`, { signal: controller.signal })
          .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
          })
          .then((data) => {
            setResults(data);
            setIsLoading(false);
            setLocating(false);
          })
          .catch((err) => {
            if (err.name === 'AbortError') return;
            setError(err.message);
            setIsLoading(false);
            setLocating(false);
          });
      },
      (err) => {
        setLocating(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('Location permission denied');
            break;
          case err.POSITION_UNAVAILABLE:
            setError('Location unavailable');
            break;
          case err.TIMEOUT:
            setError('Location request timed out');
            break;
          default:
            setError('Could not get location');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  return (
    <div className="search-page">
      <header className="search-header">
        <button
          className="search-back-btn"
          onClick={onBack}
          aria-label="Go back"
          id="search-back-btn"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="search-title">Search</h1>
      </header>

      <div className="search-input-wrap">
        <svg className="search-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          className="search-input"
          type="text"
          placeholder="Station or stop…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck="false"
          id="search-input"
        />
        {query && (
          <button
            className="search-clear-btn"
            onClick={handleClear}
            aria-label="Clear search"
            id="search-clear-btn"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
        <button
          className={`search-locate-btn${locating ? ' locating' : ''}`}
          onClick={handleLocate}
          aria-label="Use my location"
          id="search-locate-btn"
          disabled={locating}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v4" />
            <path d="M12 18v4" />
            <path d="M2 12h4" />
            <path d="M18 12h4" />
          </svg>
        </button>
      </div>

      <div className="search-results">
        {isLoading && (
          <div className="search-loading">
            <div className="search-spinner" />
          </div>
        )}

        {!isLoading && error && (
          <div className="search-error">{error}</div>
        )}

        {!isLoading && !error && results && results.length === 0 && (
          <div className="search-no-results">No stations found</div>
        )}

        {!isLoading && !error && results && results.length > 0 && (
          results.map((station, i) => (
            <div
              key={station.id || `${station.label}-${i}`}
              className="search-result-item"
              onClick={() => handleSelect(station)}
              role="button"
              tabIndex={0}
              id={`search-result-${i}`}
            >
              <span className="search-result-icon">
                {getIcon(station.iconclass)}
              </span>
              <span className="search-result-label">{station.label}</span>
              {station.dist != null && (
                <span className="search-result-dist">{formatDist(station.dist)}</span>
              )}
            </div>
          ))
        )}

        {!isLoading && !error && !results && (
          <div className="search-empty">
            <span className="search-empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <span className="search-empty-text">Find a station</span>
            <span className="search-empty-hint">
              Type a station name to see departures and arrivals
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
