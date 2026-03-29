const express = require('express');
const { sendOjpRequest } = require('../ojpClient');
const { parseStopEventResult } = require('../parsers');

const router = express.Router();

/**
 * Build the OJP StopEventRequest XML.
 * @param {string} stationId
 * @param {string} type - 'departure' or 'arrival'
 * @param {string} [timestamp] - ISO 8601 timestamp; defaults to now
 */
function buildStopEventRequest(stationId, type, timestamp) {
  const depArrTime = timestamp || new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<OJP xmlns="http://www.vdv.de/ojp" xmlns:siri="http://www.siri.org.uk/siri" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="2.0">
  <OJPRequest>
    <siri:ServiceRequest>
      <siri:ServiceRequestContext>
        <siri:Language>de</siri:Language>
      </siri:ServiceRequestContext>
      <siri:RequestTimestamp>${depArrTime}</siri:RequestTimestamp>
      <siri:RequestorRef>stationboard_prod</siri:RequestorRef>
      <OJPStopEventRequest>
        <siri:RequestTimestamp>${depArrTime}</siri:RequestTimestamp>
        <siri:MessageIdentifier>SER_1</siri:MessageIdentifier>
        <Location>
          <PlaceRef>
            <siri:StopPointRef>${stationId}</siri:StopPointRef>
            <Name>
              <Text>${stationId}</Text>
            </Name>
          </PlaceRef>
          <DepArrTime>${depArrTime}</DepArrTime>
        </Location>
        <Params>
          <NumberOfResults>30</NumberOfResults>
          <StopEventType>${type}</StopEventType>
          <IncludePreviousCalls>false</IncludePreviousCalls>
          <IncludeOnwardCalls>false</IncludeOnwardCalls>
          <UseRealtimeData>full</UseRealtimeData>
        </Params>
      </OJPStopEventRequest>
    </siri:ServiceRequest>
  </OJPRequest>
</OJP>`;
}

/**
 * GET /station/:stationId/:type
 * Returns Journey[] for a station's departures or arrivals.
 */
router.get('/:stationId/:type', async (req, res) => {
  const { stationId, type } = req.params;
  const { timestamp } = req.query;

  if (type !== 'departure' && type !== 'arrival') {
    return res.status(400).json({ error: 'type must be "departure" or "arrival"' });
  }

  if (timestamp && isNaN(Date.parse(timestamp))) {
    return res.status(400).json({ error: 'timestamp must be a valid ISO 8601 date string' });
  }

  try {
    const xml = buildStopEventRequest(stationId, type, timestamp);
    const parsed = await sendOjpRequest(xml);

    const delivery =
      parsed?.OJP?.OJPResponse?.ServiceDelivery?.OJPStopEventDelivery;

    if (!delivery) {
      return res.json([]);
    }

    const results = delivery.StopEventResult || [];
    const resultList = Array.isArray(results) ? results : [results];

    const journeys = resultList.map(parseStopEventResult);
    res.json(journeys);
  } catch (err) {
    console.error('StopEvent error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.buildStopEventRequest = buildStopEventRequest;
