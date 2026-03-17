# Plugin Ecosystem Alignment — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the Flowti Plugin with the CLI ecosystem — fix domain purity violations, remove post-migration dead code, create a CLI-compatible ProjectConfig, generate CLI-parseable health reports, and decompose two oversized domain services.

**Architecture:** The Plugin (`Development/flowti/`) is an Obsidian plugin with its own domain layer, EventBus, and 32 services. The CLI (`01 - Projects/Flowti CLI/`) manages projects via `ProjectConfig` declarations and collects health from frontmatter-based reports. This plan bridges the two: the Plugin gets a CLI-compatible config, its reports become CLI-parseable, and two domain purity violations are fixed.

**Tech Stack:** TypeScript (strict), Vitest (happy-dom), Obsidian Plugin API, Lit 3.x, EventBus

**Prerequisite:** Merge the `feat/iter-5/plugin-sitemap-migration` branch before starting. All tasks assume the sitemap migration is on `master`.

**All Plugin file paths relative to:** `Development/flowti/`

**Test command:** `cd "Development/flowti" && npx vitest run`

**Type check:** `cd "Development/flowti" && npx tsc --noEmit -skipLibCheck`

---

## Chunk 1: Infrastructure Abstraction — Fix Domain Purity Violations

Two domain files import Obsidian runtime functions directly, violating domain purity. Fix both by introducing injectable interfaces.

### Task 1.1: Create IYamlParser interface

**Files:**
- Create: `src/infrastructure/parsers/types.ts`

- [ ] **Step 1: Create the interface file**

```typescript
/** Injectable YAML parser — abstracts Obsidian's parseYaml(). */
export interface IYamlParser {
	parse(content: string): Record<string, unknown> | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/infrastructure/parsers/types.ts
git commit -m "feat(infra): add IYamlParser interface for domain injection"
```

---

### Task 1.2: Inject IYamlParser into BaseQueryEngine

**Files:**
- Modify: `src/domain/dataExchange/BaseQueryEngine.ts`
- Modify: `src/domain/dataExchange/ExportService.ts` (instantiates BaseQueryEngine)
- Modify: `src/infrastructure/services/registry.ts` (wires ExportService)
- Test: `tests/domain/dataExchange/BaseQueryEngine.test.ts`

- [ ] **Step 1: Write test for IYamlParser injection**

Find the existing `BaseQueryEngine.test.ts`. Add a test that confirms the engine uses the injected parser:

```typescript
import type { IYamlParser } from "../../../src/infrastructure/parsers/types";

describe("BaseQueryEngine with injected parser", () => {
	it("uses injected IYamlParser instead of obsidian", () => {
		const mockParser: IYamlParser = {
			parse: vi.fn().mockReturnValue({ views: [] }),
		};
		const engine = new BaseQueryEngine(mockParser);
		engine.parseBaseFile("test: true");
		expect(mockParser.parse).toHaveBeenCalledWith("test: true");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domain/dataExchange/BaseQueryEngine.test.ts`
Expected: FAIL — BaseQueryEngine constructor doesn't accept parser parameter yet.

- [ ] **Step 3: Modify BaseQueryEngine to accept IYamlParser**

In `src/domain/dataExchange/BaseQueryEngine.ts`:

1. Remove: `import { parseYaml } from "obsidian";`
2. Add: `import type { IYamlParser } from "../../infrastructure/parsers/types";`
3. Add constructor:
```typescript
export class BaseQueryEngine {
	private readonly parser: IYamlParser;

	constructor(parser: IYamlParser) {
		this.parser = parser;
	}
```
4. Replace line 46: `const raw = parseYaml(yamlContent)` → `const raw = this.parser.parse(yamlContent)`

- [ ] **Step 4: Update ExportService to pass parser to BaseQueryEngine**

In `src/domain/dataExchange/ExportService.ts`:

1. Add `yamlParser: IYamlParser` to the `ExportServiceDeps` interface
2. Change line ~62: `this.baseEngine = new BaseQueryEngine();` → `this.baseEngine = new BaseQueryEngine(deps.yamlParser);`

- [ ] **Step 5: Update service registry to provide IYamlParser**

In `src/infrastructure/services/registry.ts`, find where ExportService is created and add:

