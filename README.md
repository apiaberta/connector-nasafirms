# NASA FIRMS Connector

NASA FIRMS satellite fire hotspot data for Portugal (VIIRS S-NPP + MODIS).

## Data Sources

- **VIIRS S-NPP** — 375m resolution, near-real-time
- **MODIS** — 1km resolution, near-real-time (Terra/Aqua)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/nasafirms/hotspots` | List hotspots, supports `?days=1-7`, `?source=VIIRS_SNPP|MODIS`, `?limit=100` |
| GET | `/nasafirms/hotspots/count` | Total count in DB |
| GET | `/nasafirms/sources` | Available data sources |
| GET | `/health` | Health check |
| GET | `/meta` | Service metadata |

## Quick Start

```bash
npm install
npm start
```

## Environment

| Variable | Default |
|----------|---------|
| `PORT` | `3012` |
| `MONGO_URI` | `mongodb://localhost:27017/nasafirms` |

## Sync

Data syncs every 30 minutes, keeping the last 7 days of hotspots in the database.
