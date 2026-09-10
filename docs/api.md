# API Reference

> Placeholder — filled in Phase 1 when the first REST routes land.
> Conventions: REST + JSON, errors as `{ "error": { "code", "message" } }`,
> realtime over WebSocket at `/ws`.

## Currently implemented

### `GET /api/health`

Probe used by clients to confirm the local server is up.

```json
{
  "status": "ok",
  "version": "0.1.0",
  "database": "ok",
  "uptime_ms": 1234,
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```