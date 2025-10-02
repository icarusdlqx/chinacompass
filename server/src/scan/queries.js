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
    SELECT a.*, s.name as source_name, si.category, si.rank_in_category, si.is_duplicate
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

export function getLatestScanStatus() {
  const scan = db.prepare("SELECT * FROM scans ORDER BY run_started_at DESC LIMIT 1").get();
  if (!scan) return null;

  const rows = db.prepare(`
    SELECT sss.*, src.name AS source_name, src.region AS source_region, src.tier AS source_tier
    FROM scan_source_statuses sss
    LEFT JOIN sources src ON src.id = sss.source_id
    WHERE sss.scan_id = ?
  `).all(scan.id);

  const sources = [];
  let openai = null;
  for (const row of rows) {
    if (row.source_id === "__openai__") {
      openai = {
        source_id: row.source_id,
        classification_status: row.classification_status,
        translation_status: row.translation_status,
        summarization_status: row.summarization_status,
        openai_connected: row.openai_connected,
        openai_error: row.openai_error,
        last_updated_at: row.last_updated_at,
      };
    } else {
      sources.push({
        source_id: row.source_id,
        source_name: row.source_name || row.source_id,
        source_region: row.source_region,
        source_tier: row.source_tier,
        fetch_status: row.fetch_status,
        fetch_started_at: row.fetch_started_at,
        fetch_completed_at: row.fetch_completed_at,
        article_count: row.article_count,
        error_message: row.error_message,
        last_updated_at: row.last_updated_at,
      });
    }
  }

  sources.sort((a, b) => {
    const priority = (status) => {
      if (status === 'error') return 0;
      if (status === 'running') return 1;
      if (status === 'pending') return 2;
      return 3;
    };
    const diff = priority(a.fetch_status) - priority(b.fetch_status);
    if (diff !== 0) return diff;
    return a.source_name.localeCompare(b.source_name);
  });

  return {
    scan: {
      id: scan.id,
      run_started_at: scan.run_started_at,
      run_completed_at: scan.run_completed_at,
      schedule_kind: scan.schedule_kind,
      timezone: scan.timezone,
      total_articles: scan.total_articles,
      status: scan.status || (scan.run_completed_at ? 'complete' : 'running')
    },
    sources,
    openai,
  };
}
