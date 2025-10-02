import OpenAI from "openai";
import crypto from "crypto";
import { config } from "../util/config.js";

if (!config.OPENAI_API_KEY) {
  console.warn("[openai] OPENAI_API_KEY not set; AI features will fail.");
}

let _openai = null;
function getOpenAI() {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: config.OPENAI_API_KEY || 'dummy-key-for-dev' });
  }
  return _openai;
}

export const openai = getOpenAI();

const CLASSIFICATION_SCHEMA = {
  name: "classification_schema",
  schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            url: { type: "string", format: "uri" },
            category: {
              type: "string",
              enum: ["international","domestic_politics","business","society","technology","military","science","opinion"]
            },
            confidence: { type: "number", minimum: 0, maximum: 1 }
          },
          required: ["url","category"]
        }
      }
    },
    required: ["items"]
  },
  strict: true
};

const TRANSLATION_SCHEMA = {
  name: "translation_schema",
  schema: {
    type: "object",
    properties: {
      translations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            url: { type: "string", format: "uri" },
            title_en: { type: "string" },
            dek_en: { type: "string" }
          },
          required: ["url","title_en"]
        }
      }
    },
    required: ["translations"]
  },
  strict: true
};

const RANKING_SCHEMA = {
  name: "ranking_schema",
  schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            article_id: { type: "string" },
            salience_score: { type: "number", minimum: 0, maximum: 100 }
          },
          required: ["article_id", "salience_score"]
        }
      }
    },
    required: ["items"]
  },
  strict: true
};

const SUMMARY_SCHEMA = {
  name: "summary_schema",
  schema: {
    type: "object",
    properties: {
      executive_summary: { type: "string" },
      key_themes: { type: "array", items: { type: "string" } },
      cross_outlet_contrasts: { type: "array", items: { type: "string" } },
      watchlist: { type: "array", items: { type: "string" } },
      notable_quotes: { type: "array", items: { type: "string" } }
    },
    required: ["executive_summary"]
  },
  strict: true
};

export async function classifyItems(model, items) {
  const input = {
    task: "Classify Chinese news items into exactly one category.",
    categories: ["international","domestic_politics","business","society","technology","military","science","opinion"],
    items: items.map(i => ({ url: i.url, title_zh: i.title_zh, section_hint: i.section_hint || "" }))
  };
  const resp = await openai.responses.create({
    model,
    input: JSON.stringify(input),
    text: { format: "json_schema", schema: CLASSIFICATION_SCHEMA }
  });
  // Responses API: when using structured outputs, parse text or output[]
  const text = resp.output_text || (resp.output && resp.output[0] && resp.output[0].content && resp.output[0].content[0] && resp.output[0].content[0].text) || "{}";
  return JSON.parse(text);
}

export async function translateItems(model, items) {
  const input = {
    task: "Translate the Chinese headlines to English concisely. Preserve named entities, institutions, policy terms; do not anglicize official names (e.g., keep 'NDRC', 'CCP', 'PLA'). Provide plain text. If a subtitle/dek is present, translate it too.",
    items: items.map(i => ({ url: i.url, title_zh: i.title_zh, dek_zh: i.dek_zh || "" }))
  };
  const resp = await openai.responses.create({
    model,
    input: JSON.stringify(input),
    text: { format: "json_schema", schema: TRANSLATION_SCHEMA }
  });
  const text = resp.output_text || (resp.output && resp.output[0]?.content?.[0]?.text) || "{}";
  return JSON.parse(text);
}

export async function rankItems(model, items) {
  if (!items.length) return { items: [] };
  const input = {
    task: "Score each Chinese news article's salience within its assigned category (0-100). Higher scores reflect greater prominence, central policy relevance, or widespread public attention.",
    guidance: "Use the source reputation, section hints, and timing to inform the salience judgment. Output only the score per article; do not reorder or omit entries.",
    items: items.map(i => ({
      article_id: i.article_id,
      url: i.url,
      category: i.category,
      title_zh: i.title_zh,
      title_en: i.title_en || "",
      source_name: i.source_name || "",
      section_hint: i.section_hint || "",
      published_at: i.published_at || ""
    }))
  };
  const resp = await openai.responses.create({
    model,
    input: JSON.stringify(input),
    text: { format: "json_schema", schema: RANKING_SCHEMA }
  });
  const text = resp.output_text || (resp.output && resp.output[0]?.content?.[0]?.text) || "{}";
  return JSON.parse(text);
}

export async function summarizeCategory(model, dateISO, category, items) {
  const input = {
    role: "You are compiling a diplomatic morning brief. Compare narratives across outlets; highlight policy signals, euphemisms, and divergences. Neutral tone.",
    date: dateISO,
    category,
    items: items.map(i => ({
      source: i.source_name,
      title_zh: i.title_zh,
      title_en: i.title_en || "",
      url: i.url
    }))
  };
  const resp = await openai.responses.create({
    model,
    input: JSON.stringify(input),
    text: { format: "json_schema", schema: SUMMARY_SCHEMA }
  });
  const text = resp.output_text || (resp.output && resp.output[0]?.content?.[0]?.text) || "{}";
  return JSON.parse(text);
}

export function hashStable(s) {
  return crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);
}
