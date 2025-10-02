import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./util/config.js";
import { db } from "./util/db.js";
import { runFullScan } from "./scan/runFullScan.js";
import { getLatestScan, getLatestScanStatus, getScanById, listScans } from "./scan/queries.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// --- API ---
app.post("/api/scan", async (req, res) => {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/, "");
  if (!config.ADMIN_TOKEN || token !== config.ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const manual = String(req.query.manual ?? "1") === "1";
    const scan = await runFullScan({ manual });
    res.json({ ok: true, scan_id: scan.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Scan failed", detail: String(err) });
  }
});

app.get("/api/today", async (_req, res) => {
  const scan = getLatestScan();
  if (!scan) return res.status(404).json({ error: "No scans yet" });
  res.json(scan);
});

app.get("/api/status", async (_req, res) => {
  const status = getLatestScanStatus();
  if (!status) return res.status(404).json({ error: "No scans yet" });
  res.json(status);
});

app.get("/api/scans", async (req, res) => {
  const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 30));
  res.json(listScans(limit));
});

app.get("/api/scans/:id", async (req, res) => {
  const scan = getScanById(req.params.id);
  if (!scan) return res.status(404).json({ error: "Not found" });
  res.json(scan);
});

// --- Static web build (optional) ---
const webDist = path.resolve(__dirname, "../web-dist");
const indexPath = path.join(webDist, "index.html");

// Only serve static files if the build exists (production mode)
if (fs.existsSync(indexPath)) {
  app.use("/", express.static(webDist));
  
  // Catch-all route for SPA - serve index.html for all non-API routes
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(indexPath);
  });
}

// API 404 handler for unmatched API routes
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

const port = Number(process.env.PORT || 8000);
app.listen(port, "0.0.0.0", () => {
  console.log(`[server] listening on http://0.0.0.0:${port}`);
  db.pragma("journal_mode = WAL");
});
