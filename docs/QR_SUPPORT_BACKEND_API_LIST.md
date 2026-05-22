# Karsaaz QR Support Backend API Documentation

**Total APIs Documented: 16**

This document lists all the APIs provided by the `qr-support-backend` (Node.js/Express).
The support backend primarily handles SVG to PNG conversion, proxying heavy QR generation requests to Laravel, and providing JSON-RPC interfaces.

---

## Authentication & Security
- **API Key Auth**: Several endpoints require an API key via the `x-api-key` header (using `apiKeyAuth` middleware).
- **Rate Limiting**: Heavy endpoints have strict per-IP rate limits (10 to 30 requests per minute) to prevent abuse. Global limit is 100/min.

---

## Endpoints

### 1. JSON-RPC 2.0
Handles single and batch operations with deduplication and error isolation. Proxies to Laravel for rendering.

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| `POST` | `/api/rpc` | Yes (`x-api-key`) | Executes JSON-RPC 2.0 calls. |
| `GET`  | `/api/rpc/methods` | No | Lists all available RPC methods. |

### 2. Main API (Laravel Proxy) - *Recommended*
These routes proxy to Laravel to ensure 100% feature parity between web and mobile (Flutter) apps.

| Method | Endpoint | Auth Required | Rate Limit | Description |
|--------|----------|---------------|------------|-------------|
| `POST` | `/api/qr/preview` | No | 20/min | Main preview endpoint. Always proxies to Laravel. |
| `POST` | `/api/qr/preview/laravel` | No | 20/min | Explicit Laravel preview endpoint. |
| `GET`  | `/api/qr/capabilities` | No | Global | Returns supported capabilities. |
| `GET`  | `/api/qr/debug/laravel` | No | Global | Debug endpoint to check connectivity with Laravel. |

### 3. Legacy Endpoints (Still Supported)
Older endpoints for direct generation or proxying.

| Method | Endpoint | Auth Required | Rate Limit | Description |
|--------|----------|---------------|------------|-------------|
| `POST` | `/api/qr/render` | Yes (`x-api-key`) | 30/min | Direct SVG to PNG rendering. |
| `GET`  | `/api/qr/:id/png`| No | Global | Retrieve a cached PNG by QR code ID. |
| `ALL`  | `/api/proxy/*` | Yes (`x-api-key`) | Global | Direct proxy to Laravel with auth passthrough. |

### 4. V2 API (Direct Generation)
For simpler cases. Note that for full feature parity, `/api/qr/preview` is recommended.

| Method | Endpoint | Auth Required | Rate Limit | Description |
|--------|----------|---------------|------------|-------------|
| `POST` | `/api/v2/qr/generate` | Yes (`x-api-key`) | 30/min | Generates a QR code. |
| `POST` | `/api/v2/qr/preview` | Yes (`x-api-key`) | 20/min | Previews a QR code design. |
| `GET`  | `/api/v2/qr/capabilities` | No | Global | Lists V2 capabilities. |
| `POST` | `/api/v2/qr/validate` | No | Global | Validates a QR code design payload. |
| `POST` | `/api/v2/qr/batch` | Yes (`x-api-key`) | 10/min | Batch processing for multiple QR codes. |

### 5. System & Discovery

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| `GET`  | `/api/features` | No | Returns system feature discovery, version info, and capabilities. |
| `GET`  | `/api/health` | No | Health check for Node.js server, cache status, and Laravel backend connectivity. |
