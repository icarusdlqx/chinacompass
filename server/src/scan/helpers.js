import { hashStable } from "../ai/openai.js";

export function normalizeTitle(t) {
  return (t || "").replace(/[\s\u3000]+/g, " ").replace(/[\[\]【】]/g, "").trim();
}

export function articleIdFrom(url, title) {
  return hashStable(url + "|" + normalizeTitle(title || ""));
}

export function groupBy(arr, keyFn) {
  const map = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}

export const CATEGORY_ORDER = ["international","domestic_politics","business","society","technology","military","science","opinion"];
