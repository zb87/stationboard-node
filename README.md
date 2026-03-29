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

## API

See [API.md](API.md) for endpoint documentation, examples, and data types.

## Testing

```bash
npm test
```

## Environment Variables

| Variable | Description |
|---|---|
| `OPEN_TRANSPORT_API_KEY` | API token from [opentransportdata.swiss](https://api-manager.opentransportdata.swiss/) |
| `PORT` | Server port (default: 3000) |
