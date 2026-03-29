import { formatTime, getDelayMinutes } from '../utils/time.js';
import './JourneyRow.css';

/**
 * Map common Swiss transport service names to color classes.
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

export default function JourneyRow({ journey, type }) {
  const stop = journey.stop;
  const timeObj = type === 'departure' ? stop?.departure : stop?.arrival;
  const planned = timeObj?.planned;
  const estimated = timeObj?.estimated;
  const delay = getDelayMinutes(planned, estimated);

  const platform = stop?.platform;
  const platformChanged =
    platform?.estimated && platform?.planned && platform.estimated !== platform.planned;

  const directionName =
    type === 'departure' ? journey.destination?.name : journey.origin?.name;

  const isCancelled = journey.cancelled || stop?.cancelled;

  return (
    <div className={`journey-row ${isCancelled ? 'cancelled' : ''}`} id={`journey-${journey.journeyRef}`}>
      <div className="journey-time-col">
        <span className="journey-time">{formatTime(planned)}</span>
        {delay !== null && (
          <span className={`journey-delay ${delay > 0 ? 'delay-late' : 'delay-early'}`}>
            {delay > 0 ? `+${delay}` : delay}
          </span>
        )}
      </div>

      <div className={`journey-badge ${getServiceColorClass(journey.name)}`}>
        {journey.name}
      </div>

      <div className="journey-destination">
        <span className="journey-destination-text">{directionName}</span>
        {isCancelled && <span className="journey-cancelled-badge">Cancelled</span>}
      </div>

      <div className="journey-platform-col">
        <span className="journey-platform">{platform?.planned || ''}</span>
        {platformChanged && (
          <span className="journey-platform-changed">{platform.estimated}</span>
        )}
      </div>
    </div>
  );
}
