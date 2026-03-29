const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  extractText,
  parseCallAtStop,
  parseStopEventResult,
  parseTripInfoResult,
} = require('../src/parsers');
const { buildStopEventRequest } = require('../src/routes/station');

// ---------- extractText ----------

describe('extractText', () => {
  it('returns empty string for null/undefined', () => {
    assert.equal(extractText(null), '');
    assert.equal(extractText(undefined), '');
  });

  it('returns the string directly if given a string', () => {
    assert.equal(extractText('Zürich HB'), 'Zürich HB');
  });

  it('extracts from { Text: "value" }', () => {
    assert.equal(extractText({ Text: 'Bern' }), 'Bern');
  });

  it('extracts from { Text: { "#text": "value" } }', () => {
    assert.equal(extractText({ Text: { '#text': 'Basel SBB' } }), 'Basel SBB');
  });

  it('extracts from { "#text": "value" }', () => {
    assert.equal(extractText({ '#text': 'Luzern' }), 'Luzern');
  });

  it('converts numeric Text to string', () => {
    assert.equal(extractText({ Text: 8 }), '8');
  });
});

// ---------- parseCallAtStop ----------

describe('parseCallAtStop', () => {
  it('returns null for null input', () => {
    assert.equal(parseCallAtStop(null), null);
  });

  it('parses a minimal stop with only station info', () => {
    const result = parseCallAtStop({
      StopPointName: { Text: 'Zürich HB' },
      StopPointRef: '8503000',
    });
    assert.deepEqual(result, {
      station: { name: 'Zürich HB', ref: '8503000' },
    });
  });

  it('parses platform info', () => {
    const result = parseCallAtStop({
      StopPointName: { Text: 'Bern' },
      StopPointRef: '8507000',
      PlannedQuay: { Text: '7' },
      EstimatedQuay: { Text: '8' },
    });
    assert.deepEqual(result.platform, { planned: '7', estimated: '8' });
  });

  it('parses departure times', () => {
    const result = parseCallAtStop({
      StopPointName: { Text: 'Bern' },
      StopPointRef: '8507000',
      ServiceDeparture: {
        TimetabledTime: '2026-03-22T10:00:00Z',
        EstimatedTime: '2026-03-22T10:02:00Z',
      },
    });
    assert.deepEqual(result.departure, {
      planned: '2026-03-22T10:00:00Z',
      estimated: '2026-03-22T10:02:00Z',
    });
  });

  it('parses arrival times', () => {
    const result = parseCallAtStop({
      StopPointName: { Text: 'Zürich HB' },
      StopPointRef: '8503000',
      ServiceArrival: {
        TimetabledTime: '2026-03-22T11:00:00Z',
      },
    });
    assert.deepEqual(result.arrival, {
      planned: '2026-03-22T11:00:00Z',
    });
    assert.equal(result.arrival.estimated, undefined);
  });

  it('sets cancelled when NotServicedStop is true', () => {
    const result = parseCallAtStop({
      StopPointName: { Text: 'Test' },
      StopPointRef: '123',
      NotServicedStop: true,
    });
    assert.equal(result.cancelled, true);
  });

  it('sets cancelled when NotServicedStop is string "true"', () => {
    const result = parseCallAtStop({
      StopPointName: { Text: 'Test' },
      StopPointRef: '123',
      NotServicedStop: 'true',
    });
    assert.equal(result.cancelled, true);
  });

  it('does not set cancelled when NotServicedStop is absent', () => {
    const result = parseCallAtStop({
      StopPointName: { Text: 'Test' },
      StopPointRef: '123',
    });
    assert.equal(result.cancelled, undefined);
  });

  it('handles nested CallAtStop structure', () => {
    const result = parseCallAtStop({
      CallAtStop: {
        StopPointName: { Text: 'Nested Station' },
        StopPointRef: '999',
      },
    });
    assert.deepEqual(result, {
      station: { name: 'Nested Station', ref: '999' },
    });
  });
});

// ---------- parseStopEventResult ----------

