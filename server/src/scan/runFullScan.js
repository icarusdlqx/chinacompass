import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import { db } from "../util/db.js";
import { config } from "../util/config.js";
import { getAllSources, getEnabledSources } from "../feeds/registry.js";
import { fetchFeed } from "../feeds/fetchFeeds.js";
import { articleIdFrom, normalizeTitle, groupBy } from "./helpers.js";
import { classifyItemsBatched, translateItemsBatched, summarizeCategory, hashStable } from "../ai/openai.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const OPENAI_SOURCE_ID = "__openai__";
const MAX_ERROR_LENGTH = 500;
const MAX_TITLE_CHARS = 512;
const MAX_DEK_CHARS = 1200;
const MAX_FEED_ITEMS = 100;

function truncateField(value, maxLength) {
  if (!value) return "";
  const str = typeof value === "string" ? value : String(value);
  return str.length > maxLength ? str.slice(0, maxLength) : str;
}

function truncateError(err) {
  if (!err) return null;
  const message = typeof err === "string" ? err : (err.message || String(err));
  return message.slice(0, MAX_ERROR_LENGTH);
}

export async function runFullScan({ manual=false } = {}) {
  const startedAt = dayjs().tz(config.TZ).toISOString();
  const scanId = hashStable(startedAt + "|" + (manual ? "manual" : "scheduled"));
  const now = () => dayjs().tz(config.TZ).toISOString();

  db.prepare("INSERT INTO scans (id, run_started_at, schedule_kind, timezone, total_articles, status) VALUES (?, ?, ?, ?, 0, 'running')")
    .run(scanId, startedAt, manual ? "manual" : "scheduled", config.TZ);

  const ensureStatusRow = db.prepare(`
    INSERT OR IGNORE INTO scan_source_statuses (scan_id, source_id, fetch_status, article_count, last_updated_at)
    VALUES (?, ?, 'pending', 0, ?)
  `);

  const startFetch = db.prepare(`
    UPDATE scan_source_statuses
    SET fetch_status = 'running', fetch_started_at = ?, error_message = NULL, article_count = 0, last_updated_at = ?
    WHERE scan_id = ? AND source_id = ?
  `);

  const finishFetchSuccess = db.prepare(`
    UPDATE scan_source_statuses
    SET fetch_status = 'success', fetch_completed_at = ?, article_count = ?, error_message = NULL, last_updated_at = ?
    WHERE scan_id = ? AND source_id = ?
  `);

  const finishFetchError = db.prepare(`
    UPDATE scan_source_statuses
    SET fetch_status = 'error', fetch_completed_at = ?, article_count = ?, error_message = ?, last_updated_at = ?
    WHERE scan_id = ? AND source_id = ?
  `);

  const updateArticleCount = db.prepare(`
    UPDATE scan_source_statuses
    SET article_count = ?, last_updated_at = ?
    WHERE scan_id = ? AND source_id = ?
  `);

  ensureStatusRow.run(scanId, OPENAI_SOURCE_ID, startedAt);
  db.prepare(`
    UPDATE scan_source_statuses
    SET fetch_status = 'n/a', classification_status = 'pending', translation_status = 'pending',
        summarization_status = 'pending', openai_connected = NULL, openai_error = NULL, last_updated_at = ?
    WHERE scan_id = ? AND source_id = ?
  `).run(startedAt, scanId, OPENAI_SOURCE_ID);

  const setOpenAIStatus = (fields = {}) => {
    const keys = Object.keys(fields);
    if (!keys.length) return;
    const assignments = keys.map((key) => `${key} = ?`).join(", ");
    const stmt = db.prepare(`
      UPDATE scan_source_statuses
      SET ${assignments}, last_updated_at = ?
      WHERE scan_id = ? AND source_id = ?
    `);
    stmt.run(...keys.map((key) => fields[key]), now(), scanId, OPENAI_SOURCE_ID);
  };

  // Ensure sources table is seeded
  for (const s of getAllSources()) {
    db.prepare(`INSERT OR IGNORE INTO sources (id, name, region, tier, homepage_url, enabled)
                VALUES (@id, @name, @region, @tier, @homepage_url, 1)`).run(s);
  }

  const enabledSources = Array.from(getEnabledSources());
  const rawItems = [];
  let items = [];
  let classificationPhase = 'pending';
  let translationPhase = 'pending';
  let summarizationPhase = 'pending';
  let lastOpenAIError = null;

  try {
    // 1) Fetch feeds
    for (const src of enabledSources) {
      ensureStatusRow.run(scanId, src.id, startedAt);
      const fetchStartedAt = now();
      startFetch.run(fetchStartedAt, fetchStartedAt, scanId, src.id);
      let totalForSource = 0;
      let lastError = null;
      for (const feed of (src.feeds || [])) {
        try {
          const fetchedItems = await fetchFeed(feed.url);
          const feedItems = Array.isArray(fetchedItems)
            ? fetchedItems.slice(0, MAX_FEED_ITEMS)
            : [];
          totalForSource += feedItems.length;
          for (const it of feedItems) {
            const url = it.link || it.guid || "";
            if (!url) continue;
            rawItems.push({
              source_id: src.id,
              source_name: src.name,
              url,
              title_zh: truncateField(normalizeTitle(it.title || ""), MAX_TITLE_CHARS),
              dek_zh: truncateField(normalizeTitle(it.contentSnippet || it.content || ""), MAX_DEK_CHARS),
              published_at: it.isoDate || it.pubDate || null,
              fetched_at: startedAt,
              section_hint: feed.section_hint || "mixed"
            });
          }
        } catch (err) {
          lastError = truncateError(err);
        }
      }
      const fetchCompletedAt = now();
      if (lastError) {
        finishFetchError.run(fetchCompletedAt, totalForSource, lastError, fetchCompletedAt, scanId, src.id);
      } else {
        finishFetchSuccess.run(fetchCompletedAt, totalForSource, fetchCompletedAt, scanId, src.id);
      }
    }

    // 2) Deduplicate by URL + title
    const seen = new Set();
    items = [];
    for (const it of rawItems) {
      const key = it.url + "|" + it.title_zh;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(it);
    }

    const dedupCounts = new Map();
    for (const it of items) {
      dedupCounts.set(it.source_id, (dedupCounts.get(it.source_id) || 0) + 1);
    }
    const dedupAt = now();
    for (const src of enabledSources) {
      updateArticleCount.run(dedupCounts.get(src.id) || 0, dedupAt, scanId, src.id);
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

    if (items.length === 0) {
      classificationPhase = 'skipped';
      translationPhase = 'skipped';
      summarizationPhase = 'skipped';
      lastOpenAIError = null;
      setOpenAIStatus({
        classification_status: 'skipped',
        translation_status: 'skipped',
        summarization_status: 'skipped',
        openai_connected: null,
        openai_error: null
      });
    } else {
      // 4) Classification
      try {
        classificationPhase = 'running';
        lastOpenAIError = null;
        setOpenAIStatus({ classification_status: 'running', openai_error: null });
        const classification = await classifyItemsBatched(config.OPENAI_MODEL, items);
        classificationPhase = 'success';
        setOpenAIStatus({ classification_status: 'success', openai_connected: 1 });
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
      } catch (err) {
        classificationPhase = 'error';
        lastOpenAIError = truncateError(err);
        setOpenAIStatus({ classification_status: 'error', openai_connected: 0, openai_error: lastOpenAIError });
        throw err;
      }

      // 5) Translation
      let translations;
      try {
        translationPhase = 'running';
        lastOpenAIError = null;
        setOpenAIStatus({ translation_status: 'running', openai_error: null });
        translations = await translateItemsBatched(config.OPENAI_MODEL, items);
        translationPhase = 'success';
        setOpenAIStatus({ translation_status: 'success', openai_connected: 1 });
      } catch (err) {
        translationPhase = 'error';
        lastOpenAIError = truncateError(err);
        setOpenAIStatus({ translation_status: 'error', openai_connected: 0, openai_error: lastOpenAIError });
        throw err;
      }
      const tByUrl = new Map();
      for (const row of (translations?.translations || [])) {
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

      // 6) Build scan_items ranked per category + summaries
      try {
        summarizationPhase = 'running';
        lastOpenAIError = null;
        setOpenAIStatus({ summarization_status: 'running', openai_error: null });
        const itemsWithCat = items.map(it => {
          const row = db.prepare("SELECT category FROM classifications WHERE article_id = ?").get(it.id);
          return { ...it, category: row?.category || "society" };
        });
        const byCat = groupBy(itemsWithCat, (x) => x.category);
        for (const [cat, list] of byCat.entries()) {
          list.sort((a, b) => (a.source_id.includes("people") ? -1 : 0) - (b.source_id.includes("people") ? -1 : 0)
            || String(b.published_at || "").localeCompare(String(a.published_at || "")));
          let rank = 1;
          for (const it of list) {
            db.prepare(`INSERT OR REPLACE INTO scan_items (scan_id, article_id, category, rank_in_category, is_duplicate, cluster_id)
                        VALUES (?, ?, ?, ?, 0, NULL)`)
              .run(scanId, it.id, cat, rank++);
          }
        }

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
        summarizationPhase = 'success';
        setOpenAIStatus({ summarization_status: 'success', openai_connected: 1 });
      } catch (err) {
        summarizationPhase = 'error';
        lastOpenAIError = truncateError(err);
        setOpenAIStatus({ summarization_status: 'error', openai_connected: 0, openai_error: lastOpenAIError });
        throw err;
      }
    }

    const completedAt = now();
    db.prepare("UPDATE scans SET run_completed_at = ?, total_articles = ?, status = ? WHERE id = ?")
      .run(completedAt, items.length, 'complete', scanId);
  } catch (err) {
    const failedAt = now();
    const failureMessage = truncateError(err);
    lastOpenAIError = failureMessage;
    const fields = {
      openai_connected: 0,
      openai_error: failureMessage
    };
    if (classificationPhase === 'pending' || classificationPhase === 'running') {
      fields.classification_status = 'error';
      classificationPhase = 'error';
    }
    if (translationPhase === 'pending' || translationPhase === 'running') {
      fields.translation_status = 'error';
      translationPhase = 'error';
    }
    if (summarizationPhase === 'pending' || summarizationPhase === 'running') {
      fields.summarization_status = 'error';
      summarizationPhase = 'error';
    }
    setOpenAIStatus(fields);
    db.prepare("UPDATE scans SET status = ?, run_completed_at = ?, total_articles = ? WHERE id = ?")
      .run('failed', failedAt, items.length, scanId);
    throw err;
  }

  return { id: scanId };
}
