import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import { db } from "../util/db.js";
import { config } from "../util/config.js";
import { SOURCE_REGISTRY } from "../feeds/registry.js";
import { fetchFeed } from "../feeds/fetchFeeds.js";
import { articleIdFrom, normalizeTitle, groupBy, CATEGORY_ORDER } from "./helpers.js";
import { classifyItems, translateItems, summarizeCategory, hashStable } from "../ai/openai.js";

dayjs.extend(utc);
dayjs.extend(timezone);

export async function runFullScan({ manual=false } = {}) {
  const startedAt = dayjs().tz(config.TZ).toISOString();
  const scanId = hashStable(startedAt + "|" + (manual ? "manual" : "scheduled"));

  db.prepare("INSERT INTO scans (id, run_started_at, schedule_kind, timezone, total_articles) VALUES (?, ?, ?, ?, 0)")
    .run(scanId, startedAt, manual ? "manual" : "scheduled", config.TZ);

  // Ensure sources table is seeded
  for (const s of SOURCE_REGISTRY) {
    db.prepare(`INSERT OR IGNORE INTO sources (id, name, region, tier, homepage_url, enabled)
                VALUES (@id, @name, @region, @tier, @homepage_url, 1)`).run(s);
  }

  // 1) Fetch feeds
  const rawItems = [];
  for (const src of SOURCE_REGISTRY.filter(s => s.enabled !== 0)) {
    for (const feed of (src.feeds || [])) {
      const items = await fetchFeed(feed.url);
      for (const it of items) {
        const url = it.link || it.guid || "";
        if (!url) continue;
        rawItems.push({
          source_id: src.id,
          source_name: src.name,
          url,
          title_zh: normalizeTitle(it.title || ""),
          dek_zh: normalizeTitle(it.contentSnippet || it.content || ""),
          published_at: it.isoDate || it.pubDate || null,
          fetched_at: startedAt,
          section_hint: feed.section_hint || "mixed"
        });
      }
    }
  }

  // 2) Deduplicate by URL + title
  const seen = new Set();
  const items = [];
  for (const it of rawItems) {
    const key = it.url + "|" + it.title_zh;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(it);
  }

  // 3) Persist articles
  for (const it of items) {
    const id = articleIdFrom(it.url, it.title_zh);
    it.id = id;
    db.prepare(`INSERT OR IGNORE INTO articles
        (id, source_id, url, title_zh, dek_zh, published_at, fetched_at, section_hint, hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, it.source_id, it.url, it.title_zh, it.dek_zh, it.published_at, it.fetched_at, it.section_hint, hashStable(it.url));
  }

  // 4) Classification
  const classification = await classifyItems(config.OPENAI_MODEL, items);
  const catByUrl = new Map();
  for (const row of (classification.items || [])) {
    catByUrl.set(row.url, { category: row.category, confidence: row.confidence ?? 0.5 });
  }
  for (const it of items) {
    const cat = catByUrl.get(it.url) || { category: "society", confidence: 0.4 };
    db.prepare(`INSERT OR REPLACE INTO classifications (article_id, category, confidence, method, created_at)
                VALUES (?, ?, ?, ?, ?)`)
      .run(it.id, cat.category, cat.confidence, "openai_structured", startedAt);
  }

  // 5) Translation
  const translation = await translateItems(config.OPENAI_MODEL, items);
  const tByUrl = new Map();
  for (const row of (translation.translations || [])) {
    tByUrl.set(row.url, { title_en: row.title_en, dek_en: row.dek_en || "" });
  }
  for (const it of items) {
    const tr = tByUrl.get(it.url);
    if (tr) {
      db.prepare(`INSERT OR REPLACE INTO translations (article_id, title_en, dek_en, engine, created_at)
                  VALUES (?, ?, ?, ?, ?)`)
        .run(it.id, tr.title_en, tr.dek_en, "openai", startedAt);
    }
  }

  // 6) Build scan_items ranked per category
  const itemsWithCat = items.map(it => {
    const row = db.prepare("SELECT category FROM classifications WHERE article_id = ?").get(it.id);
    return { ...it, category: row?.category || "society" };
  });
  const byCat = groupBy(itemsWithCat, (x) => x.category);
  for (const [cat, list] of byCat.entries()) {
    // rank by source centrality then published time
    list.sort((a, b) => (a.source_id.includes("people") ? -1 : 0) - (b.source_id.includes("people") ? -1 : 0)
      || String(b.published_at || "").localeCompare(String(a.published_at || "")));
    let rank = 1;
    for (const it of list) {
      db.prepare(`INSERT OR REPLACE INTO scan_items (scan_id, article_id, category, rank_in_category, is_duplicate, cluster_id)
                  VALUES (?, ?, ?, ?, 0, NULL)`)
        .run(scanId, it.id, cat, rank++);
    }
  }

  // 7) Summaries per category
  for (const category of ["international","domestic_politics","business","society","technology","military","science","opinion"]) {
    const rows = db.prepare(`
      SELECT a.*, s.name as source_name, t.title_en
      FROM scan_items si
      JOIN articles a ON a.id = si.article_id
      JOIN sources s ON s.id = a.source_id
      LEFT JOIN translations t ON t.article_id = a.id
      WHERE si.scan_id = ? AND si.category = ?
      ORDER BY si.rank_in_category ASC
      LIMIT 20
    `).all(scanId, category);
    if (!rows.length) continue;
    const summary = await summarizeCategory(config.OPENAI_MODEL, startedAt, category, rows);
    db.prepare(`INSERT OR REPLACE INTO summaries (scan_id, category, json_payload, created_at)
                VALUES (?, ?, ?, ?)`)
      .run(scanId, category, JSON.stringify(summary), startedAt);
  }

  const completedAt = dayjs().tz(config.TZ).toISOString();
  db.prepare("UPDATE scans SET run_completed_at = ?, total_articles = ? WHERE id = ?")
    .run(completedAt, items.length, scanId);

  return { id: scanId };
}