describe('parseStopEventResult', () => {
  it('parses a full StopEventResult into a Journey', () => {
    const input = {
      StopEvent: {
        ThisCall: {
          CallAtStop: {
            StopPointRef: 'ch:1:sloid:3000:6:11',
            StopPointName: { Text: 'Zürich HB' },
            PlannedQuay: { Text: '11' },
            ServiceDeparture: {
              TimetabledTime: '2026-03-22T17:33:00Z',
            },
          },
        },
        Service: {
          JourneyRef: 'ch:1:sjyid:100001:27-003',
          OperatingDayRef: '2026-03-22',
          PublishedServiceName: { Text: 'EC' },
          OriginText: { Text: 'Zürich HB' },
          OriginStopPointRef: 'ch:1:sloid:3000:6:11',
          DestinationText: { Text: 'Milano Centrale' },
          DestinationStopPointRef: '8301700',
          Cancelled: false,
          Attribute: [
            { UserText: { Text: 'Gratis-Internet' } },
          ],
        },
      },
    };

    const journey = parseStopEventResult(input);

    assert.equal(journey.journeyRef, 'ch:1:sjyid:100001:27-003');
    assert.equal(journey.operatingDayRef, '2026-03-22');
    assert.equal(journey.name, 'EC');
    assert.deepEqual(journey.origin, { name: 'Zürich HB', ref: 'ch:1:sloid:3000:6:11' });
    assert.deepEqual(journey.destination, { name: 'Milano Centrale', ref: '8301700' });
    assert.equal(journey.stop.station.name, 'Zürich HB');
    assert.deepEqual(journey.stop.platform, { planned: '11' });
    assert.deepEqual(journey.stop.departure, { planned: '2026-03-22T17:33:00Z' });
    assert.equal(journey.cancelled, undefined);
    assert.equal(journey.attribute, 'Gratis-Internet');
  });

  it('handles cancelled journey', () => {
    const input = {
      StopEvent: {
        ThisCall: {
          CallAtStop: {
            StopPointRef: '123',
            StopPointName: { Text: 'Test' },
          },
        },
        Service: {
          JourneyRef: 'ref1',
          OperatingDayRef: '2026-01-01',
          PublishedServiceName: { Text: 'S1' },
          OriginText: { Text: 'A' },
          OriginStopPointRef: '1',
          DestinationText: { Text: 'B' },
          DestinationStopPointRef: '2',
          Cancelled: true,
        },
      },
    };

    const journey = parseStopEventResult(input);
    assert.equal(journey.cancelled, true);
  });

  it('falls back to empty stop when ThisCall is missing', () => {
    const input = {
      StopEvent: {
        Service: {
          JourneyRef: 'ref1',
          OperatingDayRef: '2026-01-01',
          PublishedServiceName: { Text: 'IC1' },
          OriginText: { Text: 'A' },
          OriginStopPointRef: '1',
          DestinationText: { Text: 'B' },
          DestinationStopPointRef: '2',
        },
      },
    };

    const journey = parseStopEventResult(input);
    assert.deepEqual(journey.stop, { station: { name: '', ref: '' } });
  });

  it('uses PublishedLineName as fallback for name', () => {
    const input = {
      StopEvent: {
        ThisCall: { CallAtStop: { StopPointRef: '1', StopPointName: { Text: 'X' } } },
        Service: {
          JourneyRef: 'ref1',
          OperatingDayRef: '2026-01-01',
          PublishedLineName: { Text: '42' },
          OriginText: { Text: 'A' },
          OriginStopPointRef: '1',
          DestinationText: { Text: 'B' },
          DestinationStopPointRef: '2',
        },
      },
    };

    const journey = parseStopEventResult(input);
    assert.equal(journey.name, '42');
  });
});

// ---------- parseTripInfoResult ----------

