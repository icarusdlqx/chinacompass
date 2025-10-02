# Server

## Environment
Copy `.env.example` to `.env` and set your values. The default DB is SQLite at `./data/app.db`.

## Scheduling
- **Replit**: Use Scheduled Deployments to run `npm run scan` at **08:30 Asia/Shanghai**.
- **Cloudflare Workers**: Create a cron trigger to `POST https://<your-domain>/api/scan?manual=0&token=<ADMIN_TOKEN>`.

## Legal & Robots
Prefer official RSS feeds and respect each site’s Terms of Service and robots.txt. Throttle requests and cache feeds.

## Feeds registry
- Edit `src/feeds/sources.json` to add, update, or remove outlets. Each source entry must include an `id`, human-readable `name`, `homepage_url`, and at least one feed with a `url`. Optional fields such as `region`, `tier`, and `section_hint` help downstream categorisation but are not required.
- No code changes are necessary after updating the JSON. The registry loader validates the file on startup and populates the database automatically during scans.

## API
- `POST /api/scan` (auth: Bearer `ADMIN_TOKEN`) – run full scan now.
- `GET /api/today` – latest scan.
- `GET /api/scans?limit=30` – list scan metadata.
- `GET /api/scans/:id` – specific scan payload.

## Data model
See `src/db.js` for schema creation.
