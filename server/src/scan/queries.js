import dayjs from "dayjs";
import { db } from "../util/db.js";

export function getLatestScan() {
  const scan = db.prepare("SELECT * FROM scans ORDER BY run_started_at DESC LIMIT 1").get();
  if (!scan) return null;
  return getScanById(scan.id);
}

export function listScans(limit=30) {
  return db.prepare("SELECT id, run_started_at, run_completed_at, schedule_kind, timezone, total_articles FROM scans ORDER BY run_started_at DESC LIMIT ?").all(limit);
}

export function getScanById(id) {
  const scan = db.prepare("SELECT * FROM scans WHERE id = ?").get(id);
  if (!scan) return null;
  const items = db.prepare(`
    SELECT a.*, s.name as source_name, si.category, si.rank_in_category, si.salience_score, si.is_duplicate
    FROM scan_items si
    JOIN articles a ON a.id = si.article_id
    JOIN sources s ON s.id = a.source_id
    WHERE si.scan_id = ?
    ORDER BY si.category, si.rank_in_category, a.published_at DESC, a.fetched_at DESC
  `).all(id);
  const summaries = db.prepare("SELECT category, json_payload FROM summaries WHERE scan_id = ?").all(id);
  return {
    meta: {
      id: scan.id,
      run_started_at: scan.run_started_at,
      run_completed_at: scan.run_completed_at,
      schedule_kind: scan.schedule_kind,
      timezone: scan.timezone,
      total_articles: scan.total_articles
    },
    categories: groupByCategory(items),
    summaries: Object.fromEntries(summaries.map(s => [s.category, JSON.parse(s.json_payload)]))
  };
}

function groupByCategory(items) {
  const map = {};
  for (const it of items) {
    const cat = it.category || "uncategorized";
    if (!map[cat]) map[cat] = [];
    map[cat].push(it);
  }
  return map;
}
