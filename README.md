# NASA FIRMS Connector

Satellite fire hotspot data from NASA's FIRMS (Fire Information for Resource Management System).

## Data Sources

- **VIIRS S-NPP** — 375m resolution, near-real-time
- **MODIS** — 1km resolution, near-real-time (Terra/Aqua)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/nasafirms/hotspots` | List fire hotspots (supports `?days=1-7`, `?source=VIIRS_SNPP\|MODIS`, `?limit=100`) |
| GET | `/nasafirms/hotspots/count` | Total count in database |
| GET | `/nasafirms/sources` | Available data sources |
| GET | `/nasafirms/stats` | Aggregated statistics |
| GET | `/health` | Health check |
| GET | `/meta` | Service metadata |

## Quick Start

```bash
npm install
npm start
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3010` | Server port |
| `NODE_ENV` | `production` | Environment |

## License

MIT
