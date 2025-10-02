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
    if ("confidence" in item) {
      if (typeof item.confidence !== "number" || Number.isNaN(item.confidence) || item.confidence < 0 || item.confidence > 1) {
        throw new Error(`[openai] Classification item #${idx} confidence must be a number between 0 and 1.`);
      }
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
    if ("dek_en" in item && typeof item.dek_en !== "string") {
      throw new Error(`[openai] Translation item #${idx} dek_en must be a string when provided.`);
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
    if (field in data && !Array.isArray(data[field])) {
      throw new Error(`[openai] Summary field ${field} must be an array when provided.`);
    }
    if (Array.isArray(data[field])) {
      data[field].forEach((entry, idx) => {
        if (!isNonEmptyString(entry)) {
          throw new Error(`[openai] Summary field ${field} entry #${idx} must be a non-empty string.`);
        }
      });
    }
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
          required: ["url","title_en"]
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
  const input = {
    task: "Translate the Chinese headlines to English concisely. Preserve named entities, institutions, policy terms; do not anglicize official names (e.g., keep 'NDRC', 'CCP', 'PLA'). Provide plain text. If a subtitle/dek is present, translate it too.",
    items: items.map(i => ({ url: i.url, title_zh: i.title_zh, dek_zh: i.dek_zh || "" }))
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
