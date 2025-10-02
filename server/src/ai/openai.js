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

export const MAX_CLASSIFICATION_BATCH_SIZE = 20;
export const DEFAULT_CLASSIFICATION_BATCH_SIZE = 12;
export const MAX_TRANSLATION_BATCH_SIZE = 12;
export const DEFAULT_TRANSLATION_BATCH_SIZE = 8;
const MAX_TITLE_LENGTH = 512;
const MAX_DEK_LENGTH = 1200;
const MAX_SECTION_HINT_LENGTH = 128;

const JSON_SCHEMA_CAPABLE_MODELS = [
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4.1-nano",
  "o4-mini"
];

export function modelSupportsSchemaForcing(modelName = config.OPENAI_MODEL) {
  if (!modelName) {
    return false;
  }
  const normalized = modelName.toLowerCase();
  return JSON_SCHEMA_CAPABLE_MODELS.some(prefix => normalized.startsWith(prefix));
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function ensureUrl(value, fieldName) {
  if (!isNonEmptyString(value)) {
    throw new Error(`[openai] Expected ${fieldName} to be a non-empty string.`);
  }
  try {
    new URL(value);
  } catch (err) {
    throw new Error(`[openai] Expected ${fieldName} to be a valid URL.`);
  }
}

function validateClassification(data) {
  if (typeof data !== "object" || data === null) {
    throw new Error("[openai] Classification response must be an object.");
  }
  if (!Array.isArray(data.items)) {
    throw new Error("[openai] Classification response must include an items array.");
  }
  const allowedCategories = CLASSIFICATION_SCHEMA.schema.properties.items.items.properties.category.enum;
  data.items.forEach((item, idx) => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`[openai] Classification item #${idx} must be an object.`);
    }
    ensureUrl(item.url, `classification item #${idx} url`);
    if (!allowedCategories.includes(item.category)) {
      throw new Error(`[openai] Classification item #${idx} category must be one of ${allowedCategories.join(", ")}.`);
    }
    if (typeof item.confidence !== "number" || Number.isNaN(item.confidence) || item.confidence < 0 || item.confidence > 1) {
      throw new Error(`[openai] Classification item #${idx} confidence must be a number between 0 and 1.`);
    }
  });
  return data;
}

function validateTranslation(data) {
  if (typeof data !== "object" || data === null) {
    throw new Error("[openai] Translation response must be an object.");
  }
  if (!Array.isArray(data.translations)) {
    throw new Error("[openai] Translation response must include a translations array.");
  }
  data.translations.forEach((item, idx) => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`[openai] Translation item #${idx} must be an object.`);
    }
    ensureUrl(item.url, `translation item #${idx} url`);
    if (!isNonEmptyString(item.title_en)) {
      throw new Error(`[openai] Translation item #${idx} title_en must be a non-empty string.`);
    }
    if (typeof item.dek_en !== "string") {
      throw new Error(`[openai] Translation item #${idx} dek_en must be a string.`);
    }
  });
  return data;
}

function validateSummary(data) {
  if (typeof data !== "object" || data === null) {
    throw new Error("[openai] Summary response must be an object.");
  }
  if (!isNonEmptyString(data.executive_summary)) {
    throw new Error("[openai] Summary response must include a non-empty executive_summary string.");
  }

  const arrayFields = [
    "key_themes",
    "cross_outlet_contrasts",
    "watchlist",
    "notable_quotes"
  ];

  arrayFields.forEach(field => {
    if (!Array.isArray(data[field])) {
      throw new Error(`[openai] Summary field ${field} must be an array.`);
    }
    data[field].forEach((entry, idx) => {
      if (!isNonEmptyString(entry)) {
        throw new Error(`[openai] Summary field ${field} entry #${idx} must be a non-empty string.`);
      }
    });
  });

  return data;
}

function validateAgainstSchema(schemaDef, data) {
  switch (schemaDef.name) {
    case CLASSIFICATION_SCHEMA.name:
      return validateClassification(data);
    case TRANSLATION_SCHEMA.name:
      return validateTranslation(data);
    case SUMMARY_SCHEMA.name:
      return validateSummary(data);
    default:
      return data;
  }
}

