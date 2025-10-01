# Beijing Brief – Daily Chinese Headlines Scanner

A full-stack app to ingest front-page/section feeds from major Chinese-language newspapers,
classify them into 8 categories, translate headlines to English, and synthesize per-category wrap-ups.
Runs daily at 08:30 Asia/Shanghai with manual "Rescan" and a browsable daily log.

## Quick start (local)
```bash
# 1) Server
cd server
cp .env.example .env   # add your keys
npm i
npm run dev            # starts http://localhost:8787

# 2) Frontend
cd ../web
npm i
npm run dev            # starts http://localhost:5173 (Vite)

# In production, build the web app and serve via the server
npm run build
cd ../server
npm run start          # serves web/dist at / and API under /api/*
```

## Replit
- Deploy the **server** as a web app (Autoscale or Reserved VM).
- Create a **Scheduled Deployment** that runs: `npm run scan` in the `server` folder at **08:30 Asia/Shanghai**.
- Or use Cloudflare Workers Cron to call `POST /api/scan`.

See `server/README.md` for scheduling, legal notes, and configuration.
