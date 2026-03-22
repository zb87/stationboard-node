# Stationboard API Proxy

A Node.js API proxy for Swiss public transport timetables, translating REST requests into [OJP 2.0](https://opentransportdata.swiss/de/cookbook/open-journey-planner-ojp/) XML calls.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your API key from https://api-manager.opentransportdata.swiss/
```

## Usage

```bash
# Start the server
npm start

# Development with hot-reload
npm run dev
```

## API Endpoints

### `GET /station/:stationId/:type`

Returns departures or arrivals for a station.

- **stationId** — Station ID (e.g. `8503000` for Zürich HB)
- **type** — `departure` or `arrival`

**Response:** `Journey[]`

```bash
curl http://localhost:3000/station/8503000/departure
```

```json
[
  {
    "journeyRef": "ch:1:sjyid:100001:27-003",
    "operatingDayRef": "2026-03-22",
    "name": "EC",
    "origin": { "name": "Zürich HB", "ref": "ch:1:sloid:3000:6:11" },
    "destination": { "name": "Milano Centrale", "ref": "8301700" },
    "stop": {
      "station": { "name": "Zürich HB", "ref": "ch:1:sloid:3000:6:11" },
      "platform": { "planned": "11" },
      "departure": { "planned": "2026-03-22T17:33:00Z" }
    },
    "attribute": "Gratis-Internet mit der App SBB FreeSurf"
  }
]
```

### `GET /journey/:journeyRef/:operatingDayRef`

Returns all stops along a journey.

- **journeyRef** — Journey reference from a station response
- **operatingDayRef** — Operating day (e.g. `2026-03-22`)

**Response:** `Stop[]`

```bash
curl http://localhost:3000/journey/ch:1:sjyid:100001:27-003/2026-03-22
```

```json
[
  {
    "station": { "name": "Zürich HB", "ref": "ch:1:sloid:3000:6:11" },
    "platform": { "planned": "11" },
    "departure": { "planned": "2026-03-22T17:33:00Z" }
  },
  {
    "station": { "name": "Lugano", "ref": "ch:1:sloid:5300:2:2" },
    "platform": { "planned": "2" },
    "departure": { "planned": "2026-03-22T19:30:00Z" },
    "arrival": { "planned": "2026-03-22T19:28:00Z" }
  }
]
```

## Data Types

```typescript
interface Journey {
  journeyRef: string;
  operatingDayRef: string;
  name: string;
  origin: Station;
  destination: Station;
  stop: Stop;
  cancelled?: boolean;
  attribute?: string;
}

interface Station { name: string; ref: string; }

interface Stop {
  station: Station;
  platform?: Platform;
  departure?: DepartureArrivalTime;
  arrival?: DepartureArrivalTime;
  cancelled?: boolean;
}

interface DepartureArrivalTime { planned?: string; estimated?: string; }
interface Platform { planned?: string; estimated?: string; }
```

## Testing

```bash
npm test
```

## Environment Variables

| Variable | Description |
|---|---|
| `OPEN_TRANSPORT_API_KEY` | API token from [opentransportdata.swiss](https://api-manager.opentransportdata.swiss/) |
| `PORT` | Server port (default: 3000) |
