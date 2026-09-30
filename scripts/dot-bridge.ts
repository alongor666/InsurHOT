// Delivers Dot batches waiting in an inbox directory to this service's POST /api/ingest/dot, once, and
// exits (docs/development/dot-d2-file-bridge.md). Run it by hand or from the operator's own scheduler.
//   DOT_INGEST_TOKEN=… node scripts/dot-bridge.ts --inbox <directory> [--endpoint https://host/api/ingest/dot]
// The token is read from the environment only and printed nowhere. Exit: 0 nothing left, 2 some wait
// for a retry, 3 some were refused for good, 1 configuration error.
import { parseArgs } from "node:util";
import { BridgeConfigError, exitCodeFor, runDotBridge } from "@aihot/backend/ingest/dot-bridge";

try {
  const { values } = parseArgs({ options: { inbox: { type: "string" }, endpoint: { type: "string" } }, strict: true });
  const summary = await runDotBridge({
    inbox: values.inbox ?? "",
    endpoint: values.endpoint ?? process.env.DOT_BRIDGE_ENDPOINT ?? "",
    token: process.env.DOT_INGEST_TOKEN ?? "",
  });
  console.log(JSON.stringify(summary));
  process.exitCode = exitCodeFor(summary);
} catch (error) {
  // An unknown option (a token on the command line included) ends here too.
  console.error(error instanceof BridgeConfigError ? `dot-bridge: ${error.message}` : `dot-bridge: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
