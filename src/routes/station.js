const express = require('express');
const { sendOjpRequest } = require('../ojpClient');
const { parseStopEventResult } = require('../parsers');

const router = express.Router();

/**
 * Build the OJP StopEventRequest XML.
 */
function buildStopEventRequest(stationId, type) {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<OJP xmlns="http://www.vdv.de/ojp" xmlns:siri="http://www.siri.org.uk/siri" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="2.0">
  <OJPRequest>
    <siri:ServiceRequest>
      <siri:ServiceRequestContext>
        <siri:Language>de</siri:Language>
      </siri:ServiceRequestContext>
      <siri:RequestTimestamp>${now}</siri:RequestTimestamp>
      <siri:RequestorRef>stationboard_prod</siri:RequestorRef>
      <OJPStopEventRequest>
        <siri:RequestTimestamp>${now}</siri:RequestTimestamp>
        <siri:MessageIdentifier>SER_1</siri:MessageIdentifier>
        <Location>
          <PlaceRef>
            <siri:StopPointRef>${stationId}</siri:StopPointRef>
            <Name>
              <Text>${stationId}</Text>
            </Name>
          </PlaceRef>
          <DepArrTime>${now}</DepArrTime>
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

  if (type !== 'departure' && type !== 'arrival') {
    return res.status(400).json({ error: 'type must be "departure" or "arrival"' });
  }

  try {
    const xml = buildStopEventRequest(stationId, type);
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