describe('parseTripInfoResult', () => {
  it('returns empty array for null input', () => {
    assert.deepEqual(parseTripInfoResult(null), []);
  });

  it('returns empty array for empty result', () => {
    assert.deepEqual(parseTripInfoResult({}), []);
  });

  it('parses PreviousCall and OnwardCall into Stop[]', () => {
    const tripResult = {
      PreviousCall: [
        {
          StopPointRef: 'ch:1:sloid:10:4:8',
          StopPointName: { Text: 'Basel SBB' },
          PlannedQuay: { Text: '8' },
          ServiceDeparture: {
            TimetabledTime: '2026-03-22T13:56:00Z',
            EstimatedTime: '2026-03-22T14:02:00Z',
          },
        },
        {
          StopPointRef: 'ch:1:sloid:7000:1:2',
          StopPointName: { Text: 'Bern' },
          PlannedQuay: { Text: '5' },
          ServiceArrival: { TimetabledTime: '2026-03-22T14:56:00Z' },
          ServiceDeparture: { TimetabledTime: '2026-03-22T14:58:00Z' },
        },
      ],
      OnwardCall: [
        {
          StopPointRef: 'ch:1:sloid:5300:2:2',
          StopPointName: { Text: 'Lugano' },
          PlannedQuay: { Text: '2' },
          ServiceArrival: { TimetabledTime: '2026-03-22T16:28:00Z' },
          ServiceDeparture: { TimetabledTime: '2026-03-22T16:30:00Z' },
        },
      ],
    };

    const stops = parseTripInfoResult(tripResult);

    assert.equal(stops.length, 3);

    // First stop: Basel SBB
    assert.equal(stops[0].station.name, 'Basel SBB');
    assert.equal(stops[0].station.ref, 'ch:1:sloid:10:4:8');
    assert.deepEqual(stops[0].platform, { planned: '8' });
    assert.deepEqual(stops[0].departure, {
      planned: '2026-03-22T13:56:00Z',
      estimated: '2026-03-22T14:02:00Z',
    });

    // Second stop: Bern
    assert.equal(stops[1].station.name, 'Bern');
    assert.deepEqual(stops[1].arrival, { planned: '2026-03-22T14:56:00Z' });
    assert.deepEqual(stops[1].departure, { planned: '2026-03-22T14:58:00Z' });

    // Third stop: Lugano (OnwardCall)
    assert.equal(stops[2].station.name, 'Lugano');
    assert.deepEqual(stops[2].arrival, { planned: '2026-03-22T16:28:00Z' });
  });

  it('handles single PreviousCall (non-array)', () => {
    const tripResult = {
      PreviousCall: {
        StopPointRef: '123',
        StopPointName: { Text: 'Only Stop' },
      },
    };

    const stops = parseTripInfoResult(tripResult);
    assert.equal(stops.length, 1);
    assert.equal(stops[0].station.name, 'Only Stop');
  });

  it('handles single OnwardCall (non-array)', () => {
    const tripResult = {
      OnwardCall: {
        StopPointRef: '456',
        StopPointName: { Text: 'Final Stop' },
      },
    };

    const stops = parseTripInfoResult(tripResult);
    assert.equal(stops.length, 1);
    assert.equal(stops[0].station.name, 'Final Stop');
  });
});

// ---------- buildStopEventRequest ----------

describe('buildStopEventRequest', () => {
  it('uses the provided timestamp in the XML', () => {
    const xml = buildStopEventRequest('8503000', 'departure', '2026-03-22T17:00:00Z');
    assert.ok(xml.includes('<DepArrTime>2026-03-22T17:00:00Z</DepArrTime>'));
    // Both RequestTimestamp elements should use the provided timestamp
    const matches = xml.match(/RequestTimestamp>2026-03-22T17:00:00Z</g);
    assert.equal(matches.length, 2);
  });

  it('uses current time when no timestamp is provided', () => {
    const before = new Date().toISOString();
    const xml = buildStopEventRequest('8503000', 'departure');
    const after = new Date().toISOString();

    // Extract the DepArrTime from the XML
    const match = xml.match(/<DepArrTime>(.+?)<\/DepArrTime>/);
    assert.ok(match, 'DepArrTime should be present in XML');
    const usedTime = match[1];

    // The used time should be between before and after
    assert.ok(usedTime >= before && usedTime <= after, 'should default to current time');
  });

  it('sets the correct StopEventType', () => {
    const xml = buildStopEventRequest('8503000', 'arrival', '2026-03-22T17:00:00Z');
    assert.ok(xml.includes('<StopEventType>arrival</StopEventType>'));
  });

  it('sets the correct StopPointRef', () => {
    const xml = buildStopEventRequest('8507000', 'departure', '2026-03-22T17:00:00Z');
    assert.ok(xml.includes('<siri:StopPointRef>8507000</siri:StopPointRef>'));
  });
});
