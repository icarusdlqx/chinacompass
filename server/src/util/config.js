export const config = {
  PORT: Number(process.env.PORT || 8000),
  TZ: process.env.TZ || "Asia/Shanghai",
  DB_FILE: process.env.DB_FILE || "./data/app.db",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-5-chat-latest",
  USE_EMBEDDINGS: String(process.env.USE_EMBEDDINGS || "false") === "true",
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || "text-embedding-3-large",
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || ""
};
