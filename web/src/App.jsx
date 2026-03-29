import { useState, useCallback } from 'react';
import StationBoard from './components/StationBoard.jsx';
import JourneyDetail from './components/JourneyDetail.jsx';
import { useStationBoard } from './hooks/useStationBoard.js';
import './App.css';

const DEFAULT_STATION = { id: '8503000', name: 'Zürich HB' };

export default function App() {
  const [type, setType] = useState('departure');
  // Navigation stack: each entry is { view, station?, journey? }
  const [navStack, setNavStack] = useState([
    { view: 'station', station: DEFAULT_STATION },
  ]);

  const current = navStack[navStack.length - 1];
  const currentStation = current.station || DEFAULT_STATION;

  const { journeys, isLoadingTop, isLoadingBottom, error, loadFuture, loadPast } =
    useStationBoard(type, currentStation.id);

  const handleJourneyClick = useCallback((journey) => {
    setNavStack((prev) => [
      ...prev,
      { view: 'journey', journey, station: prev[prev.length - 1].station },
    ]);
  }, []);

  const handleStopClick = useCallback((station) => {
    // station: { ref, name } from the stop data
    if (!station?.ref) return;
    setNavStack((prev) => [
      ...prev,
      { view: 'station', station: { id: station.ref, name: station.name } },
    ]);
    setType('departure');
  }, []);

  const handleBack = useCallback(() => {
    setNavStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const canGoBack = navStack.length > 1;

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
              <span className="header-subtitle">Stationboard</span>
            </div>
          </div>
          <div className="toggle-group" role="tablist" aria-label="Board type">
            <button
              id="toggle-departure"
              className={`toggle-btn ${type === 'departure' ? 'active' : ''}`}
              role="tab"
              aria-selected={type === 'departure'}
              onClick={() => setType('departure')}
            >
              Departures
            </button>
            <button
              id="toggle-arrival"
              className={`toggle-btn ${type === 'arrival' ? 'active' : ''}`}
              role="tab"
              aria-selected={type === 'arrival'}
              onClick={() => setType('arrival')}
            >
              Arrivals
            </button>
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
