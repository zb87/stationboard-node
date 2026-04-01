import { formatTime, getDelayMinutes } from '../utils/time.js';
import { getServiceColorClass, isPlatformRefinement } from '../utils/service.js';
import './JourneyRow.css';



export default function JourneyRow({ journey, type }) {
  const stop = journey.stop;
  const timeObj = type === 'departure' ? stop?.departure : stop?.arrival;
  const planned = timeObj?.planned;
  const estimated = timeObj?.estimated;
  const delay = getDelayMinutes(planned, estimated);

  const platform = stop?.platform;
  const hasEstimatedPlatform =
    platform?.estimated && platform?.planned && platform.estimated !== platform.planned;
  const isRefinement = hasEstimatedPlatform && isPlatformRefinement(platform.planned, platform.estimated);
  const isRealChange = hasEstimatedPlatform && !isRefinement;

  // Display value: if refinement, show estimated directly; otherwise show planned
  const displayPlatform = isRefinement ? platform.estimated : (platform?.planned || '');

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
        {isRealChange && (
          <span className="journey-platform journey-platform-old">{platform.planned}</span>
        )}
        <span className={`journey-platform ${isRealChange ? 'journey-platform-changed' : ''}`}>
          {isRealChange ? platform.estimated : displayPlatform}
        </span>
      </div>
    </div>
  );
}
