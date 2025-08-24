MCP server must provide

Project I/O (editor-grade)

Read/write files with range-aware edits (avoid clobbering the buffer).

List/search the workspace (glob + content grep).

Create/rename/delete files & folders.

Provide diagnostics (errors/warnings with ranges) and formatting for DSL & node code.

Generate diffs/patches (unified diff) so Claude can propose safe changes.

Language services for your DSL

Parse/validate → structured errors (line/col, rule, suggestion).

Compile DSL → plan.json (DAG + schemas) without side effects.

Hover/Completion/Signature help data Claude can use to propose code.

Formatter (idempotent pretty-printer) to keep PRs clean.

Node lifecycle

Scaffold node (Python/JS/WASM) with correct manifest and test stub.

Unit-test node in Docker; stream logs.

Build (e.g., compile WASM) and lint (py/js).

Pipeline execution

Run backtest (dry-run + real) from DSL or planId; stream status/logs.

Train models; return artifact ids, metrics.

Get artifacts (equity.csv, trades.csv, model files) via signed URLs or bytes.

Editor context bridge

Get/set cursor & selection, current file path, and visible diagnostics.

Post inline suggestions / code actions (e.g., “apply quick fix”).

Post notifications/toasts (success/error) and open diff panels.

Safety & governance

Project root allowlist, transactional edits, locks.

Rate limits, idempotency keys, dry-run modes.

Per-project auth scopes (no raw FS escapes).

