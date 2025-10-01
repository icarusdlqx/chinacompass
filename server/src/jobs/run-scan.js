import { runFullScan } from "../scan/runFullScan.js";

runFullScan({ manual: false }).then(() => {
  console.log("[scan] completed");
  process.exit(0);
}).catch((e) => {
  console.error("[scan] failed", e);
  process.exit(1);
});