```typescript
import { parseYaml } from "obsidian";
// ...
yamlParser: { parse: (content: string) => parseYaml(content) as Record<string, unknown> | null },
```

This keeps the `obsidian` import in infrastructure (where it belongs) and injects a conforming object into the domain.

- [ ] **Step 6: Update existing BaseQueryEngine tests**

Existing tests that call `new BaseQueryEngine()` must now pass a parser. Add a test helper:

```typescript
function makeParser(): IYamlParser {
	return {
		parse: (content: string) => {
			// Simple YAML-like parser for tests (or use a real one from devDeps)
			try { return JSON.parse(content); } catch { return null; }
		},
	};
}
```

Or import `parseYaml` from `obsidian` in the test (since tests mock obsidian via `tests/mocks/obsidian-stub.ts`). Check what the stub provides and use that.

- [ ] **Step 7: Run tests and type check**

```bash
npx vitest run tests/domain/dataExchange/
npx tsc --noEmit -skipLibCheck
```

Expected: all pass, 0 type errors.

- [ ] **Step 8: Commit**

```bash
git add src/domain/dataExchange/BaseQueryEngine.ts src/domain/dataExchange/ExportService.ts src/infrastructure/parsers/types.ts src/infrastructure/services/registry.ts tests/domain/dataExchange/BaseQueryEngine.test.ts
git commit -m "refactor(domain): inject IYamlParser into BaseQueryEngine, remove obsidian import"
```

---

### Task 1.3: Create IHttpClient interface

**Files:**
- Create: `src/infrastructure/http/types.ts`

- [ ] **Step 1: Create the interface file**

```typescript
/** Injectable HTTP client — abstracts Obsidian's requestUrl(). */
export interface IHttpClient {
	request(options: HttpRequestOptions): Promise<HttpResponse>;
}

export interface HttpRequestOptions {
	url: string;
	method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
	headers?: Record<string, string>;
	body?: string;
}

export interface HttpResponse {
	json: unknown;
	status: number;
	headers: Record<string, string>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/infrastructure/http/types.ts
git commit -m "feat(infra): add IHttpClient interface for domain injection"
```

---

### Task 1.4: Inject IHttpClient into AzureDevOpsAdapter

**Files:**
- Modify: `src/domain/signal/adapters/AzureDevOpsAdapter.ts`
- Modify: `src/infrastructure/services/registry.ts` (wires adapter)
- Test: `tests/domain/signal/AzureDevOpsAdapter.test.ts`

- [ ] **Step 1: Write test for IHttpClient injection**

```typescript
import type { IHttpClient } from "../../../src/infrastructure/http/types";

describe("AzureDevOpsAdapter with injected http", () => {
	it("uses injected IHttpClient for API requests", async () => {
		const mockHttp: IHttpClient = {
			request: vi.fn().mockResolvedValue({
				json: { value: [{ id: 1 }] },
				status: 200,
				headers: {},
			}),
		};
		const adapter = new AzureDevOpsAdapter({ http: mockHttp });
		const result = await adapter.testConnection({
			id: "test", name: "Test", type: "azure-devops",
			organizationUrl: "https://dev.azure.com/org",
			project: "proj", pat: "token", query: "",
		});
		expect(result.success).toBe(true);
		expect(mockHttp.request).toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domain/signal/AzureDevOpsAdapter.test.ts`
Expected: FAIL — AzureDevOpsAdapterOptions doesn't have `http` field yet.

- [ ] **Step 3: Modify AzureDevOpsAdapter to accept IHttpClient**

In `src/domain/signal/adapters/AzureDevOpsAdapter.ts`:

1. Remove: `import { requestUrl } from "obsidian";`
2. Add: `import type { IHttpClient } from "../../../infrastructure/http/types";`
3. Extend `AzureDevOpsAdapterOptions`:
```typescript
export interface AzureDevOpsAdapterOptions {
	delay?: DelayFn;
	http: IHttpClient;
}
```
4. Add to class:
```typescript
private readonly http: IHttpClient;

constructor(options: AzureDevOpsAdapterOptions) {
	this.delay = options.delay ?? defaultDelay;
	this.http = options.http;
}
```
5. Replace `requestUrl({...})` call in `apiRequestWithRetry()`:
```typescript
const response = await this.http.request({
	url,
	method: body ? "POST" : "GET",
	headers: this.buildAuthHeaders(config.pat),
	body: body ? JSON.stringify(body) : undefined,
});
```

