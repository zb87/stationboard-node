# Architecture

This document describes the overall structure and design of the Stationboard API Proxy.

## Overview

The application is a **REST → XML proxy** that sits between a JSON-speaking client and the [OJP 2.0](https://opentransportdata.swiss/de/cookbook/open-journey-planner-ojp/) SOAP/XML API provided by Swiss Open Transport Data. It exposes two simple REST endpoints that internally build OJP XML requests, send them upstream, parse the XML responses, and return clean JSON to the caller.

```
┌────────┐  JSON   ┌──────────────────┐  XML   ┌──────────────┐
│ Client │ ──────► │ Stationboard API │ ──────► │ OJP 2.0 API  │
│        │ ◄────── │    (Express)     │ ◄────── │ (SIRI/XML)   │
└────────┘  JSON   └──────────────────┘  XML   └──────────────┘
```

## Directory Structure

```
stationboard-node/
├── src/
│   ├── server.js            # Application entry point
│   ├── ojpClient.js         # HTTP + XML transport layer
│   ├── parsers.js           # OJP XML-to-domain object transformers
│   ├── types.js             # JSDoc type definitions
│   └── routes/
│       ├── station.js       # GET /station/:stationId/:type
│       └── journey.js       # GET /journey/:journeyRef/:operatingDayRef
├── test/
│   └── parsers.test.js      # Unit tests for the parser layer
├── .env.example             # Required environment variables template
├── API.md                   # REST endpoint documentation
└── package.json
```

## Modules

### `server.js` — Entry Point

Bootstraps the application:

1. Loads environment variables from `.env` via `dotenv`.
2. Creates an Express app and mounts the route modules.
3. Exposes a root health-check endpoint (`GET /`).
4. Starts listening on the configured `PORT` (default `3000`).

This module contains no business logic — it only wires things together.

---

### `ojpClient.js` — OJP Transport Layer

Handles all communication with the upstream OJP 2.0 API. Exports a single function:

| Function | Description |
|---|---|
| `sendOjpRequest(xmlBody)` | POSTs an XML string to the OJP endpoint, parses the XML response into a JavaScript object, and returns it. |

Key responsibilities:

- **Authentication** — reads `OPEN_TRANSPORT_API_KEY` from the environment and sends it as a Bearer token.
- **XML Parsing** — uses `fast-xml-parser` with configuration tuned for OJP responses:
  - Namespace prefixes are removed (`removeNSPrefix`).
  - Certain elements (`StopEventResult`, `PreviousCall`, `OnwardCall`, etc.) are always parsed as arrays to avoid shape inconsistencies when the API returns a single item.

This module knows nothing about specific OJP request types — it is a generic transport.

---

### `parsers.js` — Response Parsers

Pure functions that transform parsed OJP XML objects into the application's domain types. No I/O, no side effects — designed to be easily unit-tested.

| Function | Input | Output | Used by |
|---|---|---|---|
| `extractText(element)` | An OJP text-like node | `string` | Internal helper |
| `parseCallAtStop(callAtStop)` | A `CallAtStop` XML node | `Stop` object | `parseStopEventResult`, `parseTripInfoResult` |
| `parseStopEventResult(result)` | A `StopEventResult` XML node | `Journey` object | Station route |
| `parseTripInfoResult(tripResult)` | A `TripInfoResult` XML node | `Stop[]` array | Journey route |

The parser layer is the only place where the OJP XML structure is understood and translated. If the upstream API changes its response shape, only this module needs to change.

---

### `types.js` — Domain Type Definitions

Contains JSDoc `@typedef` declarations for the domain model. This module exports nothing at runtime — it exists purely for editor IntelliSense and documentation.

#### Domain Types

```
Station        { name, ref }
DepartureArrivalTime  { planned?, estimated? }
Platform       { planned?, estimated? }
Stop           { station, platform?, departure?, arrival?, cancelled? }
Journey        { journeyRef, operatingDayRef, name, origin, destination, stop, cancelled?, attribute? }
```

---

### `routes/station.js` — Station Board Route

Handles `GET /station/:stationId/:type` where `type` is `departure` or `arrival`.

Responsibilities:

1. **Validate** the `type` path parameter and optional `timestamp` query parameter.
2. **Build** a `StopEventRequest` XML document (embedded template literal).
3. **Send** it via `ojpClient`.
4. **Parse** the response array through `parseStopEventResult`.
5. **Return** a JSON array of `Journey` objects.

---

### `routes/journey.js` — Journey Detail Route

Handles `GET /journey/:journeyRef/:operatingDayRef`.

Responsibilities:

1. **Build** a `TripInfoRequest` XML document.
2. **Send** it via `ojpClient`.
3. **Parse** the response through `parseTripInfoResult`.
4. **Return** a JSON array of `Stop` objects representing every stop along the journey.

---

## Data Flow

A typical request flows through the system like this:

```
Client request
  │
  ▼
Route handler          (validates input, builds OJP XML)
  │
  ▼
ojpClient              (sends XML to OJP API, returns parsed JS object)
  │
  ▼
Parser function        (extracts domain objects from the parsed XML tree)
  │
  ▼
JSON response          (Express serialises the domain objects and sends them back)
```

## Dependencies

| Package | Purpose |
|---|---|
| `express` | HTTP server and routing |
| `dotenv` | Load `.env` into `process.env` |
| `fast-xml-parser` | Parse OJP XML responses into JS objects |
| `nodemon` *(dev)* | Auto-restart during development |

## Testing

Tests use Node's built-in test runner (`node --test`) — no testing framework dependency. The test suite focuses on the parser layer, feeding it fixture data shaped like real OJP responses and asserting the output matches the expected domain objects.

```bash
npm test
```
