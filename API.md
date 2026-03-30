# API Documentation

## Endpoints

### `GET /station/:stationId/:type`

Returns departures or arrivals for a station.

- **stationId** — Station ID. Supports both numeric format (e.g. `8503000` for Zürich HB) and SLOID format (e.g. `ch:1:sloid:3000:6:11`)
- **type** — `departure` or `arrival`

**Query Parameters:**

| Parameter   | Required | Description                                                                 |
|-------------|----------|-----------------------------------------------------------------------------|
| `timestamp` | No       | ISO 8601 date string (e.g. `2026-03-22T17:00:00Z`). Defaults to now.       |

**Response:** `Journey[]`

```bash
# Current departures
curl http://localhost:3000/station/8503000/departure

# Departures at a specific time
curl "http://localhost:3000/station/8503000/departure?timestamp=2026-03-22T17:00:00Z"
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

### `GET /search`

Search for stations and stops by name or coordinates.

**Query Parameters:**

| Parameter  | Required | Description                                                                 |
|------------|----------|-----------------------------------------------------------------------------|
| `text`     | No*      | Search term (e.g. `Bern`). Returns stations matching the text.              |
| `latlon`   | No*      | `lat,lon` coordinate pair (e.g. `46.948004,7.448134`).                      |
| `accuracy` | No       | Accuracy in meters. Used together with `latlon` (e.g. `10`).               |

> \* Exactly one of `text` or `latlon` must be provided.

**Response:** `SearchResult[]`

```bash
# Search by text
curl http://localhost:3000/search?text=Bern

# Search by coordinates
curl "http://localhost:3000/search?latlon=46.948004,7.448134&accuracy=10"
```

```json
[
  { "label": "Bern", "id": "8507000", "iconclass": "sl-icon-type-train" },
  { "label": "Bern, Bahnhof", "id": "8507100", "iconclass": "sl-icon-type-tram" }
]
```

```json
[
  { "label": "Zytgloggelaube, Bern", "id": "8507110", "dist": 15, "iconclass": "sl-icon-type-adr" },
  { "label": "Bern, Zytglogge", "id": "8507110", "dist": 51, "iconclass": "sl-icon-type-tram" }
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

interface SearchResult {
  label: string;
  id?: string;
  iconclass?: string;
  dist?: number;
}
```