- [ ] **Step 4: Update service registry to provide IHttpClient**

In `src/infrastructure/services/registry.ts`:

```typescript
import { requestUrl } from "obsidian";
// ...
adapter: new AzureDevOpsAdapter({
	http: {
		request: async (opts) => {
			const response = await requestUrl(opts);
			return { json: response.json, status: response.status, headers: response.headers };
		},
	},
}),
```

- [ ] **Step 5: Update existing adapter tests**

All tests that create `new AzureDevOpsAdapter()` must now pass `{ http: mockHttp }`. Update each test's setup to inject a mock `IHttpClient`.

- [ ] **Step 6: Run tests and type check**

```bash
npx vitest run tests/domain/signal/
npx tsc --noEmit -skipLibCheck
```

- [ ] **Step 7: Commit**

```bash
git add src/domain/signal/adapters/AzureDevOpsAdapter.ts src/infrastructure/http/types.ts src/infrastructure/services/registry.ts tests/domain/signal/
git commit -m "refactor(domain): inject IHttpClient into AzureDevOpsAdapter, remove obsidian import"
```

---

### Task 1.5: Verify zero Obsidian runtime imports in domain/

- [ ] **Step 1: Scan for remaining obsidian imports**

```bash
cd "Development/flowti" && grep -rn "from \"obsidian\"" src/domain/ | grep -v "type " | grep -v "// type-only"
```

Expected: 0 results (all remaining imports should be `import type` for canvas types).

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass, 0 failures.

- [ ] **Step 3: Commit (if any cleanup needed)**

---

## ~~Chunk 2: Dead Code Removal~~ — REMOVED

> **Correction:** The original assessment that `createViewDefinitions()` returns `[]` was incorrect. It actually returns 3 active view definitions (ComponentShowcaseView, EventCatalogView, EventLogView), and `registerViews()` is called from `main.ts` line 216 during plugin onload. This is **live code** — do not remove it.

---

## Chunk 3: CLI ProjectConfig for Plugin

Create a CLI-compatible `configs/flowti.config.json` so the CLI can manage the Plugin as a project. The Plugin already has a custom `flowti.config.json` at root — keep that for plugin-specific build tooling. The new file at `configs/flowti.config.json` follows the CLI's `ProjectConfig` schema.

### Task 3.1: Create ProjectConfig-compatible config

**Files:**
- Create: `Development/flowti/configs/flowti.config.json` (overwrite if stale version exists)

- [ ] **Step 1: Write the config**

```json
{
	"name": "Flowti Plugin",
	"type": "obsidian-plugin",
	"build": {
		"commands": {
			"fast": "npm run build:dev",
			"full": "npm run build",
			"watch": "npm run build:dev"
		}
	},
	"test": {
		"commands": {
			"unit": "npx vitest run",
			"flows": "npx vitest run tests/flows/"
		}
	},
	"devtools": {
		"commands": {
			"lint": "npx eslint src/",
			"check": "npx tsc --noEmit -skipLibCheck"
		},
		"thresholds": {
			"maxComplexity": 15,
			"maxLines": 400
		}
	},
	"reports": {
		"dir": "docs/reports"
	},
	"health": {
		"thresholds": {
			"coverage": { "min": 75, "target": 85 },
			"lint": { "maxErrors": 0, "maxWarnings": 10 },
			"tests": { "minPassed": 7000 }
		}
	}
}
```

- [ ] **Step 2: Verify CLI can parse it**

From the git root, run:

```bash
cd "01 - Projects/Flowti CLI" && node -e "
const fs = require('fs');
const cfg = JSON.parse(fs.readFileSync('../../Development/flowti/configs/flowti.config.json', 'utf8'));
console.log('Name:', cfg.name);
console.log('Type:', cfg.type);
console.log('Build commands:', Object.keys(cfg.build.commands));
console.log('Health thresholds:', JSON.stringify(cfg.health.thresholds));
"
```

Expected: Prints config fields without errors.

- [ ] **Step 3: Commit**

