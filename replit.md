# China Compass – Daily Chinese Headlines Scanner

## Overview
A full-stack application that ingests front-page/section feeds from major Chinese-language newspapers, classifies them into 8 categories, translates headlines to English, and synthesizes per-category wrap-ups. The app runs daily scans and provides a browsable interface for viewing daily logs.

## Project Architecture

### Frontend
- **Technology**: React + TypeScript + Vite
- **Port**: 5000 (0.0.0.0)
- **Location**: `/web` directory
- **Features**: 
  - Daily headlines view
  - Scan history log
  - Manual rescan trigger
  - Category-based organization

### Backend
- **Technology**: Node.js + Express
- **Port**: 8000 (localhost)
- **Location**: `/server` directory
- **API Endpoints**:
  - `POST /api/scan` - Trigger manual scan (requires ADMIN_TOKEN)
  - `GET /api/today` - Get latest scan results
  - `GET /api/status` - Get latest scan status
  - `GET /api/scans` - List historical scans
  - `GET /api/scans/:id` - Get specific scan by ID

### Database
- **Type**: SQLite (better-sqlite3)
- **Location**: `server/data/app.db`
- **Features**: WAL mode enabled for better concurrency

### AI Integration
- **Provider**: OpenAI
- **Features**:
  - Article classification into 8 categories
  - Chinese to English translation
  - Category summarization
- **Models**: Configurable (default: gpt-4o-mini)

## Recent Changes (2025-10-03)

### Initial Replit Setup
1. Installed Node.js dependencies for both server and web applications
2. Updated Vite configuration to allow Replit proxy hosts (.replit.dev, .replit.app, .replit.co)
3. Changed backend to listen on localhost:8000 (frontend proxies API calls)
4. Created `.env` file with placeholder configuration values
5. Configured workflow to run both server and web in development mode
6. Set up deployment configuration for production (autoscale)

## Configuration

### Environment Variables (server/.env)
Required environment variables for the backend:

- `PORT` - Server port (default: 8000)
- `TZ` - Timezone (default: Asia/Shanghai)
- `DB_FILE` - SQLite database path (default: ./data/app.db)
- `OPENAI_API_KEY` - OpenAI API key (required for AI features)
- `OPENAI_MODEL` - OpenAI model to use (default: gpt-4o-mini)
- `USE_EMBEDDINGS` - Enable embeddings (default: false)
- `EMBEDDING_MODEL` - Embedding model (default: text-embedding-3-large)
- `ADMIN_TOKEN` - Admin token for triggering manual scans

### Development

The application runs both frontend and backend concurrently:
- Frontend: http://localhost:5000 (proxied by Replit)
- Backend API: http://localhost:8000 (accessed via /api/* proxy)

### Production Deployment

The deployment configuration:
- **Build**: Compiles TypeScript and builds frontend assets
- **Run**: Serves built frontend from backend server
- **Type**: Autoscale (stateless web service)

## User Instructions

### Setting Up OpenAI Integration

To enable AI features (classification, translation, summarization):

1. Get an OpenAI API key from https://platform.openai.com
2. Open the Secrets tab in Replit
3. Add a secret named `OPENAI_API_KEY` with your API key
4. Optionally add `ADMIN_TOKEN` secret for scan authentication
5. Restart the application

### Running Manual Scans

To trigger a manual scan:
1. Click the "Rescan" button in the UI (requires ADMIN_TOKEN)
2. Or use curl: `curl -X POST -H "Authorization: Bearer YOUR_ADMIN_TOKEN" http://localhost:8000/api/scan?manual=1`

### Scheduling Daily Scans

For production, set up a scheduled deployment in Replit:
- Time: 08:30 Asia/Shanghai
- Command: `cd server && npm run scan`

## Project Structure

```
china-compass/
├── server/               # Backend API
│   ├── data/            # SQLite database
│   ├── src/
│   │   ├── ai/          # OpenAI integration
│   │   ├── feeds/       # RSS feed sources
│   │   ├── jobs/        # Scan jobs
│   │   ├── scan/        # Scan logic
│   │   └── util/        # Config and DB utils
│   └── package.json
├── web/                 # Frontend React app
│   ├── src/
│   │   ├── components/  # React components
│   │   └── pages/       # Page components
│   └── package.json
└── package.json         # Root package (meta)
```

## Known Issues

- HMR websocket warnings in console are cosmetic (Replit proxy behavior)
- Database files are gitignored; new deployments start with empty database
- AI features require OPENAI_API_KEY to be set