Tools (imperative) your MCP should expose
Tool	Purpose	Input (JSON Schema shape)	Output
fs.list	List files	{ "root": "string", "glob?": "string" }	{ files: [{path, size}] }
fs.read	Read file	{ "path": "string", "range?": {start:number,end:number} }	{ "content": "string" }
fs.write	Write/replace	{ "path": "string", "content": "string", "createIfMissing?": true }	{ "ok": true }
fs.patch	Apply unified diff	{ "path": "string", "diff": "string" }	{ "ok": true, "appliedHunks": number }
fs.search	Grep workspace	{ "query": "string", "glob?": "string", "maxResults?": number }	{ "matches":[{path, line, col, preview}] }
dsl.validate	DSL parse/typecheck	{ "text": "string" }	{ "ok": boolean, "diagnostics": [Diag] }
dsl.compile	DSL → plan.json	{ "text": "string" }	{ "planId": "string", "plan": {...}, "diagnostics":[Diag] }
dsl.format	Pretty print	{ "text": "string" }	{ "text": "string" }
node.scaffold	New node skeleton	`{ "lang": "python	js
node.test	Run unit tests	{ "path":"string" }	{ "ok": boolean, "report": {...}, "logsUrl?": "string" }
node.build	Build node (WASM/JS)	{ "path":"string" }	{ "ok": boolean, "artifactPath": "string" }
pipeline.run_backtest	Execute backtest	{ "dsl?":"string","planId?":"string","dataset":"string","costs?":{...} }	{ "runId":"string" }
pipeline.train	Train models	{ "dsl?":"string","planId?":"string","nodes":["id"],"hparams?":{...} }	{ "artifacts":[{id,path,kind}], "metrics": {...} }
runs.status	Poll status	{ "runId":"string" }	`{ "state":"queued
runs.logs	Stream logs	{ "runId":"string","fromOffset?": number }	{ "entries":[{offset, ts, level, msg}] }
artifacts.get	Download artifact	{ "id":"string" }	`{ "name":"string", "mime":"string", "bytes
editor.get_state	Cursor & selection	{}	{ "path":"string","selection":{start,end}}
editor.apply_edits	Atomic multi-edit	{ "edits":[{path, range?, newText}] }	{ "ok": true }
editor.show_diagnostics	Push errors	{ "path":"string","diagnostics":[Diag] }	{ "ok": true }

Diag shape example:

{ "range": {"start":{"line":12,"col":5},"end":{"line":12,"col":18}},
  "severity":"error|warning|info",
  "code":"DSL001",
  "message":"Unknown node type 'TRAINN'.",
  "suggest":"Did you mean 'TRAIN'?" }

Resources (read-only URIs)

workspace://tree → JSON of file tree for quick nav.

dsl://grammar → DSL tokens/keywords and snippets.

plan://{planId} → compiled plan with node graph + schemas.

run://{runId}/metrics.json → Sharpe, MDD, return, turnover.

run://{runId}/equity.csv, run://{runId}/trades.csv

artifact://{id}/meta.json

These let Claude “browse” the project & outputs without extra tool calls.

Prompts (starter templates)

new-pipeline (args: symbol, tf, horizon) → emits a scaffold DSL.

add-node (args: lang, kind, name) → creates code + manifest + test, returns file paths.

fix-dsl-errors (args: dslText, diagnostics[]) → returns patched DSL.

triage-run (args: runId) → fetch metrics/logs and propose changes.

Minimal TypeScript server sketch (MCP SDK)
import { createServer } from "@modelcontextprotocol/sdk";
const mcp = createServer({ name: "ml-pipelines", version: "0.1.0" });

// Files
mcp.tool("fs.read", { input: { path: "string" } }, async ({ path }) => {
  const content = await safeRead(path);
  return { content };
});
mcp.tool("fs.patch", { input: { path: "string", diff: "string" } }, async (i) => {
  const res = await applyUnifiedDiff(i.path, i.diff);
  return { ok: res.ok, appliedHunks: res.applied };
});

// DSL
mcp.tool("dsl.validate", { input: { text: "string" } }, async ({ text }) => {
  const diags = validateDsl(text); // returns Diag[]
  return { ok: diags.length === 0, diagnostics: diags };
});
mcp.tool("dsl.compile", { input: { text: "string" } }, async ({ text }) => {
  const { planId, plan, diagnostics } = compile(text);
  return { planId, plan, diagnostics };
});
mcp.tool("dsl.format", { input: { text: "string" } }, async ({ text }) => {
  return { text: formatDsl(text) };
});

// Pipeline runs
mcp.tool("pipeline.run_backtest", { input: { dsl: "string", dataset: "string" } },
  async ({ dsl, dataset }) => {
    const plan = compile(dsl).plan;
    const runId = await executor.startBacktest(plan, dataset); // launches Docker jobs
    return { runId };
  });

mcp.tool("runs.status", { input: { runId: "string" } },
  async ({ runId }) => executor.getStatus(runId));

// Resources
mcp.resource("run://:runId/metrics.json",
  async ({ runId }) => executor.getMetrics(runId));

mcp.listen();


(Your real server will enforce auth, scopes, rate limits, and translate to your existing compiler/executor.)

How the Monaco-side chatbot uses this

Typical loop for “fix my DSL and run”:

Call editor.get_state → get file & selection.

Call fs.read for the current DSL file (or use selection text).

Call dsl.validate; if errors, propose fixes.

Call dsl.format on the edited text.

Apply with fs.patch (unified diff) or editor.apply_edits.

Call dsl.compile → show diagnostics via editor.show_diagnostics.

If OK, call pipeline.run_backtest → get runId.

Poll runs.status, stream runs.logs.

Fetch run://{runId}/metrics.json & …/equity.csv; render a quick viewer panel.

Offer code actions: “lower threshold to 0.58 and rerun”, which repeats 3–9.

For custom nodes:

node.scaffold to create boilerplate in /nodes/python/….

Open file with fs.read, insert model code.

node.test (Docker); show results; then wire into DSL (edit + validate).

Input/Output contracts worth nailing

DSL diagnostics: structured with ranges & suggested fixes.

Plan schema: node list, edges, IO schemas, resource hints (so Claude can reason about types/compatibility).

Run logs: incremental offsets; stable ordering; cap sizes; redact secrets.

Artifacts: signed URLs with expiry or bytes; predictable names.

Safety & governance

Workspace allowlist (e.g., /apps/web, /services/*, /nodes/*, /pipelines/*).

Transactional edits: reject if file changed since baseSha (include optional etag in fs.patch).

Dry-run flags for anything that could be expensive.

Rate limits per user/project; backoff with retry_after.

Idempotency keys on run/train tools to avoid duplicate jobs.

MVP surface (what to build first)

fs.read, fs.patch, fs.search

dsl.validate, dsl.compile, dsl.format

pipeline.run_backtest, runs.status, runs.logs

Resources: run://…/metrics.json, …/equity.csv

Prompts: new-pipeline, fix-dsl-errors