```bash
git add Development/flowti/configs/flowti.config.json
git commit -m "feat(plugin): add CLI-compatible ProjectConfig at configs/flowti.config.json"
```

---

### Task 3.2: Register Plugin as a discoverable project

**Files:**
- Modify: `.flowti/config.json` (vault-level config)

The CLI discovers projects from `projectsFolder` (default `01 - Projects`). The Plugin lives at `Development/flowti/` — outside the projects folder. Two options:

**Option A (recommended):** Add a symlink or project entry for the Plugin under `01 - Projects/`.
**Option B:** Extend the subsystem config to include a `projectConfig` path.

- [ ] **Step 1: Create a project pointer**

Create `01 - Projects/Flowti Plugin/` directory with a minimal marker, or update `.flowti/config.json` to add a `managedProjects` array:

```json
{
	"subsystems": {
		"plugin": {
			"root": "Development/flowti",
			"config": "configs/flowti.config.json"
		}
	}
}
```

The CLI's `project-config.ts` reads `configs/flowti.config.json` from the project root. So pointing at `Development/flowti/` with `config: "configs/flowti.config.json"` tells the CLI where to find the ProjectConfig.

- [ ] **Step 2: Verify CLI project listing includes Plugin**

```bash
cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs && .flowti/bin/main.js info --project="Flowti Plugin" --format=json 2>/dev/null || echo "Not yet discoverable — subsystem path not wired"
```

If the CLI doesn't yet support subsystem project discovery, note this as a follow-up CLI enhancement task and skip to Chunk 4. The config file itself is still valuable for future integration.

- [ ] **Step 3: Commit**

```bash
git add .flowti/config.json
git commit -m "chore: update subsystem config with ProjectConfig path for Plugin"
```

---

## Chunk 4: Report Format Alignment — CLI-Parseable Health Reports

The CLI's health system reads frontmatter from markdown report files. Create scripts that generate CLI-compatible reports for the Plugin.

### Task 4.1: Create test report generator script

**Files:**
- Create: `Development/flowti/scripts/generate-test-report.mjs`

The CLI reads `reports/Test Report.md` with frontmatter fields: `total`, `passed`, `failed`, `suites`.

- [ ] **Step 1: Write the generator script**

```javascript
#!/usr/bin/env node
/**
 * Generates a CLI-compatible Test Report from vitest JSON output.
 * Reads: docs/reports/tests/testreport.json (vitest --reporter=json output)
 * Writes: docs/reports/Test Report.md (CLI health-compatible frontmatter)
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname.slice(1)), "..");
const INPUT = resolve(ROOT, "docs/reports/tests/testreport.json");
const OUTPUT = resolve(ROOT, "docs/reports/Test Report.md");

try {
	const raw = JSON.parse(readFileSync(INPUT, "utf-8"));
	const suites = raw.numTotalTestSuites ?? raw.testResults?.length ?? 0;
	const total = raw.numTotalTests ?? 0;
	const passed = raw.numPassedTests ?? 0;
	const failed = raw.numFailedTests ?? 0;
	const duration = raw.startTime && raw.testResults
		? Math.max(...raw.testResults.map(r => r.endTime ?? 0)) - raw.startTime
		: 0;

	const md = `---
type: TestReport
project: Flowti Plugin
date: ${new Date().toISOString()}
total: ${total}
passed: ${passed}
failed: ${failed}
suites: ${suites}
duration_ms: ${duration}
success: ${failed === 0}
---

# Test Report — Flowti Plugin

| Metric | Value |
|--------|-------|
| Total Tests | ${total} |
| Passed | ${passed} |
| Failed | ${failed} |
| Suites | ${suites} |
| Duration | ${duration}ms |
| Success | ${failed === 0} |
`;

	mkdirSync(dirname(OUTPUT), { recursive: true });
	writeFileSync(OUTPUT, md);
	console.log(`Test Report written: ${total} tests (${passed} passed, ${failed} failed)`);
} catch (err) {
	console.error("Failed to generate test report:", err.message);
	process.exit(1);
}
```

- [ ] **Step 2: Run vitest with JSON reporter, then generate report**

