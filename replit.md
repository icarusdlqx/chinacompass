# China Compass - Daily Chinese Headlines Scanner

## Overview
A full-stack application that scans and analyzes Chinese news headlines from major newspapers. The app translates headlines to English, classifies them into 8 categories, and provides daily summary briefings.

## Project Architecture

### Backend (Node.js/Express)
- **Location**: `/server`
- **Port**: 8000 (localhost)
- **Database**: SQLite at `./data/app.db`
- **Key Features**:
  - REST API for news scanning and retrieval
  - OpenAI integration for translation and classification
  - Scheduled scanning capability
  - SQLite database for article storage

### Frontend (React/TypeScript/Vite)
- **Location**: `/web`
- **Port**: 5000 (0.0.0.0)
- **Framework**: React with Vite
- **Styling**: TailwindCSS
- **Key Features**:
  - Daily news briefing view
  - Historical scan log
  - Category-based article organization

## Setup Notes (October 2, 2025)

### Configuration Changes for Replit
1. **Backend Port**: Changed from 8787 to 8000 to match Vite proxy configuration
2. **Backend Host**: Configured to bind to localhost only (security best practice)
3. **Frontend Configuration**:
   - Host: 0.0.0.0 (required for Replit proxy)
   - Port: 5000
   - HMR clientPort: 443 (for Replit environment)
   - Proxy: API requests to localhost:8000
4. **Dependencies**: Installed via npm for both server and web directories

### Environment Variables
Located in `/server/.env`:
- `PORT`: 8000
- `TZ`: Asia/Shanghai
- `DB_FILE`: ./data/app.db
- `OPENAI_API_KEY`: (required for AI features - currently empty)
- `OPENAI_MODEL`: gpt-4o-mini
- `USE_EMBEDDINGS`: false
- `ADMIN_TOKEN`: (required for /api/scan endpoint - currently empty)

### Workflows
- **Frontend**: Runs both backend and frontend servers
  - Command: `bash -c 'cd server && npm run dev & cd web && npm run dev'`
  - Port: 5000 (webview)

### Deployment
- **Type**: Autoscale
- **Build**: Builds web frontend and copies to server/web-dist
- **Run**: Starts server which serves both API and static frontend

## API Endpoints
- `POST /api/scan`: Run manual scan (requires ADMIN_TOKEN)
- `GET /api/today`: Get latest scan results
- `GET /api/scans`: List all scans
- `GET /api/scans/:id`: Get specific scan by ID

## User Preferences
None specified yet.
