# QR Support Backend

Node.js middleware for reliable QR code rendering between Flutter and Laravel.

## Overview

This service sits between the Flutter mobile app and the Laravel main backend to provide reliable SVG-to-PNG conversion. Flutter's SVG rendering can be inconsistent across platforms, so this middleware ensures QR codes are always rendered correctly by using Sharp (libvips) for image processing.

## Architecture

```
┌─────────────────┐     ┌─────────────────────┐     ┌────────────────────┐
│                 │     │                     │     │                    │
│  Flutter App    │────▶│  Node.js Support    │────▶│  Laravel Backend   │
│                 │     │  Backend            │     │                    │
│  (Mobile)       │◀────│  (This Service)     │◀────│  (Main API)        │
│                 │     │                     │     │                    │
└─────────────────┘     └─────────────────────┘     └────────────────────┘
                              │
                              ▼
                        ┌───────────┐
                        │   Sharp   │
                        │ (libvips) │
                        └───────────┘
```

## Features

- **SVG to PNG Conversion**: Uses Sharp (powered by libvips) for high-quality, reliable image conversion
- **Caching**: Redis or in-memory caching for frequently accessed QR codes
- **Proxy Mode**: Forward any request to Laravel backend with auth passthrough
- **Rate Limiting**: Configurable rate limits to prevent abuse
- **Health Checks**: Built-in health endpoints for monitoring

## Installation

```bash
# Navigate to the project directory
cd qr-support-backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
# - Set LARAVEL_BACKEND_URL to your Laravel API
# - Configure Redis if using (optional)

# Start the server
npm run dev
```

## API Endpoints

### QR Code Rendering

#### POST /api/qr/preview
Generate a QR code preview PNG from design data.

**Request Body:**
```json
{
  "type": "url",
  "data": {
    "url": "https://example.com"
  },
  "design": {
    "foreground_color": "#000000",
    "background_color": "#ffffff",
    "module_shape": "square"
  },
  "size": 512,
  "quality": 90,
  "force_png": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rendering_strategy": "server",
    "strategy_reason": "node_converted",
    "images": {
      "png_base64": "iVBORw0KGgo...",
      "format": "png",
      "size": "512x512"
    },
    "meta": {
      "type": "url",
      "cached": false,
      "node_processed": true,
      "generation_ms": 45
    }
  }
}
```

#### POST /api/qr/render
Direct SVG to PNG conversion.

**Request Body:**
```json
{
  "svg": "<svg>...</svg>",
  "size": 512,
  "quality": 90,
  "format": "base64",
  "transparent": false
}
```

#### GET /api/qr/:id/png
Get PNG image for a saved QR code by ID.

**Query Parameters:**
- `size`: Output size (default: 512)
- `quality`: PNG quality (default: 90)

**Headers:**
- `Authorization`: Bearer token (required)

### Proxy

#### ALL /api/proxy/*
Forward any request to Laravel backend.

Example: `GET /api/proxy/flutter/v2/qrcodes` → `GET {LARAVEL_URL}/api/flutter/v2/qrcodes`

### System

#### GET /health
Health check endpoint.

#### GET /api/features
Get service capabilities and supported features.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| NODE_ENV | development | Environment |
| LARAVEL_BACKEND_URL | http://localhost:8000 | Laravel API URL |
| LARAVEL_API_TIMEOUT | 30000 | Request timeout (ms) |
| REDIS_HOST | 127.0.0.1 | Redis host |
| REDIS_PORT | 6379 | Redis port |
| REDIS_PASSWORD | | Redis password |
| REDIS_DB | 1 | Redis database |
| CACHE_ENABLED | true | Enable caching |
| CACHE_TTL | 300 | Cache TTL (seconds) |
| DEFAULT_PNG_SIZE | 512 | Default PNG size |
| DEFAULT_PNG_QUALITY | 90 | Default PNG quality |
| MAX_PNG_SIZE | 2048 | Max PNG size |
| MIN_PNG_SIZE | 64 | Min PNG size |
| RATE_LIMIT_WINDOW_MS | 60000 | Rate limit window |
| RATE_LIMIT_MAX_REQUESTS | 100 | Max requests per window |
| LOG_LEVEL | info | Logging level |

## Flutter Integration

In your Flutter app's `api_config.dart`:

```dart
class ApiConfig {
  // Enable Node.js backend
  static const bool useNodeBackend = true;

  // Node.js backend URL
  static const String nodeBackendUrl = 'http://your-server:3000';

  // Laravel backend URL (still needed for auth, etc.)
  static const String baseUrl = 'http://your-server:8000';
}
```

## Development

```bash
# Run with nodemon for hot reload
npm run dev

# Run tests
npm test

# Start production
npm start
```

## Deployment

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "src/server.js"]
```

### PM2

```bash
pm2 start src/server.js --name qr-support-backend
```

## License

Private - Karsaaz QR