```bash
cd "Development/flowti" && npx vitest run --reporter=json --outputFile=docs/reports/tests/testreport.json 2>/dev/null
node scripts/generate-test-report.mjs
cat "docs/reports/Test Report.md" | head -15
```

Expected: Frontmatter with `total`, `passed`, `failed`, `suites` fields.

- [ ] **Step 3: Commit**

```bash
git add Development/flowti/scripts/generate-test-report.mjs
git commit -m "feat(plugin): add CLI-compatible test report generator"
```

---

### Task 4.2: Create coverage report generator script

**Files:**
- Create: `Development/flowti/scripts/generate-coverage-report.mjs`

The CLI reads `reports/Coverage Report.md` with frontmatter fields: `lines_pct`, `branches_pct`, `functions_pct`.

- [ ] **Step 1: Write the generator script**

```javascript
#!/usr/bin/env node
/**
 * Generates a CLI-compatible Coverage Report from v8 coverage output.
 * Reads: docs/reports/coverage/coverage-summary.json
 * Writes: docs/reports/Coverage Report.md
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname.slice(1)), "..");
const INPUT = resolve(ROOT, "docs/reports/coverage/coverage-summary.json");
const OUTPUT = resolve(ROOT, "docs/reports/Coverage Report.md");

try {
	const raw = JSON.parse(readFileSync(INPUT, "utf-8"));
	const totals = raw.total ?? {};
	const lines = totals.lines?.pct ?? 0;
	const branches = totals.branches?.pct ?? 0;
	const functions = totals.functions?.pct ?? 0;
	const statements = totals.statements?.pct ?? 0;

	const md = `---
type: CoverageReport
project: Flowti Plugin
date: ${new Date().toISOString()}
lines_pct: ${lines}
branches_pct: ${branches}
functions_pct: ${functions}
statements_pct: ${statements}
---

# Coverage Report — Flowti Plugin

| Metric | Coverage |
|--------|----------|
| Lines | ${lines}% |
| Branches | ${branches}% |
| Functions | ${functions}% |
| Statements | ${statements}% |
`;

	mkdirSync(dirname(OUTPUT), { recursive: true });
	writeFileSync(OUTPUT, md);
	console.log(`Coverage Report written: ${lines}% lines, ${branches}% branches, ${functions}% functions`);
} catch (err) {
	console.error("Failed to generate coverage report:", err.message);
	process.exit(1);
}
```

- [ ] **Step 2: Run coverage and generate report**

```bash
cd "Development/flowti" && npx vitest run --coverage --reporter=json 2>/dev/null
node scripts/generate-coverage-report.mjs
cat "docs/reports/Coverage Report.md" | head -12
```

- [ ] **Step 3: Commit**

```bash
git add Development/flowti/scripts/generate-coverage-report.mjs
git commit -m "feat(plugin): add CLI-compatible coverage report generator"
```

---

### Task 4.3: Add npm script to generate all CLI reports

**Files:**
- Modify: `Development/flowti/package.json`

- [ ] **Step 1: Add reports:cli script**

Add to `scripts` in `package.json`:

```json
"reports:cli": "npx vitest run --reporter=json --outputFile=docs/reports/tests/testreport.json && node scripts/generate-test-report.mjs && node scripts/generate-coverage-report.mjs"
```

- [ ] **Step 2: Verify it works end-to-end**

```bash
cd "Development/flowti" && npm run reports:cli
```

Expected: Both `Test Report.md` and `Coverage Report.md` generated in `docs/reports/`.

- [ ] **Step 3: Commit**

```bash
git add Development/flowti/package.json
git commit -m "feat(plugin): add reports:cli npm script for CLI-compatible report generation"
```

---

## Chunk 5: TrainService Handler Extraction

`TrainService.ts` is 912 lines with 25+ EventBus emit/on calls. Follow the pattern already established by `SessionService` — extract event subscription setup into a `handlers/` folder.

### Task 5.1: Create TrainEventHandlers module

**Files:**
- Create: `src/domain/train/handlers/train-event-handlers.ts`
- Modify: `src/domain/train/TrainService.ts`
- Test: `tests/domain/train/handlers/train-event-handlers.test.ts`

- [ ] **Step 1: Identify event subscriptions in TrainService constructor**

