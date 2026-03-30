/**
 * Extract text value from an OJP text element.
 * Handles both `{Text: "value"}` and `{"#text": "value"}` shapes,
 * as well as plain strings.
 */
function extractText(element) {
  if (!element) return '';
  if (typeof element === 'string') return element;
  if (element.Text) {
    if (typeof element.Text === 'string') return element.Text;
    if (element.Text['#text'] != null) return String(element.Text['#text']);
    return String(element.Text);
  }
  if (element['#text'] != null) return String(element['#text']);
  return String(element);
}

/**
 * Parse a CallAtStop element into a Stop object.
 */
function parseCallAtStop(callAtStop) {
  if (!callAtStop) return null;

  const data = callAtStop.CallAtStop || callAtStop;

  const stop = {
    station: {
      name: extractText(data.StopPointName),
      ref: String(data.StopPointRef || ''),
    },
  };

  if (data.PlannedQuay || data.EstimatedQuay) {
    stop.platform = {};
    if (data.PlannedQuay) {
      stop.platform.planned = extractText(data.PlannedQuay);
    }
    if (data.EstimatedQuay) {
      stop.platform.estimated = extractText(data.EstimatedQuay);
    }
  }

  if (data.ServiceDeparture) {
    stop.departure = {};
    if (data.ServiceDeparture.TimetabledTime) {
      stop.departure.planned = data.ServiceDeparture.TimetabledTime;
    }
    if (data.ServiceDeparture.EstimatedTime) {
      stop.departure.estimated = data.ServiceDeparture.EstimatedTime;
    }
  }

  if (data.ServiceArrival) {
    stop.arrival = {};
    if (data.ServiceArrival.TimetabledTime) {
      stop.arrival.planned = data.ServiceArrival.TimetabledTime;
    }
    if (data.ServiceArrival.EstimatedTime) {
      stop.arrival.estimated = data.ServiceArrival.EstimatedTime;
    }
  }

  if (data.NotServicedStop === true || data.NotServicedStop === 'true') {
    stop.cancelled = true;
  }

  return stop;
}

/**
 * Parse a StopEventResult into a Journey object.
 */
function parseStopEventResult(result) {
  const stopEvent = result.StopEvent || result;
  const service = stopEvent.Service || {};
  const thisCall = stopEvent.ThisCall;

  const journey = {
    journeyRef: String(service.JourneyRef || ''),
    operatingDayRef: String(service.OperatingDayRef || ''),
    name: extractText(service.PublishedServiceName) || extractText(service.PublishedLineName) || '',
    origin: {
      name: extractText(service.OriginText),
      ref: String(service.OriginStopPointRef || ''),
    },
    destination: {
      name: extractText(service.DestinationText),
      ref: String(service.DestinationStopPointRef || ''),
    },
    stop: parseCallAtStop(thisCall) || {
      station: { name: '', ref: '' },
    },
  };

  if (service.Cancelled === true || service.Cancelled === 'true') {
    journey.cancelled = true;
  }

  // Extract first attribute text if present
  const attributes = service.Attribute;
  if (attributes) {
    const attrList = Array.isArray(attributes) ? attributes : [attributes];
    if (attrList.length > 0) {
      journey.attribute = extractText(attrList[0].UserText) || extractText(attrList[0].Text);
    }
  }

  return journey;
}

/**
 * Parse a TripInfoResult into a Stop[] array.
 */
function parseTripInfoResult(tripResult) {
  if (!tripResult) return [];

  const stops = [];

  const previousCalls = tripResult.PreviousCall || [];
  const prevList = Array.isArray(previousCalls) ? previousCalls : [previousCalls];
  for (const call of prevList) {
    stops.push(parseCallAtStop(call));
  }

  // Include the current stop (where the train is right now)
  if (tripResult.CurrentCall) {
    const currentList = Array.isArray(tripResult.CurrentCall)
      ? tripResult.CurrentCall
      : [tripResult.CurrentCall];
    for (const call of currentList) {
      stops.push(parseCallAtStop(call));
    }
  }

  const onwardCalls = tripResult.OnwardCall || [];
  const onwardList = Array.isArray(onwardCalls) ? onwardCalls : [onwardCalls];
  for (const call of onwardList) {
    stops.push(parseCallAtStop(call));
  }

  return stops;
}

module.exports = {
  extractText,
  parseCallAtStop,
  parseStopEventResult,
  parseTripInfoResult,
};
