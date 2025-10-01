import Parser from "rss-parser";

const parser = new Parser({
  timeout: 20000,
  headers: {
    "User-Agent": "ChinaCompassBot/0.1 (+https://example.com; polite; contact: admin@example.com)"
  }
});

export async function fetchFeed(url) {
  try {
    const feed = await parser.parseURL(url);
    return feed.items || [];
  } catch (err) {
    console.warn(`[feeds] Failed to parse ${url}:`, String(err));
    return [];
  }
}