TrainService subscribes to 3 events in its constructor (lines 78-124):
- `session.completed` → completes the linked train
- `session.resumed` → resumes the linked train
- `session.paused` → pauses the linked train

These are the extraction targets.

- [ ] **Step 2: Create the handler context interface**

```typescript
// src/domain/train/handlers/train-event-handlers.ts
import type { IEventBus } from "../../../infrastructure/events/types";
import type { TrainState } from "../types";

export interface TrainHandlerContext {
	getTrains: () => TrainState[];
	getTrainBySessionId: (sessionId: string) => TrainState | undefined;
	updateTrain: (trainId: string, update: Partial<TrainState>) => void;
	persist: () => Promise<void>;
	eventBus: IEventBus;
}

/** Wire session lifecycle events to train state transitions. */
export function registerTrainEventHandlers(ctx: TrainHandlerContext): (() => void)[] {
	const unsubs: (() => void)[] = [];

	unsubs.push(ctx.eventBus.on("session.completed", (event) => {
		const train = ctx.getTrainBySessionId(event.payload.sessionId);
		if (!train || train.status === "completed") return;
		ctx.updateTrain(train.id, { status: "completed", completedAt: Date.now() });
		void ctx.persist();
		void ctx.eventBus.emit("train.completed", {
			trainId: train.id,
			thoughtCount: train.thoughts.length,
		});
	}));

	unsubs.push(ctx.eventBus.on("session.resumed", (event) => {
		const train = ctx.getTrainBySessionId(event.payload.sessionId);
		if (!train || train.status !== "paused") return;
		ctx.updateTrain(train.id, { status: "active" });
		void ctx.persist();
		void ctx.eventBus.emit("train.resumed", { trainId: train.id });
	}));

	unsubs.push(ctx.eventBus.on("session.paused", (event) => {
		const train = ctx.getTrainBySessionId(event.payload.sessionId);
		if (!train || train.status !== "active") return;
		ctx.updateTrain(train.id, { status: "paused" });
		void ctx.persist();
		void ctx.eventBus.emit("train.paused", { trainId: train.id });
	}));

	return unsubs;
}
```

- [ ] **Step 3: Write tests for extracted handlers**

