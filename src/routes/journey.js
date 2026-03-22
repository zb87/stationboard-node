const express = require('express');
const { sendOjpRequest } = require('../ojpClient');
const { parseTripInfoResult } = require('../parsers');

const router = express.Router();

/**
 * Build the OJP TripInfoRequest XML.
 */
function buildTripInfoRequest(journeyRef, operatingDayRef) {
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
      <OJPTripInfoRequest>
        <siri:RequestTimestamp>${now}</siri:RequestTimestamp>
        <siri:MessageIdentifier>TIR_1</siri:MessageIdentifier>
        <JourneyRef>${journeyRef}</JourneyRef>
        <OperatingDayRef>${operatingDayRef}</OperatingDayRef>
        <Params>
          <UseRealtimeData>explanatory</UseRealtimeData>
          <IncludeCalls>true</IncludeCalls>
          <IncludeService>true</IncludeService>
        </Params>
      </OJPTripInfoRequest>
    </siri:ServiceRequest>
  </OJPRequest>
</OJP>`;
}

/**
 * GET /journey/:journeyRef/:operatingDayRef
 * Returns Stop[] for all stops along a journey.
 */
router.get('/:journeyRef/:operatingDayRef', async (req, res) => {
  const { journeyRef, operatingDayRef } = req.params;

  try {
    const xml = buildTripInfoRequest(journeyRef, operatingDayRef);
    const parsed = await sendOjpRequest(xml);

    const delivery =
      parsed?.OJP?.OJPResponse?.ServiceDelivery?.OJPTripInfoDelivery;

    if (!delivery) {
      return res.json([]);
    }

    const tripResult = delivery.TripInfoResult;
    if (!tripResult) {
      return res.json([]);
    }

    const stops = parseTripInfoResult(tripResult);
    res.json(stops);
  } catch (err) {
    console.error('TripInfo error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
