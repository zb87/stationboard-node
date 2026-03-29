import { useState } from 'react';
import StationBoard from './components/StationBoard.jsx';
import JourneyDetail from './components/JourneyDetail.jsx';
import { useStationBoard } from './hooks/useStationBoard.js';
import './App.css';

export default function App() {
  const [type, setType] = useState('departure');
  const [selectedJourney, setSelectedJourney] = useState(null);
  const { journeys, isLoadingTop, isLoadingBottom, error, loadFuture, loadPast } =
    useStationBoard(type);

  // If a journey is selected, show the detail view
  if (selectedJourney) {
    return (
      <div className="app">
        <JourneyDetail
          journey={selectedJourney}
          onBack={() => setSelectedJourney(null)}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="header-title-group">
            <h1 className="header-station">Zürich HB</h1>
            <span className="header-subtitle">Stationboard</span>
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
          onJourneyClick={setSelectedJourney}
        />
      </main>
    </div>
  );
}
