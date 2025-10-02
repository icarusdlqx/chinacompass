import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SOURCES_PATH = path.join(__dirname, "sources.json");

function expectString(value, errorMessage) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(errorMessage);
  }
  return value.trim();
}

function normalizeFeed(feed, sourceId, feedIndex) {
  if (typeof feed !== "object" || feed === null) {
    throw new Error(`Feed entry ${feedIndex} for source "${sourceId}" must be an object.`);
  }

  const url = expectString(feed.url, `Feed entry ${feedIndex} for source "${sourceId}" is missing a url.`);
  const normalized = {
    ...feed,
    url,
  };

  if ("name" in normalized) {
    normalized.name = expectString(normalized.name, `Feed entry ${feedIndex} for source "${sourceId}" has an invalid name.`);
  }

  if (!("section_hint" in normalized) || normalized.section_hint === undefined || normalized.section_hint === null) {
    normalized.section_hint = "mixed";
  } else {
    normalized.section_hint = expectString(normalized.section_hint, `Feed entry ${feedIndex} for source "${sourceId}" has an invalid section_hint.`);
  }

  return normalized;
}

function normalizeSource(source, index) {
  if (typeof source !== "object" || source === null) {
    throw new Error(`Source entry at index ${index} must be an object.`);
  }

  const id = expectString(source.id, `Source entry at index ${index} is missing an id.`);
  const name = expectString(source.name, `Source "${id}" is missing a name.`);
  const homepageUrl = expectString(source.homepage_url, `Source "${id}" is missing a homepage_url.`);
  const feedsRaw = source.feeds ?? [];

  if (!Array.isArray(feedsRaw) || feedsRaw.length === 0) {
    throw new Error(`Source "${id}" must declare at least one feed entry.`);
  }

  const feeds = feedsRaw.map((feed, feedIndex) => normalizeFeed(feed, id, feedIndex));

  return {
    ...source,
    id,
    name,
    homepage_url: homepageUrl,
    feeds,
    enabled: source.enabled ?? 1,
  };
}

function parseSources(json) {
  if (!Array.isArray(json)) {
    throw new Error("Sources registry JSON must be an array of sources.");
  }

  return json.map((source, index) => normalizeSource(source, index));
}

export function loadSourceRegistry() {
  const contents = fs.readFileSync(SOURCES_PATH, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new Error(`Unable to parse sources registry JSON at ${SOURCES_PATH}: ${error.message}`);
  }
  return parseSources(parsed);
}

export const SOURCE_REGISTRY = loadSourceRegistry();

export function getAllSources() {
  return SOURCE_REGISTRY;
}

export function getEnabledSources() {
  return SOURCE_REGISTRY.filter((source) => source.enabled !== 0);
}

export function getSourceById(id) {
  return SOURCE_REGISTRY.find((source) => source.id === id) ?? null;
}

export { SOURCES_PATH };