function limitString(value, maxLength) {
  if (!value) {
    return "";
  }
  const str = typeof value === "string" ? value : String(value);
  return str.length > maxLength ? str.slice(0, maxLength) : str;
}

function clampBatchSize(requestedSize, fallbackSize, maxSize) {
  const fallback = Number.isInteger(fallbackSize) && fallbackSize > 0 ? fallbackSize : 1;
  const candidate = Number.isInteger(requestedSize) && requestedSize > 0 ? requestedSize : fallback;
  return Math.max(1, Math.min(candidate, maxSize));
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function extractJsonFromText(text) {
  if (!text) {
    return {};
  }
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (err) {
    const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)```/i) || trimmed.match(/```\s*([\s\S]*?)```/i);
    if (fencedMatch) {
      try {
        return JSON.parse(fencedMatch[1]);
      } catch (innerErr) {
        // continue to structured extraction below
      }
    }
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      const possibleJson = trimmed.slice(start, end + 1);
      try {
        return JSON.parse(possibleJson);
      } catch (innerErr) {
        // fall through to error below
      }
    }
    throw new Error(`[openai] Unable to parse JSON response: ${text}`);
  }
}

async function requestStructuredCompletion({ model, messages, schemaDef }) {
  const supportsSchema = modelSupportsSchemaForcing(model);
  const payload = {
    model,
    messages
  };

  if (supportsSchema) {
    payload.response_format = {
      type: "json_schema",
      json_schema: schemaDef
    };
    console.info(`[openai] Using json_schema forcing for model ${model} (${schemaDef.name}).`);
  } else {
    payload.response_format = {
      type: "json_object"
    };
    console.warn(`[openai] Model ${model} does not support json_schema; using json_object fallback for ${schemaDef.name}.`);
  }

  const resp = await openai.chat.completions.create(payload);
  const text = resp.choices[0]?.message?.content || "{}";

  const parsed = extractJsonFromText(text);
  return validateAgainstSchema(schemaDef, parsed);
}

const CLASSIFICATION_SCHEMA = {
  name: "classification_schema",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            url: { type: "string" },
            category: {
              type: "string",
              enum: ["international","domestic_politics","business","society","technology","military","science","opinion"]
            },
            confidence: { type: "number", minimum: 0, maximum: 1 }
          },
          required: ["url","category","confidence"]
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
    additionalProperties: false,
    properties: {
      translations: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            url: { type: "string" },
            title_en: { type: "string" },
            dek_en: { type: "string" }
          },
          required: ["url","title_en","dek_en"]
        }
      }
    },
    required: ["translations"]
  },
  strict: true
};

const SUMMARY_SCHEMA = {
  name: "summary_schema",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      executive_summary: { type: "string" },
      key_themes: { type: "array", items: { type: "string" } },
      cross_outlet_contrasts: { type: "array", items: { type: "string" } },
      watchlist: { type: "array", items: { type: "string" } },
      notable_quotes: { type: "array", items: { type: "string" } }
    },
    required: ["executive_summary","key_themes","cross_outlet_contrasts","watchlist","notable_quotes"]
  },
  strict: true
};

export async function classifyItems(model, items) {
  if (!Array.isArray(items)) {
    throw new Error("[openai] classifyItems expects an array of items.");
  }
  if (items.length > MAX_CLASSIFICATION_BATCH_SIZE) {
    throw new Error(`[openai] classifyItems received ${items.length} items; max allowed per batch is ${MAX_CLASSIFICATION_BATCH_SIZE}.`);
  }
  const input = {
    task: "Classify Chinese news items into exactly one category.",
    categories: ["international","domestic_politics","business","society","technology","military","science","opinion"],
    items: items.map(i => ({
      url: i.url,
      title_zh: limitString(i.title_zh, MAX_TITLE_LENGTH),
      section_hint: limitString(i.section_hint || "", MAX_SECTION_HINT_LENGTH)
    }))
  };
  const prompt = `Respond strictly in JSON matching the schema.\n\n${JSON.stringify(input)}`;
  return requestStructuredCompletion({
    model,
    messages: [
      { role: "user", content: prompt }
    ],
    schemaDef: CLASSIFICATION_SCHEMA
  });
}

export async function translateItems(model, items) {
  if (!Array.isArray(items)) {
    throw new Error("[openai] translateItems expects an array of items.");
  }
  if (items.length > MAX_TRANSLATION_BATCH_SIZE) {
    throw new Error(`[openai] translateItems received ${items.length} items; max allowed per batch is ${MAX_TRANSLATION_BATCH_SIZE}.`);
  }
  const input = {
    task: "Translate the Chinese headlines to English concisely. Preserve named entities, institutions, policy terms; do not anglicize official names (e.g., keep 'NDRC', 'CCP', 'PLA'). Provide plain text. If a subtitle/dek is present, translate it too.",
    items: items.map(i => ({
      url: i.url,
      title_zh: limitString(i.title_zh, MAX_TITLE_LENGTH),
      dek_zh: limitString(i.dek_zh || "", MAX_DEK_LENGTH)
    }))
  };
  const prompt = `Respond strictly in JSON matching the schema.\n\n${JSON.stringify(input)}`;
  return requestStructuredCompletion({
    model,
    messages: [
      { role: "user", content: prompt }
    ],
    schemaDef: TRANSLATION_SCHEMA
  });
}

function buildOrderedResults(items, rows) {
  const expectedOrder = items.map(it => it.url);
  const byUrl = new Map();
  for (const row of rows || []) {
    if (row && row.url) {
      byUrl.set(row.url, row);
    }
  }
  const ordered = [];
  const missing = [];
  for (const url of expectedOrder) {
    const row = byUrl.get(url);
    if (row) {
      ordered.push(row);
    } else {
      missing.push(url);
    }
  }
  if (missing.length) {
    console.warn(`[openai] Missing results for ${missing.length} items: ${missing.slice(0, 5).join(", ")}...`);
  }
  return ordered;
}

export async function classifyItemsBatched(model, items, { batchSize, singleBatchFn } = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    return { items: [] };
  }
  const maxSize = MAX_CLASSIFICATION_BATCH_SIZE;
  const safeSize = clampBatchSize(batchSize, DEFAULT_CLASSIFICATION_BATCH_SIZE, maxSize);
  const handler = typeof singleBatchFn === "function" ? singleBatchFn : classifyItems;
  const merged = [];
  for (const chunk of chunkArray(items, safeSize)) {
    const result = await handler(model, chunk);
    if (result?.items) {
      merged.push(...result.items);
    }
  }
  return { items: buildOrderedResults(items, merged) };
}

export async function translateItemsBatched(model, items, { batchSize, singleBatchFn } = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    return { translations: [] };
  }
  const maxSize = MAX_TRANSLATION_BATCH_SIZE;
  const safeSize = clampBatchSize(batchSize, DEFAULT_TRANSLATION_BATCH_SIZE, maxSize);
  const handler = typeof singleBatchFn === "function" ? singleBatchFn : translateItems;
  const merged = [];
  for (const chunk of chunkArray(items, safeSize)) {
    const result = await handler(model, chunk);
    if (result?.translations) {
      merged.push(...result.translations);
    }
  }
  return { translations: buildOrderedResults(items, merged) };
}

export async function summarizeCategory(model, dateISO, category, items) {
  const systemPrompt = "You are compiling a diplomatic morning brief. Compare narratives across outlets; highlight policy signals, euphemisms, and divergences. Neutral tone.";
  const input = {
    date: dateISO,
    category,
    items: items.map(i => ({
      source: i.source_name,
      title_zh: i.title_zh,
      title_en: i.title_en || "",
      url: i.url
    }))
  };
  const prompt = `Respond strictly in JSON matching the schema.\n\n${JSON.stringify(input)}`;
  return requestStructuredCompletion({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt }
    ],
    schemaDef: SUMMARY_SCHEMA
  });
}

export function hashStable(s) {
  return crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);
}