```typescript
// tests/domain/train/handlers/train-event-handlers.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerTrainEventHandlers } from "../../../../src/domain/train/handlers/train-event-handlers";
import { EventBus } from "../../../../src/infrastructure/events/EventBus";

describe("registerTrainEventHandlers", () => {
	let eventBus: EventBus;
	let ctx: Parameters<typeof registerTrainEventHandlers>[0];
	let trains: { id: string; sessionId: string; status: string; thoughts: unknown[] }[];

	beforeEach(() => {
		eventBus = new EventBus();
		trains = [{ id: "t1", sessionId: "s1", status: "active", thoughts: [1, 2] }];
		ctx = {
			getTrains: () => trains as never,
			getTrainBySessionId: (sid) => trains.find(t => t.sessionId === sid) as never,
			updateTrain: vi.fn((id, update) => {
				const t = trains.find(t => t.id === id);
				if (t) Object.assign(t, update);
			}),
			persist: vi.fn().mockResolvedValue(undefined),
			eventBus,
		};
	});

	it("completes train when session completes", async () => {
		registerTrainEventHandlers(ctx);
		await eventBus.emit("session.completed", { sessionId: "s1" } as never);
		expect(ctx.updateTrain).toHaveBeenCalledWith("t1", expect.objectContaining({ status: "completed" }));
		expect(ctx.persist).toHaveBeenCalled();
	});

	it("resumes train when session resumes", async () => {
		trains[0].status = "paused";
		registerTrainEventHandlers(ctx);
		await eventBus.emit("session.resumed", { sessionId: "s1" } as never);
		expect(ctx.updateTrain).toHaveBeenCalledWith("t1", expect.objectContaining({ status: "active" }));
	});

	it("pauses train when session pauses", async () => {
		registerTrainEventHandlers(ctx);
		await eventBus.emit("session.paused", { sessionId: "s1" } as never);
		expect(ctx.updateTrain).toHaveBeenCalledWith("t1", expect.objectContaining({ status: "paused" }));
	});

	it("ignores events for unknown sessions", async () => {
		registerTrainEventHandlers(ctx);
		await eventBus.emit("session.completed", { sessionId: "unknown" } as never);
		expect(ctx.updateTrain).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 4: Run handler tests**

```bash
npx vitest run tests/domain/train/handlers/
```

Expected: all pass.

- [ ] **Step 5: Update TrainService to delegate to handlers**

In `src/domain/train/TrainService.ts`:

1. Import: `import { registerTrainEventHandlers } from "./handlers/train-event-handlers";`
2. In constructor, replace the 3 `this.eventBus.on(...)` blocks (lines ~78-124) with:
```typescript
registerTrainEventHandlers({
	getTrains: () => this.state.trains,
	getTrainBySessionId: (sid) => this.state.trains.find(t => t.sessionId === sid),
	updateTrain: (id, update) => {
		const train = this.state.trains.find(t => t.id === id);
		if (train) Object.assign(train, update);
	},
	persist: () => this.persist(),
	eventBus: this.eventBus,
});
```

- [ ] **Step 6: Run full TrainService test suite**

```bash
npx vitest run tests/domain/train/
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/domain/train/handlers/ tests/domain/train/handlers/ src/domain/train/TrainService.ts
git commit -m "refactor(train): extract session event handlers into handlers/ module"
```

---

## Chunk 6: AnalyticsEngine Decomposition

`AnalyticsEngine.ts` is 989 lines with query execution, joins, filters, and aggregation all in one class. Extract the join logic into a separate module.

### Task 6.1: Extract JoinExecutor

**Files:**
- Create: `src/domain/analytics/JoinExecutor.ts`
- Modify: `src/domain/analytics/AnalyticsEngine.ts`
- Test: `tests/domain/analytics/JoinExecutor.test.ts`

- [ ] **Step 1: Identify join-related methods in AnalyticsEngine**

Read `AnalyticsEngine.ts` and identify all join-related methods. These typically handle:
- Joining two CSV datasets by a key column
- Left join, inner join semantics
- Column resolution across joined sources

- [ ] **Step 2: Extract into JoinExecutor class**

Create `src/domain/analytics/JoinExecutor.ts` with the join methods moved out of AnalyticsEngine. The JoinExecutor should be a pure class (no EventBus, no state) that takes data in and returns joined data.

```typescript
// src/domain/analytics/JoinExecutor.ts
import type { /* relevant types */ } from "./types";

export class JoinExecutor {
	// Move join-related methods here
}
```

- [ ] **Step 3: Write tests for JoinExecutor**

Create `tests/domain/analytics/JoinExecutor.test.ts` covering:
- Inner join on matching key
- Left join preserving unmatched rows
- Join with missing columns (graceful handling)
- Empty datasets

- [ ] **Step 4: Update AnalyticsEngine to delegate to JoinExecutor**

```typescript
import { JoinExecutor } from "./JoinExecutor";

export class AnalyticsEngine {
	private readonly joinExecutor = new JoinExecutor();
	// Replace inline join logic with this.joinExecutor.* calls
}
```

- [ ] **Step 5: Run analytics tests**

```bash
npx vitest run tests/domain/analytics/
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/domain/analytics/JoinExecutor.ts tests/domain/analytics/JoinExecutor.test.ts src/domain/analytics/AnalyticsEngine.ts
git commit -m "refactor(analytics): extract JoinExecutor from AnalyticsEngine"
```

---

## Final Validation

- [ ] **Run full Plugin test suite**

```bash
cd "Development/flowti" && npx vitest run
```

Expected: 7,800+ tests, 0 failures.

- [ ] **Run type check**

```bash
cd "Development/flowti" && npx tsc --noEmit -skipLibCheck
```

Expected: 0 source errors.

- [ ] **Run build**

```bash
cd "Development/flowti" && npm run build
```

Expected: build succeeds.

- [ ] **Verify no obsidian runtime imports in domain/**

```bash
cd "Development/flowti" && grep -rn "from \"obsidian\"" src/domain/ | grep -v "import type" | grep -v "obsidian/canvas"
```

Expected: 0 results.

- [ ] **Generate CLI-compatible reports**

```bash
cd "Development/flowti" && npm run reports:cli
```

Expected: `Test Report.md` and `Coverage Report.md` generated with frontmatter.
