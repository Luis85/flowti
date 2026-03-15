# Vault Test Environment Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated, portable test environment that validates the compiled Flowti CLI binary independently from the development vault, using journey definitions as the universal test language and Vitest as the execution harness.

**Architecture:** A new `vault-test` EnvironmentProvider provisions ephemeral vault copies from a version-controlled template. Journey definitions (`.journey` JSON files) organized in 3 tiers (smoke, integration, ecosystem) are loaded by the existing journey executor and run through Vitest via tier runner `.test.ts` files. A `vault-test.controller.ts` exposes `flowti test:vault` for agent/CI consumption.

**Tech Stack:** TypeScript, Vitest (forks pool), existing journey executor/loader/provider infrastructure, esbuild (CLI binary), GitHub Actions

**Spec:** `docs/specs/2026-03-15-vault-test-environment-design.md`

---

## Chunk 1: Type System + Provider Foundation

### Task 0: Widen `variables` type from `Record<string, string>` to `Record<string, unknown>`

**Files:**
- Modify: `src/domain/e2e/journey/journey-types.ts:288` (variables field)

The vault-test tools need to store parsed JSON objects in `opts.variables` (e.g., `vault-cli` with `format: "json"`). The current type is `Record<string, string>` which rejects object values. This must be widened before implementing the tools.

- [ ] **Step 1: Change the `variables` type in JourneyExecutorOptions**

In `src/domain/e2e/journey/journey-types.ts`, find the `variables` field in `JourneyExecutorOptions` (around line 288) and change:

```typescript
// Before:
variables?: Record<string, string>;
// After:
variables?: Record<string, unknown>;
```

- [ ] **Step 2: Fix any type errors caused by the widening**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: May show errors where `variables[key]` is used as `string` without narrowing. Fix each with explicit `String(...)` or type narrowing.

- [ ] **Step 3: Run existing tests to verify no regressions**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/e2e/ --config configs/vitest.config.ts`
Expected: All existing e2e tests pass

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/e2e/journey/journey-types.ts"
git commit -m "refactor(e2e): widen variables type to Record<string, unknown> for JSON storage"
```

---

### Task 1: Add `vault-test` to ProjectTarget union

**Files:**
- Modify: `src/domain/e2e/journey/journey-types.ts:128-133`
- Modify: `tests/domain/e2e/journey/journey-types.test.ts` (if exists)

- [ ] **Step 1: Add `"vault-test"` to the ProjectTarget union**

In `src/domain/e2e/journey/journey-types.ts`, find the `ProjectTarget` type at line 128 and add the new member:

```typescript
export type ProjectTarget =
	| "cli"
	| "obsidian-vault"
	| "obsidian-plugin"
	| "typescript"
	| "webapp"
	| "vault-test";
```

- [ ] **Step 2: Run type check to verify no regressions**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: PASS (adding a union member is backwards-compatible)

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/e2e/journey/journey-types.ts"
git commit -m "feat(e2e): add vault-test to ProjectTarget union"
```

---

### Task 2: Register 3 new capabilities in providers/index.ts

**Files:**
- Modify: `src/domain/e2e/journey/providers/index.ts:18-149` (builtInCapabilities array)

- [ ] **Step 1: Add 3 capability definitions to the builtInCapabilities array**

In `src/domain/e2e/journey/providers/index.ts`, find the `builtInCapabilities` array (starts at line 18). Add these 3 entries at the end of the array, before the closing `]`:

```typescript
	{
		id: "vault-provision",
		name: "Vault Provisioning",
		description: "Provision ephemeral test vaults from a template directory",
		check: () => true,
	},
	{
		id: "vault-cli",
		name: "Vault CLI Execution",
		description: "Execute Flowti CLI commands in a provisioned vault",
		check: () => true,
	},
	{
		id: "vault-project",
		name: "Vault Project Operations",
		description: "Query and manage projects in a provisioned vault",
		check: () => true,
	},
```

- [ ] **Step 2: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: PASS

- [ ] **Step 3: Run existing e2e tests to verify no regressions**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/e2e/ --config configs/vitest.config.ts`
Expected: All existing e2e tests pass

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/e2e/journey/providers/index.ts"
git commit -m "feat(e2e): register vault-provision, vault-cli, vault-project capabilities"
```

---

### Task 3: Create the vault-test provider skeleton with tests

**Files:**
- Create: `src/domain/e2e/journey/providers/vault-test-provider.ts`
- Create: `tests/domain/e2e/journey/providers/vault-test-provider.test.ts`
- Modify: `src/domain/e2e/journey/providers/index.ts:157-173` (createDefaultRegistry)

- [ ] **Step 1: Write the failing test for the provider factory**

Create `tests/domain/e2e/journey/providers/vault-test-provider.test.ts`:

```typescript
vi.mock("../../../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../../../../src/infrastructure/shell.js", () => ({ sh: {} }));
vi.mock("../../../../../src/infrastructure/paths.js", () => ({ paths: {} }));

import { createVaultTestProvider } from "../../../../../src/domain/e2e/journey/providers/vault-test-provider.js";
import type { EnvironmentProvider } from "../../../../../src/domain/e2e/journey/journey-environment.js";

describe("createVaultTestProvider", () => {
	it("returns a valid EnvironmentProvider", () => {
		const provider = createVaultTestProvider();
		expect(provider.target).toBe("vault-test");
		expect(provider.label).toBe("Vault Test");
		expect(provider.capabilities).toContain("vault-cli");
		expect(provider.capabilities).toContain("vault-provision");
		expect(provider.capabilities).toContain("vault-project");
		expect(provider.capabilities).toContain("command");
		expect(provider.capabilities).toContain("filesystem");
	});

	it("provides vault-cli tool", () => {
		const provider = createVaultTestProvider();
		expect(provider.tools["vault-cli"]).toBeDefined();
	});

	it("provides vault-project tool", () => {
		const provider = createVaultTestProvider();
		expect(provider.tools["vault-project"]).toBeDefined();
	});

	it("provides vault-assert tool", () => {
		const provider = createVaultTestProvider();
		expect(provider.tools["vault-assert"]).toBeDefined();
	});

	it("has setup and teardown functions", () => {
		const provider = createVaultTestProvider();
		expect(typeof provider.setup).toBe("function");
		expect(typeof provider.teardown).toBe("function");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/e2e/journey/providers/vault-test-provider.test.ts --config configs/vitest.config.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write the provider skeleton**

Create `src/domain/e2e/journey/providers/vault-test-provider.ts`:

```typescript
import type { EnvironmentProvider, ToolExecutor } from "../journey-environment.js";

const toolVaultCli: ToolExecutor = (_action, _deps, _opts) => {
	return { tool: "vault-cli", success: false, error: "Not implemented", durationMs: 0 };
};

const toolVaultProject: ToolExecutor = (_action, _deps, _opts) => {
	return { tool: "vault-project", success: false, error: "Not implemented", durationMs: 0 };
};

const toolVaultAssert: ToolExecutor = (_action, _deps, _opts) => {
	return { tool: "vault-assert", success: false, error: "Not implemented", durationMs: 0 };
};

export function createVaultTestProvider(): EnvironmentProvider {
	return {
		target: "vault-test",
		label: "Vault Test",
		capabilities: ["command", "filesystem", "vault-provision", "vault-cli", "vault-project"],
		tools: {
			"vault-cli": toolVaultCli,
			"vault-project": toolVaultProject,
			"vault-assert": toolVaultAssert,
		},
		async setup(deps, opts) {
			opts.variables ??= {};
			deps.log("[vault-test] setup: not yet implemented");
		},
		async teardown(deps) {
			deps.log("[vault-test] teardown: not yet implemented");
		},
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/e2e/journey/providers/vault-test-provider.test.ts --config configs/vitest.config.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Register the provider in createDefaultRegistry**

In `src/domain/e2e/journey/providers/index.ts`, add the import at the top (after the other provider imports):

```typescript
import { createVaultTestProvider } from "./vault-test-provider.js";
```

Then in the `createDefaultRegistry` function (around line 163), add before the `return registry`:

```typescript
	registry.registerProvider(createVaultTestProvider());
```

- [ ] **Step 6: Update providers.test.ts to expect 6 targets**

In `tests/domain/e2e/journey/providers.test.ts`, find the assertion for target count (e.g. `expect(targets).toHaveLength(5)`) and update it to `toHaveLength(6)`. Also add `expect(targets).toContain("vault-test")` if there's a list of expected targets.

- [ ] **Step 7: Run all e2e tests to verify no regressions**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/e2e/ --config configs/vitest.config.ts`
Expected: All tests pass (existing + new)

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/e2e/journey/providers/vault-test-provider.ts" \
       "01 - Projects/Flowti CLI/tests/domain/e2e/journey/providers/vault-test-provider.test.ts" \
       "01 - Projects/Flowti CLI/src/domain/e2e/journey/providers/index.ts" \
       "01 - Projects/Flowti CLI/tests/domain/e2e/journey/providers.test.ts"
git commit -m "feat(e2e): add vault-test provider skeleton with tests"
```

---

### Task 4: Create Vitest vault config

**Files:**
- Create: `configs/vitest.vault.config.ts`

- [ ] **Step 1: Create the vault Vitest config**

Create `01 - Projects/Flowti CLI/configs/vitest.vault.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		root: "..",
		include: ["tests/vault-journeys/**/*.test.ts"],
		pool: "forks",
		poolOptions: { forks: { isolate: true } },
		fileParallelism: true,
		globals: true,
		testTimeout: 60_000,
		hookTimeout: 60_000,
		teardownTimeout: 10_000,
		restoreMocks: true,
		clearMocks: true,
		unstubEnvs: true,
		unstubGlobals: true,
		reporters: [
			"default",
			["json", { outputFile: "reports/tests/vault-testreport.json" }],
		],
	},
});
```

- [ ] **Step 2: Verify the config is valid (dry run — no tests exist yet)**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.vault.config.ts 2>&1 || true`
Expected: "No test files found" or similar (no crash). The config parses correctly.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/configs/vitest.vault.config.ts"
git commit -m "feat(e2e): add vitest.vault.config.ts for vault journey tests"
```

---

### Task 5: Add npm scripts to package.json

**Files:**
- Modify: `01 - Projects/Flowti CLI/package.json:6-14` (scripts section)

- [ ] **Step 1: Add the 4 test:vault scripts**

In `package.json`, add these scripts after the existing `"typedoc"` script:

```json
"test:vault": "node configs/esbuild.config.mjs && vitest run --config configs/vitest.vault.config.ts",
"test:vault:smoke": "node configs/esbuild.config.mjs && vitest run --config configs/vitest.vault.config.ts tests/vault-journeys/tier-1-smoke.test.ts",
"test:vault:integration": "node configs/esbuild.config.mjs && vitest run --config configs/vitest.vault.config.ts tests/vault-journeys/tier-2-integration.test.ts",
"test:vault:ecosystem": "node configs/esbuild.config.mjs && vitest run --config configs/vitest.vault.config.ts tests/vault-journeys/tier-3-ecosystem.test.ts"
```

- [ ] **Step 2: Verify package.json is valid JSON**

Run: `cd "01 - Projects/Flowti CLI" && node -e "require('./package.json'); console.log('valid')"`
Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/package.json"
git commit -m "feat(e2e): add test:vault npm scripts"
```

---

## Chunk 2: Template Vault Fixtures

### Task 6: Create the vault template directory structure and config

**Files:**
- Create: `tests/vault-template/.flowti/config.json`
- Create: `tests/vault-template/.flowti/bin/.gitkeep`
- Create: `tests/vault-template/flowti.cmd`

- [ ] **Step 1: Create the .flowti/config.json for standalone mode**

Create `01 - Projects/Flowti CLI/tests/vault-template/.flowti/config.json`:

```json
{
	"version": "1.0.0",
	"projectsFolder": "01 - Projects"
}
```

Note: No `source` field — this triggers standalone mode in bootstrap.

- [ ] **Step 2: Create .gitkeep in .flowti/bin/**

Create `01 - Projects/Flowti CLI/tests/vault-template/.flowti/bin/.gitkeep` (empty file).
This directory will receive the injected CLI binary at setup time.

- [ ] **Step 3: Create flowti.cmd launcher**

Create `01 - Projects/Flowti CLI/tests/vault-template/flowti.cmd`:

```batch
@echo off
node "%~dp0.flowti\bin\main.js" %*
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/tests/vault-template/"
git commit -m "feat(e2e): add vault template base structure"
```

---

### Task 7: Create the Healthy App fixture

**Files:**
- Create: `tests/vault-template/01 - Projects/Healthy App/package.json`
- Create: `tests/vault-template/01 - Projects/Healthy App/configs/flowti.config.json`
- Create: `tests/vault-template/01 - Projects/Healthy App/configs/tsconfig.json`
- Create: `tests/vault-template/01 - Projects/Healthy App/configs/vitest.config.ts`
- Create: `tests/vault-template/01 - Projects/Healthy App/src/main.ts`
- Create: `tests/vault-template/01 - Projects/Healthy App/tests/main.test.ts`

- [ ] **Step 1: Create package.json**

Create `tests/vault-template/01 - Projects/Healthy App/package.json`:

```json
{
	"name": "healthy-app",
	"version": "1.0.0",
	"type": "module",
	"scripts": {
		"build": "tsc --project configs/tsconfig.json",
		"test": "vitest run --config configs/vitest.config.ts",
		"lint": "echo lint-pass",
		"check": "tsc --project configs/tsconfig.json --noEmit"
	},
	"devDependencies": {
		"typescript": "^5.4.0",
		"vitest": "^3.0.0"
	}
}
```

- [ ] **Step 2: Create tsconfig.json**

Create `tests/vault-template/01 - Projects/Healthy App/configs/tsconfig.json`:

```json
{
	"compilerOptions": {
		"target": "ES2022",
		"module": "NodeNext",
		"moduleResolution": "NodeNext",
		"outDir": "../dist",
		"rootDir": "../src",
		"strict": true,
		"esModuleInterop": true,
		"declaration": true
	},
	"include": ["../src/**/*.ts"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

Create `tests/vault-template/01 - Projects/Healthy App/configs/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		root: "..",
		include: ["tests/**/*.test.ts"],
		globals: true,
	},
});
```

- [ ] **Step 4: Create flowti.config.json**

Create `tests/vault-template/01 - Projects/Healthy App/configs/flowti.config.json`:

```json
{
	"name": "Healthy App",
	"type": "typescript",
	"build": {
		"commands": {
			"fast": "npm run build"
		}
	},
	"test": {
		"commands": {
			"unit": "npm test"
		}
	},
	"health": {
		"thresholds": {
			"minCoverage": 50,
			"targetCoverage": 80,
			"maxLintErrors": 5,
			"maxLintWarnings": 10,
			"minPassedTests": 1
		}
	}
}
```

- [ ] **Step 5: Create src/main.ts**

Create `tests/vault-template/01 - Projects/Healthy App/src/main.ts`:

```typescript
export function greet(name: string): string {
	return `Hello, ${name}!`;
}

export function add(a: number, b: number): number {
	return a + b;
}
```

- [ ] **Step 6: Create tests/main.test.ts**

Create `tests/vault-template/01 - Projects/Healthy App/tests/main.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { greet, add } from "../src/main.js";

describe("greet", () => {
	it("returns greeting with name", () => {
		expect(greet("World")).toBe("Hello, World!");
	});
});

describe("add", () => {
	it("adds two numbers", () => {
		expect(add(2, 3)).toBe(5);
	});
});
```

- [ ] **Step 7: Install dependencies (manually, once)**

Run: `cd "01 - Projects/Flowti CLI/tests/vault-template/01 - Projects/Healthy App" && npm install`
Expected: `node_modules/` created with vitest and typescript

- [ ] **Step 8: Verify the healthy app passes all checks**

Run: `cd "01 - Projects/Flowti CLI/tests/vault-template/01 - Projects/Healthy App" && npm test && npm run check`
Expected: Both pass

- [ ] **Step 9: Add node_modules to .gitignore**

Create `tests/vault-template/.gitignore`:

```
**/node_modules/
**/dist/
```

- [ ] **Step 10: Commit**

```bash
git add "01 - Projects/Flowti CLI/tests/vault-template/01 - Projects/Healthy App/" \
       "01 - Projects/Flowti CLI/tests/vault-template/.gitignore"
git commit -m "feat(e2e): add Healthy App fixture for vault template"
```

---

### Task 8: Create the Broken App fixture

**Files:**
- Create: `tests/vault-template/01 - Projects/Broken App/package.json`
- Create: `tests/vault-template/01 - Projects/Broken App/configs/flowti.config.json`
- Create: `tests/vault-template/01 - Projects/Broken App/configs/tsconfig.json`
- Create: `tests/vault-template/01 - Projects/Broken App/configs/vitest.config.ts`
- Create: `tests/vault-template/01 - Projects/Broken App/src/main.ts`
- Create: `tests/vault-template/01 - Projects/Broken App/tests/main.test.ts`

- [ ] **Step 1: Create package.json**

Create `tests/vault-template/01 - Projects/Broken App/package.json`:

```json
{
	"name": "broken-app",
	"version": "1.0.0",
	"type": "module",
	"scripts": {
		"build": "tsc --project configs/tsconfig.json",
		"test": "vitest run --config configs/vitest.config.ts",
		"lint": "echo lint-fail && exit 1",
		"check": "tsc --project configs/tsconfig.json --noEmit"
	},
	"devDependencies": {
		"typescript": "^5.4.0",
		"vitest": "^3.0.0"
	}
}
```

- [ ] **Step 2: Create tsconfig.json (same as Healthy App)**

Create `tests/vault-template/01 - Projects/Broken App/configs/tsconfig.json`:

```json
{
	"compilerOptions": {
		"target": "ES2022",
		"module": "NodeNext",
		"moduleResolution": "NodeNext",
		"outDir": "../dist",
		"rootDir": "../src",
		"strict": true,
		"esModuleInterop": true,
		"declaration": true
	},
	"include": ["../src/**/*.ts"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

Create `tests/vault-template/01 - Projects/Broken App/configs/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		root: "..",
		include: ["tests/**/*.test.ts"],
		globals: true,
	},
});
```

- [ ] **Step 4: Create flowti.config.json with impossible thresholds**

Create `tests/vault-template/01 - Projects/Broken App/configs/flowti.config.json`:

```json
{
	"name": "Broken App",
	"type": "typescript",
	"build": {
		"commands": {
			"fast": "npm run build"
		}
	},
	"test": {
		"commands": {
			"unit": "npm test"
		}
	},
	"health": {
		"thresholds": {
			"minCoverage": 100,
			"targetCoverage": 100,
			"maxLintErrors": 0,
			"maxLintWarnings": 0,
			"minPassedTests": 100
		}
	}
}
```

- [ ] **Step 5: Create src/main.ts with type error**

Create `tests/vault-template/01 - Projects/Broken App/src/main.ts`:

```typescript
export function broken(input: string): number {
	// Type error: string is not assignable to number
	return input;
}
```

- [ ] **Step 6: Create tests/main.test.ts with failing tests**

Create `tests/vault-template/01 - Projects/Broken App/tests/main.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

describe("broken", () => {
	it("this test intentionally fails", () => {
		expect(1).toBe(2);
	});
});
```

- [ ] **Step 7: Install dependencies**

Run: `cd "01 - Projects/Flowti CLI/tests/vault-template/01 - Projects/Broken App" && npm install`

- [ ] **Step 8: Verify the broken app fails as expected**

Run: `cd "01 - Projects/Flowti CLI/tests/vault-template/01 - Projects/Broken App" && npm test; echo "exit: $?"`
Expected: FAIL with non-zero exit code

Run: `cd "01 - Projects/Flowti CLI/tests/vault-template/01 - Projects/Broken App" && npm run check; echo "exit: $?"`
Expected: FAIL (type error)

- [ ] **Step 9: Commit**

```bash
git add "01 - Projects/Flowti CLI/tests/vault-template/01 - Projects/Broken App/"
git commit -m "feat(e2e): add Broken App fixture for vault template"
```

---

## Chunk 3: Vault Tools Implementation

### Task 9: Implement vault-cli tool with tests

**Files:**
- Modify: `src/domain/e2e/journey/providers/vault-test-provider.ts`
- Modify: `tests/domain/e2e/journey/providers/vault-test-provider.test.ts`

- [ ] **Step 1: Write failing tests for vault-cli**

Add to `tests/domain/e2e/journey/providers/vault-test-provider.test.ts`:

```typescript
import { createMockClock } from "../../../../mocks/mock-clock.js";
import type { ToolDeps } from "../../../../../src/domain/e2e/journey/journey-executor.js";
import type { JourneyExecutorOptions } from "../../../../../src/domain/e2e/journey/journey-types.js";

function createMockToolDeps(overrides?: Partial<ToolDeps>): ToolDeps {
	return {
		exec: vi.fn(() => ({ exitCode: 0, stdout: "ok", stderr: "" })),
		readFile: vi.fn(() => ""),
		writeFile: vi.fn(),
		exists: vi.fn(() => true),
		mkdir: vi.fn(),
		log: vi.fn(),
		sleep: vi.fn(async () => {}),
		clock: createMockClock(),
		...overrides,
	};
}

describe("vault-cli tool", () => {
	it("executes CLI command in vault root", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps();
		const opts: JourneyExecutorOptions = { variables: { vaultRoot: "/tmp/test-vault" } };
		const action = { tool: "vault-cli", command: "help" };

		const result = provider.tools["vault-cli"](action, deps, opts);

		expect(deps.exec).toHaveBeenCalledWith(
			expect.stringContaining("help"),
			expect.objectContaining({ cwd: "/tmp/test-vault" }),
		);
		expect(result.success).toBe(true);
	});

	it("fails when exit code does not match expectExit", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps({
			exec: vi.fn(() => ({ exitCode: 1, stdout: "", stderr: "error" })),
		});
		const opts: JourneyExecutorOptions = { variables: { vaultRoot: "/tmp/test-vault" } };
		const action = { tool: "vault-cli", command: "build", expectExit: 0 };

		const result = provider.tools["vault-cli"](action, deps, opts);

		expect(result.success).toBe(false);
	});

	it("succeeds when exit code matches non-zero expectExit", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps({
			exec: vi.fn(() => ({ exitCode: 1, stdout: "fail output", stderr: "" })),
		});
		const opts: JourneyExecutorOptions = { variables: { vaultRoot: "/tmp/test-vault" } };
		const action = { tool: "vault-cli", command: "build", expectExit: 1 };

		const result = provider.tools["vault-cli"](action, deps, opts);

		expect(result.success).toBe(true);
	});

	it("checks stdoutContains when provided", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps({
			exec: vi.fn(() => ({ exitCode: 0, stdout: "flowti v1.0.0", stderr: "" })),
		});
		const opts: JourneyExecutorOptions = { variables: { vaultRoot: "/tmp/test-vault" } };
		const action = { tool: "vault-cli", command: "help", stdoutContains: "flowti" };

		const result = provider.tools["vault-cli"](action, deps, opts);

		expect(result.success).toBe(true);
	});

	it("fails when stdoutContains does not match", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps({
			exec: vi.fn(() => ({ exitCode: 0, stdout: "something else", stderr: "" })),
		});
		const opts: JourneyExecutorOptions = { variables: { vaultRoot: "/tmp/test-vault" } };
		const action = { tool: "vault-cli", command: "help", stdoutContains: "flowti" };

		const result = provider.tools["vault-cli"](action, deps, opts);

		expect(result.success).toBe(false);
	});

	it("stores stdout in variables via storeAs", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps({
			exec: vi.fn(() => ({ exitCode: 0, stdout: "output data", stderr: "" })),
		});
		const opts: JourneyExecutorOptions = { variables: { vaultRoot: "/tmp/test-vault" } };
		const action = { tool: "vault-cli", command: "info", storeAs: "result" };

		provider.tools["vault-cli"](action, deps, opts);

		expect(opts.variables!["result"]).toBe("output data");
	});

	it("parses JSON output when format is json", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps({
			exec: vi.fn(() => ({ exitCode: 0, stdout: '{"score": 85}', stderr: "" })),
		});
		const opts: JourneyExecutorOptions = { variables: { vaultRoot: "/tmp/test-vault" } };
		const action = { tool: "vault-cli", command: "health", format: "json", storeAs: "health" };

		provider.tools["vault-cli"](action, deps, opts);

		expect(opts.variables!["health"]).toEqual({ score: 85 });
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/e2e/journey/providers/vault-test-provider.test.ts --config configs/vitest.config.ts`
Expected: New tests FAIL (tool returns "Not implemented")

- [ ] **Step 3: Implement vault-cli tool**

Replace the `toolVaultCli` stub in `vault-test-provider.ts` with:

```typescript
import { resolveString } from "../journey-tools.js";

const toolVaultCli: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const vaultRoot = opts.variables?.["vaultRoot"] ?? ".";
	const command = resolveString(action, "command", opts.variables ?? {});
	const expectExit = typeof action.expectExit === "number" ? action.expectExit : 0;
	const stdoutContains = action.stdoutContains as string | undefined;
	const storeAs = action.storeAs as string | undefined;
	const format = action.format as string | undefined;

	try {
		const r = deps.exec(`node .flowti/bin/main.js ${command}`, {
			cwd: vaultRoot,
			timeout: opts.commandTimeout ?? 30_000,
			env: opts.env,
		});

		const exitMatch = r.exitCode === expectExit;
		const containsMatch = stdoutContains ? r.stdout.includes(stdoutContains) : true;
		const success = exitMatch && containsMatch;

		if (storeAs && opts.variables) {
			if (format === "json") {
				try {
					opts.variables[storeAs] = JSON.parse(r.stdout);
				} catch {
					opts.variables[storeAs] = r.stdout;
				}
			} else {
				opts.variables[storeAs] = r.stdout;
			}
		}

		return {
			tool: "vault-cli",
			success,
			output: r.stdout.slice(0, 1000),
			error: success ? undefined : `Exit ${r.exitCode} (expected ${expectExit})${!containsMatch ? `, stdout missing "${stdoutContains}"` : ""}`,
			durationMs: deps.clock.ms() - start,
		};
	} catch (e) {
		return { tool: "vault-cli", success: false, error: String(e), durationMs: deps.clock.ms() - start };
	}
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/e2e/journey/providers/vault-test-provider.test.ts --config configs/vitest.config.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/e2e/journey/providers/vault-test-provider.ts" \
       "01 - Projects/Flowti CLI/tests/domain/e2e/journey/providers/vault-test-provider.test.ts"
git commit -m "feat(e2e): implement vault-cli tool with full test coverage"
```

---

### Task 10: Implement vault-project tool with tests

**Files:**
- Modify: `src/domain/e2e/journey/providers/vault-test-provider.ts`
- Modify: `tests/domain/e2e/journey/providers/vault-test-provider.test.ts`

- [ ] **Step 1: Write failing tests for vault-project**

Add to the test file:

```typescript
describe("vault-project tool", () => {
	it("list operation reads project directories", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps({
			readFile: vi.fn(() => ""),
			exists: vi.fn(() => true),
		});
		// Mock readdirSync-like behavior via deps — the tool uses deps.exec to list dirs
		// Actually vault-project list reads filesystem directly
		const opts: JourneyExecutorOptions = { variables: { vaultRoot: "/tmp/vault" } };
		const action = { tool: "vault-project", op: "list", storeAs: "projects" };

		// The tool should call deps.exec with a directory listing command
		// or use deps.readFile — implementation decides
		const result = provider.tools["vault-project"](action, deps, opts);
		expect(result.tool).toBe("vault-project");
	});

	it("info operation runs flowti info with project flag", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps({
			exec: vi.fn(() => ({ exitCode: 0, stdout: '{"name":"Healthy App"}', stderr: "" })),
		});
		const opts: JourneyExecutorOptions = { variables: { vaultRoot: "/tmp/vault" } };
		const action = { tool: "vault-project", op: "info", project: "Healthy App", storeAs: "info" };

		const result = provider.tools["vault-project"](action, deps, opts);

		expect(result.success).toBe(true);
		expect(deps.exec).toHaveBeenCalledWith(
			expect.stringContaining("info"),
			expect.objectContaining({ cwd: "/tmp/vault" }),
		);
	});

	it("run operation executes command with project flag", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps();
		const opts: JourneyExecutorOptions = { variables: { vaultRoot: "/tmp/vault" } };
		const action = { tool: "vault-project", op: "run", project: "Healthy App", command: "build" };

		const result = provider.tools["vault-project"](action, deps, opts);

		expect(result.success).toBe(true);
		expect(deps.exec).toHaveBeenCalledWith(
			expect.stringContaining('build --project="Healthy App"'),
			expect.anything(),
		);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/e2e/journey/providers/vault-test-provider.test.ts --config configs/vitest.config.ts`
Expected: New tests FAIL

- [ ] **Step 3: Implement vault-project tool**

Replace the `toolVaultProject` stub:

```typescript
const toolVaultProject: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const vaultRoot = opts.variables?.["vaultRoot"] ?? ".";
	const op = action.op as string;
	const project = resolveString(action, "project", opts.variables ?? {});
	const storeAs = action.storeAs as string | undefined;

	try {
		if (op === "list") {
			const r = deps.exec(`node .flowti/bin/main.js info --format=json`, {
				cwd: vaultRoot,
				timeout: opts.commandTimeout ?? 30_000,
				env: opts.env,
			});
			if (storeAs && opts.variables) {
				try {
					opts.variables[storeAs] = JSON.parse(r.stdout);
				} catch {
					opts.variables[storeAs] = r.stdout;
				}
			}
			return { tool: "vault-project", success: r.exitCode === 0, output: r.stdout.slice(0, 500), durationMs: deps.clock.ms() - start };
		}

		if (op === "info") {
			const r = deps.exec(`node .flowti/bin/main.js info --project="${project}" --format=json`, {
				cwd: vaultRoot,
				timeout: opts.commandTimeout ?? 30_000,
				env: opts.env,
			});
			if (storeAs && opts.variables) {
				try {
					opts.variables[storeAs] = JSON.parse(r.stdout);
				} catch {
					opts.variables[storeAs] = r.stdout;
				}
			}
			return { tool: "vault-project", success: r.exitCode === 0, output: r.stdout.slice(0, 500), durationMs: deps.clock.ms() - start };
		}

		if (op === "run") {
			const command = resolveString(action, "command", opts.variables ?? {});
			const expectExit = typeof action.expectExit === "number" ? action.expectExit : 0;
			const r = deps.exec(`node .flowti/bin/main.js ${command} --project="${project}"`, {
				cwd: vaultRoot,
				timeout: opts.commandTimeout ?? 30_000,
				env: opts.env,
			});
			if (storeAs && opts.variables) opts.variables[storeAs] = r.stdout;
			return { tool: "vault-project", success: r.exitCode === expectExit, output: r.stdout.slice(0, 500), durationMs: deps.clock.ms() - start };
		}

		return { tool: "vault-project", success: false, error: `Unknown op: ${op}`, durationMs: deps.clock.ms() - start };
	} catch (e) {
		return { tool: "vault-project", success: false, error: String(e), durationMs: deps.clock.ms() - start };
	}
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/e2e/journey/providers/vault-test-provider.test.ts --config configs/vitest.config.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/e2e/journey/providers/vault-test-provider.ts" \
       "01 - Projects/Flowti CLI/tests/domain/e2e/journey/providers/vault-test-provider.test.ts"
git commit -m "feat(e2e): implement vault-project tool with tests"
```

---

### Task 11: Implement vault-assert tool with tests

**Files:**
- Modify: `src/domain/e2e/journey/providers/vault-test-provider.ts`
- Modify: `tests/domain/e2e/journey/providers/vault-test-provider.test.ts`

- [ ] **Step 1: Write failing tests for vault-assert**

Add to the test file:

```typescript
describe("vault-assert tool", () => {
	it("health-score: passes when score is in range", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps();
		const opts: JourneyExecutorOptions = {
			variables: { vaultRoot: "/tmp/vault", healthResult: { score: 85 } },
		};
		const action = { tool: "vault-assert", type: "health-score", source: "healthResult", min: 70, max: 100 };

		const result = provider.tools["vault-assert"](action, deps, opts);
		expect(result.success).toBe(true);
	});

	it("health-score: fails when score is below min", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps();
		const opts: JourneyExecutorOptions = {
			variables: { vaultRoot: "/tmp/vault", healthResult: { score: 30 } },
		};
		const action = { tool: "vault-assert", type: "health-score", source: "healthResult", min: 70, max: 100 };

		const result = provider.tools["vault-assert"](action, deps, opts);
		expect(result.success).toBe(false);
	});

	it("json-field: passes with eq operator", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps();
		const opts: JourneyExecutorOptions = {
			variables: { vaultRoot: "/tmp/vault", data: { name: "test" } },
		};
		const action = { tool: "vault-assert", type: "json-field", source: "data", field: "name", operator: "eq", expected: "test" };

		const result = provider.tools["vault-assert"](action, deps, opts);
		expect(result.success).toBe(true);
	});

	it("json-field: passes with gte operator", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps();
		const opts: JourneyExecutorOptions = {
			variables: { vaultRoot: "/tmp/vault", data: { count: 10 } },
		};
		const action = { tool: "vault-assert", type: "json-field", source: "data", field: "count", operator: "gte", expected: 5 };

		const result = provider.tools["vault-assert"](action, deps, opts);
		expect(result.success).toBe(true);
	});

	it("json-field: supports dot-path traversal", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps();
		const opts: JourneyExecutorOptions = {
			variables: { vaultRoot: "/tmp/vault", data: { nested: { value: 42 } } },
		};
		const action = { tool: "vault-assert", type: "json-field", source: "data", field: "nested.value", operator: "eq", expected: 42 };

		const result = provider.tools["vault-assert"](action, deps, opts);
		expect(result.success).toBe(true);
	});

	it("json-field: contains operator for strings", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps();
		const opts: JourneyExecutorOptions = {
			variables: { vaultRoot: "/tmp/vault", data: { message: "hello world" } },
		};
		const action = { tool: "vault-assert", type: "json-field", source: "data", field: "message", operator: "contains", expected: "world" };

		const result = provider.tools["vault-assert"](action, deps, opts);
		expect(result.success).toBe(true);
	});

	it("report-exists: passes when report file exists", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps({ exists: vi.fn(() => true) });
		const opts: JourneyExecutorOptions = { variables: { vaultRoot: "/tmp/vault" } };
		const action = { tool: "vault-assert", type: "report-exists", project: "Healthy App", report: "health" };

		const result = provider.tools["vault-assert"](action, deps, opts);
		expect(result.success).toBe(true);
	});

	it("report-exists: fails when report file missing", () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps({ exists: vi.fn(() => false) });
		const opts: JourneyExecutorOptions = { variables: { vaultRoot: "/tmp/vault" } };
		const action = { tool: "vault-assert", type: "report-exists", project: "Healthy App", report: "health" };

		const result = provider.tools["vault-assert"](action, deps, opts);
		expect(result.success).toBe(false);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/e2e/journey/providers/vault-test-provider.test.ts --config configs/vitest.config.ts`
Expected: New tests FAIL

- [ ] **Step 3: Implement vault-assert tool**

Replace the `toolVaultAssert` stub:

```typescript
function getNestedField(obj: Record<string, unknown>, dotPath: string): unknown {
	return dotPath.split(".").reduce<unknown>((current, key) => {
		if (current && typeof current === "object") return (current as Record<string, unknown>)[key];
		return undefined;
	}, obj);
}

function compareValues(actual: unknown, operator: string, expected: unknown): boolean {
	switch (operator) {
		case "eq": return actual === expected;
		case "gt": return (actual as number) > (expected as number);
		case "gte": return (actual as number) >= (expected as number);
		case "lt": return (actual as number) < (expected as number);
		case "lte": return (actual as number) <= (expected as number);
		case "contains": return typeof actual === "string" && actual.includes(String(expected));
		default: return false;
	}
}

const toolVaultAssert: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const type = action.type as string;

	try {
		if (type === "health-score") {
			const source = opts.variables?.[action.source as string] as Record<string, unknown> | undefined;
			if (!source) return { tool: "vault-assert", success: false, error: `Variable "${action.source}" not found`, durationMs: deps.clock.ms() - start };
			const score = source.score as number;
			const min = action.min as number;
			const max = action.max as number;
			const success = score >= min && score <= max;
			return { tool: "vault-assert", success, output: `Score: ${score} (range: ${min}-${max})`, error: success ? undefined : `Score ${score} outside range ${min}-${max}`, durationMs: deps.clock.ms() - start };
		}

		if (type === "json-field") {
			const source = opts.variables?.[action.source as string] as Record<string, unknown> | undefined;
			if (!source) return { tool: "vault-assert", success: false, error: `Variable "${action.source}" not found`, durationMs: deps.clock.ms() - start };
			const actual = getNestedField(source, action.field as string);
			const success = compareValues(actual, action.operator as string, action.expected);
			return { tool: "vault-assert", success, output: `${action.field}: ${JSON.stringify(actual)} ${action.operator} ${JSON.stringify(action.expected)}`, error: success ? undefined : `Assertion failed: ${JSON.stringify(actual)} ${action.operator} ${JSON.stringify(action.expected)}`, durationMs: deps.clock.ms() - start };
		}

		if (type === "report-exists") {
			const vaultRoot = opts.variables?.["vaultRoot"] ?? ".";
			const project = resolveString(action, "project", opts.variables ?? {});
			const report = action.report as string;
			const reportPath = `${vaultRoot}/01 - Projects/${project}/reports/${report}`;
			const success = deps.exists(reportPath);
			return { tool: "vault-assert", success, output: reportPath, error: success ? undefined : `Report not found: ${reportPath}`, durationMs: deps.clock.ms() - start };
		}

		return { tool: "vault-assert", success: false, error: `Unknown assert type: ${type}`, durationMs: deps.clock.ms() - start };
	} catch (e) {
		return { tool: "vault-assert", success: false, error: String(e), durationMs: deps.clock.ms() - start };
	}
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/e2e/journey/providers/vault-test-provider.test.ts --config configs/vitest.config.ts`
Expected: All tests PASS

- [ ] **Step 5: Run lint to check line count**

Run: `cd "01 - Projects/Flowti CLI" && wc -l src/domain/e2e/journey/providers/vault-test-provider.ts`
Expected: Under 350 lines. If over, extract tools to `vault-test-tools.ts`.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/e2e/journey/providers/vault-test-provider.ts" \
       "01 - Projects/Flowti CLI/tests/domain/e2e/journey/providers/vault-test-provider.test.ts"
git commit -m "feat(e2e): implement vault-assert tool with json-field, health-score, report-exists"
```

---

### Task 12: Implement provider setup/teardown with tests

**Files:**
- Modify: `src/domain/e2e/journey/providers/vault-test-provider.ts`
- Modify: `tests/domain/e2e/journey/providers/vault-test-provider.test.ts`

- [ ] **Step 1: Write failing tests for setup/teardown**

Add to the test file:

```typescript
describe("setup", () => {
	it("initializes opts.variables when undefined", async () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps({
			exec: vi.fn(() => ({ exitCode: 0, stdout: "", stderr: "" })),
		});
		const opts: JourneyExecutorOptions = {};

		await provider.setup!(deps, opts);

		expect(opts.variables).toBeDefined();
		expect(opts.variables!["vaultRoot"]).toBeDefined();
	});

	it("sets vaultRoot variable", async () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps({
			exec: vi.fn(() => ({ exitCode: 0, stdout: "", stderr: "" })),
		});
		const opts: JourneyExecutorOptions = { variables: {} };

		await provider.setup!(deps, opts);

		expect(typeof opts.variables!["vaultRoot"]).toBe("string");
		expect(opts.variables!["vaultRoot"]).toContain("flowti-vault-test");
	});

	it("sets healthyProject and brokenProject variables", async () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps({
			exec: vi.fn(() => ({ exitCode: 0, stdout: "", stderr: "" })),
		});
		const opts: JourneyExecutorOptions = { variables: {} };

		await provider.setup!(deps, opts);

		expect(opts.variables!["healthyProject"]).toBe("Healthy App");
		expect(opts.variables!["brokenProject"]).toBe("Broken App");
	});

	it("logs provisioning summary", async () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps({
			exec: vi.fn(() => ({ exitCode: 0, stdout: "", stderr: "" })),
		});
		const opts: JourneyExecutorOptions = { variables: {} };

		await provider.setup!(deps, opts);

		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("[vault-test]"));
	});
});

describe("teardown", () => {
	it("logs cleanup summary", async () => {
		const provider = createVaultTestProvider();
		const deps = createMockToolDeps({
			exec: vi.fn(() => ({ exitCode: 0, stdout: "", stderr: "" })),
		});

		await provider.teardown!(deps);

		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("[vault-test]"));
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/e2e/journey/providers/vault-test-provider.test.ts --config configs/vitest.config.ts`
Expected: New tests FAIL

- [ ] **Step 3: Implement setup/teardown**

Replace the placeholder `setup` and `teardown` in the provider. The factory function uses a closure variable to persist `tmpDir` across `setup`/`teardown` calls (since `teardown` only receives `deps`, not `opts`).

The implementation avoids `process.env` directly (ESLint architecture rule). Instead, it uses `deps.exec` to resolve the temp dir via Node's `os.tmpdir()`. The `createVaultTestProvider` function accepts a config object for the template and binary paths.

```typescript
interface VaultTestConfig {
	templateDir: string;	// Absolute path to tests/vault-template/
	binSrc: string;			// Absolute path to .flowti/bin/main.js
}

export function createVaultTestProvider(config?: VaultTestConfig): EnvironmentProvider {
	let currentVaultRoot: string | undefined;

	return {
		target: "vault-test",
		label: "Vault Test",
		capabilities: ["command", "filesystem", "vault-provision", "vault-cli", "vault-project"],
		tools: {
			"vault-cli": toolVaultCli,
			"vault-project": toolVaultProject,
			"vault-assert": toolVaultAssert,
		},
		async setup(deps, opts) {
			opts.variables ??= {};

			// Resolve temp dir without process.env
			const tmpBase = deps.exec("node -e \"console.log(require('os').tmpdir())\"", {});
			const uuid = Math.random().toString(36).slice(2, 10);
			const tmpDir = `${tmpBase.stdout.trim()}/flowti-vault-test-${uuid}`;

			const templateDir = config?.templateDir ?? opts.variables["templateDir"] as string;
			const binSrc = config?.binSrc ?? opts.variables["binSrc"] as string;

			// Copy template vault to temp directory
			deps.exec(`node -e "require('fs').cpSync('${templateDir.replace(/\\/g, "/")}', '${tmpDir}', { recursive: true })"`, {});

			// Inject CLI binary
			if (binSrc) {
				const binDest = `${tmpDir}/.flowti/bin`;
				deps.mkdir(binDest);
				deps.exec(`node -e "require('fs').cpSync('${binSrc.replace(/\\/g, "/")}', '${binDest}/main.js')"`, {});
			}

			currentVaultRoot = tmpDir;
			opts.variables["vaultRoot"] = tmpDir;
			opts.variables["healthyProject"] = "Healthy App";
			opts.variables["brokenProject"] = "Broken App";

			deps.log(`[vault-test] Provisioned vault at ${tmpDir}`);
		},
		async teardown(deps) {
			if (currentVaultRoot) {
				deps.exec(`node -e "require('fs').rmSync('${currentVaultRoot.replace(/\\/g, "/")}', { recursive: true, force: true })"`, {});
				deps.log(`[vault-test] Cleaned up ${currentVaultRoot}`);
				currentVaultRoot = undefined;
			}
		},
	};
}
```

**Key design notes:**
- `currentVaultRoot` is a closure variable shared between `setup` and `teardown` — this is the standard pattern when the `EnvironmentProvider.teardown` signature only takes `deps`.
- The factory accepts optional `VaultTestConfig` for explicit paths, or falls back to reading `templateDir`/`binSrc` from `opts.variables` (set by the tier runner).
- All filesystem operations go through `deps.exec` with inline Node scripts, avoiding direct `process.env` usage.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/e2e/journey/providers/vault-test-provider.test.ts --config configs/vitest.config.ts`
Expected: All tests PASS

- [ ] **Step 5: Run full e2e test suite to confirm no regressions**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/e2e/ --config configs/vitest.config.ts`
Expected: All tests PASS

- [ ] **Step 6: Run lint**

Run: `cd "01 - Projects/Flowti CLI" && npx eslint src/domain/e2e/journey/providers/vault-test-provider.ts --config configs/eslint.config.mjs`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/e2e/journey/providers/vault-test-provider.ts" \
       "01 - Projects/Flowti CLI/tests/domain/e2e/journey/providers/vault-test-provider.test.ts"
git commit -m "feat(e2e): implement vault-test provider setup and teardown"
```

---

## Chunk 4: Journey Definitions + Tier Runners

### Task 13: Create Tier 1 smoke journey definitions

**Files:**
- Create: `tests/vault-journeys/tier-1-smoke/boot.journey`
- Create: `tests/vault-journeys/tier-1-smoke/help.journey`
- Create: `tests/vault-journeys/tier-1-smoke/project-discovery.journey`

- [ ] **Step 1: Create boot.journey**

Create `01 - Projects/Flowti CLI/tests/vault-journeys/tier-1-smoke/boot.journey`:

```json
{
	"journey": "CLI Boot",
	"description": "Verify the compiled CLI binary boots in standalone mode",
	"requires": { "target": "vault-test" },
	"steps": [
		{
			"id": "boot",
			"title": "CLI starts without error",
			"description": "Run the CLI help command and verify it exits cleanly",
			"actions": [
				{ "tool": "vault-cli", "command": "help", "expectExit": 0 }
			]
		}
	]
}
```

- [ ] **Step 2: Create help.journey**

Create `01 - Projects/Flowti CLI/tests/vault-journeys/tier-1-smoke/help.journey`:

```json
{
	"journey": "CLI Help",
	"description": "Verify the help command lists available commands",
	"requires": { "target": "vault-test" },
	"steps": [
		{
			"id": "help-output",
			"title": "Help command produces output",
			"description": "Run help and verify it returns content",
			"actions": [
				{ "tool": "vault-cli", "command": "help", "expectExit": 0, "storeAs": "helpOutput" }
			]
		},
		{
			"id": "help-contains-commands",
			"title": "Help output lists known commands",
			"description": "Verify the help output mentions at least one known command",
			"actions": [
				{ "tool": "vault-cli", "command": "help", "expectExit": 0, "stdoutContains": "build" }
			]
		}
	]
}
```

- [ ] **Step 3: Create project-discovery.journey**

Create `01 - Projects/Flowti CLI/tests/vault-journeys/tier-1-smoke/project-discovery.journey`:

```json
{
	"journey": "Project Discovery",
	"description": "Verify the CLI discovers both sample projects in the vault",
	"requires": { "target": "vault-test" },
	"steps": [
		{
			"id": "discover-healthy",
			"title": "Discovers Healthy App",
			"description": "CLI info command finds the Healthy App project",
			"actions": [
				{ "tool": "vault-cli", "command": "info --project=\"Healthy App\" --format=json", "expectExit": 0 }
			]
		},
		{
			"id": "discover-broken",
			"title": "Discovers Broken App",
			"description": "CLI info command finds the Broken App project",
			"actions": [
				{ "tool": "vault-cli", "command": "info --project=\"Broken App\" --format=json", "expectExit": 0 }
			]
		}
	]
}
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/tests/vault-journeys/tier-1-smoke/"
git commit -m "feat(e2e): add tier-1 smoke journey definitions"
```

---

### Task 14: Create Tier 1 smoke runner test

**Files:**
- Create: `tests/vault-journeys/tier-1-smoke.test.ts`

- [ ] **Step 1: Create the tier-1 smoke runner**

Create `01 - Projects/Flowti CLI/tests/vault-journeys/tier-1-smoke.test.ts`:

```typescript
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadAllJourneys } from "../../src/domain/e2e/journey/journey-loader.js";
import {
	runStep,
	setToolDeps,
	createDefaultDeps,
} from "../../src/domain/e2e/journey/journey-test-runner.js";
import { createDefaultRegistry } from "../../src/domain/e2e/journey/providers/index.js";
import { createVaultTestProvider } from "../../src/domain/e2e/journey/providers/vault-test-provider.js";
import { createDefaultDeps as createInfraDeps } from "../../src/infrastructure/deps.js";
import type { JourneyExecutorOptions } from "../../src/domain/e2e/journey/journey-types.js";

const readFile = (p: string) => readFileSync(p, "utf-8");
const listFiles = (d: string) =>
	readdirSync(d).filter((f) => f.endsWith(".journey"));
const journeysDir = join(import.meta.dirname, "tier-1-smoke");
const journeys = loadAllJourneys(readFile, listFiles, journeysDir);
const infraDeps = createInfraDeps();

// Resolve paths for the vault-test provider
const cliProjectRoot = join(import.meta.dirname, "../..");
const templateDir = join(cliProjectRoot, "tests/vault-template");
const binSrc = join(cliProjectRoot, "../../.flowti/bin/main.js");

for (const journey of journeys) {
	describe(`[Tier 1] ${journey.journey}`, () => {
		let opts: JourneyExecutorOptions;
		// Fresh provider instance per journey — closure holds vaultRoot for teardown
		const provider = createVaultTestProvider({ templateDir, binSrc });

		beforeEach(async () => {
			opts = { variables: { templateDir, binSrc } };
			const deps = createDefaultDeps(infraDeps);
			// Call setup directly — NOT via env to avoid double invocation
			await provider.setup!(deps, opts);
			setToolDeps(deps);
		});

		// Build a stripped env with tools but WITHOUT setup/teardown
		// This gives runStep access to vault-cli/vault-project/vault-assert
		// without triggering setup again (executeJourney calls resolved.setup)
		const BASE_TOOLS_IMPORT = await import("../../src/domain/e2e/journey/journey-tools.js");
		const strippedEnv = {
			tools: { ...BASE_TOOLS_IMPORT.BASE_TOOLS, ...provider.tools },
		};

		for (const step of journey.steps) {
			it(step.title, async () => {
				const result = await runStep(step, opts, strippedEnv);
				expect(result.status).toBe("pass");
			});
		}

		afterEach(async () => {
			const deps = createDefaultDeps(infraDeps);
			await provider.teardown!(deps);
		});
	});
}
```

**Key implementation notes:**
- `setup()` is called manually in `beforeEach` — it is NOT passed via `env` to `runStep`, which would cause double invocation (`executeJourney` line 329 calls `resolved.setup` unconditionally).
- A **stripped env** is constructed with `BASE_TOOLS` + provider tools but NO `setup`/`teardown`. This gives `runStep` access to `vault-cli`, `vault-project`, and `vault-assert` tools without re-triggering vault provisioning.
- A fresh `provider` instance is created per journey `describe` block so the closure variable `currentVaultRoot` is isolated per journey.
- The `BASE_TOOLS` import uses a dynamic `import()` because the `BASE_TOOLS` map is exported from `journey-tools.ts`. The implementer should verify the export name matches.
- Tier 2 and Tier 3 runners follow the exact same pattern — only the `journeysDir` and `[Tier N]` prefix change.

- [ ] **Step 2: Verify the runner loads journeys (dry run)**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/vault-journeys/tier-1-smoke.test.ts --config configs/vitest.vault.config.ts 2>&1 | head -20`
Expected: Test names appear (`[Tier 1] CLI Boot > CLI starts without error`). Tests may fail at this point if the binary isn't built or template vault isn't ready — that's OK, we're verifying the harness loads.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/tests/vault-journeys/tier-1-smoke.test.ts"
git commit -m "feat(e2e): add tier-1 smoke test runner"
```

---

### Task 15: Create Tier 2 integration journey definitions

**Files:**
- Create: `tests/vault-journeys/tier-2-integration/build-healthy.journey`
- Create: `tests/vault-journeys/tier-2-integration/build-broken.journey`
- Create: `tests/vault-journeys/tier-2-integration/test-healthy.journey`
- Create: `tests/vault-journeys/tier-2-integration/test-broken.journey`
- Create: `tests/vault-journeys/tier-2-integration/health-healthy.journey`
- Create: `tests/vault-journeys/tier-2-integration/health-broken.journey`
- Create: `tests/vault-journeys/tier-2-integration/reports.journey`
- Create: `tests/vault-journeys/tier-2-integration/scaffold.journey`

- [ ] **Step 1: Create build-healthy.journey**

```json
{
	"journey": "Build — Healthy App",
	"description": "Verify build succeeds on a well-configured project",
	"requires": { "target": "vault-test" },
	"steps": [
		{
			"id": "build-succeeds",
			"title": "Build exits with code 0",
			"description": "Run the build command and verify it succeeds",
			"actions": [
				{ "tool": "vault-cli", "command": "build --project=\"Healthy App\"", "expectExit": 0 }
			]
		},
		{
			"id": "build-output",
			"title": "Build produces output",
			"description": "Verify the build command returns meaningful output",
			"actions": [
				{ "tool": "vault-cli", "command": "build --project=\"Healthy App\"", "expectExit": 0, "storeAs": "buildOutput" }
			]
		}
	]
}
```

- [ ] **Step 2: Create build-broken.journey**

```json
{
	"journey": "Build — Broken App (Expected Failure)",
	"description": "Verify CLI handles build failures gracefully",
	"requires": { "target": "vault-test" },
	"steps": [
		{
			"id": "build-fails",
			"title": "Build exits with non-zero code",
			"description": "Run the build command and verify it fails as expected",
			"actions": [
				{ "tool": "vault-cli", "command": "build --project=\"Broken App\"", "expectExit": 1 }
			]
		},
		{
			"id": "error-meaningful",
			"title": "Error output is meaningful",
			"description": "Verify the failure produces useful error output",
			"actions": [
				{ "tool": "vault-cli", "command": "build --project=\"Broken App\"", "expectExit": 1, "storeAs": "buildErr" }
			]
		}
	]
}
```

- [ ] **Step 3: Create test-healthy.journey**

```json
{
	"journey": "Test — Healthy App",
	"description": "Verify tests pass on a well-configured project",
	"requires": { "target": "vault-test" },
	"steps": [
		{
			"id": "tests-pass",
			"title": "Tests exit with code 0",
			"description": "Run the test command and verify all tests pass",
			"actions": [
				{ "tool": "vault-cli", "command": "test --project=\"Healthy App\"", "expectExit": 0 }
			]
		},
		{
			"id": "test-output-json",
			"title": "Test output includes pass count",
			"description": "Run tests with JSON format and verify pass count is positive",
			"actions": [
				{ "tool": "vault-cli", "command": "test --project=\"Healthy App\" --format=json", "expectExit": 0, "format": "json", "storeAs": "testResult" }
			]
		}
	]
}
```

- [ ] **Step 4: Create test-broken.journey**

```json
{
	"journey": "Test — Broken App (Expected Failure)",
	"description": "Verify test failures are reported correctly",
	"requires": { "target": "vault-test" },
	"steps": [
		{
			"id": "tests-fail",
			"title": "Tests exit with non-zero code",
			"description": "Run the test command and verify it reports failure",
			"actions": [
				{ "tool": "vault-cli", "command": "test --project=\"Broken App\"", "expectExit": 1 }
			]
		},
		{
			"id": "failure-output",
			"title": "Failure output includes error details",
			"description": "Run tests and verify the output mentions a failure",
			"actions": [
				{ "tool": "vault-cli", "command": "test --project=\"Broken App\"", "expectExit": 1, "storeAs": "testErr" }
			]
		}
	]
}
```

- [ ] **Step 5: Create health-healthy.journey**

Use the complete journey example from the spec (see `docs/specs/2026-03-15-vault-test-environment-design.md`, Section "Complete Journey Example").

- [ ] **Step 6: Create health-broken.journey**

```json
{
	"journey": "Health Check — Broken App",
	"description": "Verify health scoring reports degraded status on a broken project",
	"requires": { "target": "vault-test" },
	"steps": [
		{
			"id": "health-json",
			"title": "Health returns structured JSON",
			"description": "Run the health command and store the JSON result",
			"actions": [
				{ "tool": "vault-cli", "command": "health --project=\"Broken App\" --format=json", "expectExit": 0, "format": "json", "storeAs": "healthResult" }
			]
		},
		{
			"id": "score-low",
			"title": "Health score is below target",
			"description": "Verify the health score is below the target threshold due to broken state",
			"actions": [
				{ "tool": "vault-assert", "type": "health-score", "source": "healthResult", "min": 0, "max": 69 }
			]
		},
		{
			"id": "status-degraded",
			"title": "Health status is not healthy",
			"description": "Verify the health status field indicates degraded or failing state",
			"actions": [
				{ "tool": "vault-assert", "type": "json-field", "source": "healthResult", "field": "status", "operator": "eq", "expected": "failing" }
			]
		}
	]
}
```

- [ ] **Step 7: Create reports.journey and scaffold.journey**

These require more knowledge of the actual CLI output format. Create minimal versions that validate the command runs:

`reports.journey`:
```json
{
	"journey": "Report Generation",
	"description": "Verify report generation produces output files",
	"requires": { "target": "vault-test" },
	"steps": [
		{
			"id": "run-reports",
			"title": "Reports command exits cleanly",
			"description": "Run the reports command for the Healthy App",
			"actions": [
				{ "tool": "vault-cli", "command": "reports --project=\"Healthy App\"", "expectExit": 0 }
			]
		}
	]
}
```

`scaffold.journey`:
```json
{
	"journey": "Scaffold New Project",
	"description": "Verify scaffolding a new project inside the vault",
	"requires": { "target": "vault-test" },
	"steps": [
		{
			"id": "scaffold-list",
			"title": "List available scaffold definitions",
			"description": "Verify the scaffold list command shows available templates",
			"actions": [
				{ "tool": "vault-cli", "command": "scaffold:list", "expectExit": 0 }
			]
		}
	]
}
```

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Flowti CLI/tests/vault-journeys/tier-2-integration/"
git commit -m "feat(e2e): add tier-2 integration journey definitions"
```

---

### Task 16: Create Tier 2 integration runner test

**Files:**
- Create: `tests/vault-journeys/tier-2-integration.test.ts`

- [ ] **Step 1: Create the runner (same pattern as Tier 1, different directory)**

Create `01 - Projects/Flowti CLI/tests/vault-journeys/tier-2-integration.test.ts` following the same pattern as `tier-1-smoke.test.ts` but pointing to `tier-2-integration/` directory and using `[Tier 2]` prefix in describe blocks.

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti CLI/tests/vault-journeys/tier-2-integration.test.ts"
git commit -m "feat(e2e): add tier-2 integration test runner"
```

---

### Task 17: Create Tier 3 ecosystem journey definitions

**Files:**
- Create: `tests/vault-journeys/tier-3-ecosystem/world-state.journey`
- Create: `tests/vault-journeys/tier-3-ecosystem/agent-status.journey`
- Create: `tests/vault-journeys/tier-3-ecosystem/iteration-lifecycle.journey`
- Create: `tests/vault-journeys/tier-3-ecosystem/claude-sync.journey`

- [ ] **Step 1: Create world-state.journey**

```json
{
	"journey": "World State",
	"description": "Verify world state command outputs valid agent data",
	"requires": { "target": "vault-test" },
	"steps": [
		{
			"id": "state-exits",
			"title": "State command exits cleanly",
			"description": "Run the state command and verify it completes",
			"actions": [
				{ "tool": "vault-cli", "command": "state", "expectExit": 0 }
			]
		},
		{
			"id": "state-json",
			"title": "State JSON output is valid",
			"description": "Run the state command with JSON output and store the result",
			"actions": [
				{ "tool": "vault-cli", "command": "state --json", "expectExit": 0, "format": "json", "storeAs": "worldState" }
			]
		},
		{
			"id": "state-has-version",
			"title": "World state contains version field",
			"description": "Verify the JSON output includes the version field",
			"actions": [
				{ "tool": "vault-assert", "type": "json-field", "source": "worldState", "field": "version", "operator": "eq", "expected": "1.0.0" }
			]
		}
	]
}
```

- [ ] **Step 2: Create agent-status.journey**

```json
{
	"journey": "Agent Status",
	"description": "Verify individual agent status lookup",
	"requires": { "target": "vault-test" },
	"steps": [
		{
			"id": "agent-lookup",
			"title": "Agent status command exits cleanly",
			"description": "Look up a known agent by name",
			"actions": [
				{ "tool": "vault-cli", "command": "state --agent=\"Bob\"", "expectExit": 0 }
			]
		},
		{
			"id": "agent-json",
			"title": "Agent status returns JSON",
			"description": "Get agent status as JSON and store the result",
			"actions": [
				{ "tool": "vault-cli", "command": "state --agent=\"Bob\" --json", "expectExit": 0, "format": "json", "storeAs": "agentState" }
			]
		},
		{
			"id": "agent-has-name",
			"title": "Agent state includes name",
			"description": "Verify the agent state JSON contains the correct name",
			"actions": [
				{ "tool": "vault-assert", "type": "json-field", "source": "agentState", "field": "name", "operator": "eq", "expected": "Bob" }
			]
		}
	]
}
```

- [ ] **Step 3: Create iteration-lifecycle.journey and claude-sync.journey**

Create minimal journey definitions that test the command exists and exits cleanly. The exact assertions depend on the CLI's actual output format for these commands. Start with exit-code assertions and refine after the first successful run.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/tests/vault-journeys/tier-3-ecosystem/"
git commit -m "feat(e2e): add tier-3 ecosystem journey definitions"
```

---

### Task 18: Create Tier 3 ecosystem runner test

**Files:**
- Create: `tests/vault-journeys/tier-3-ecosystem.test.ts`

- [ ] **Step 1: Create the runner (same pattern as Tier 1, different directory)**

Create `01 - Projects/Flowti CLI/tests/vault-journeys/tier-3-ecosystem.test.ts` following the same pattern, pointing to `tier-3-ecosystem/` and using `[Tier 3]` prefix.

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti CLI/tests/vault-journeys/tier-3-ecosystem.test.ts"
git commit -m "feat(e2e): add tier-3 ecosystem test runner"
```

---

## Chunk 5: Controller + CI + End-to-End Verification

### Task 19: Create vault-test controller

**Files:**
- Create: `src/controller/vault-test.controller.ts`
- Create: `tests/controller/vault-test.controller.test.ts`
- Modify: `src/main.ts:80-115` (controller registration)

- [ ] **Step 1: Write failing tests for the controller**

Create `tests/controller/vault-test.controller.test.ts`:

```typescript
vi.mock("../../src/infrastructure/shell.js", () => ({ sh: { run: vi.fn(), runCapture: vi.fn() } }));
vi.mock("../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../src/infrastructure/paths.js", () => ({ paths: { join: (...args: string[]) => args.join("/") } }));

import { commands } from "../../src/controller/vault-test.controller.js";

describe("vault-test controller", () => {
	it("exports test:vault command", () => {
		expect(commands["test:vault"]).toBeDefined();
	});

	it("exports test:vault:smoke command", () => {
		expect(commands["test:vault:smoke"]).toBeDefined();
	});

	it("exports test:vault:integration command", () => {
		expect(commands["test:vault:integration"]).toBeDefined();
	});

	it("exports test:vault:ecosystem command", () => {
		expect(commands["test:vault:ecosystem"]).toBeDefined();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/controller/vault-test.controller.test.ts --config configs/vitest.config.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement the controller**

Create `src/controller/vault-test.controller.ts`. The controller delegates to `deps.shell.run()` to execute the Vitest vault config. Follow the same pattern as `build.controller.ts`:

```typescript
import type { ControllerAction, CliRequest, CliResponse } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";

interface VaultTestResult {
	tier: string;
	command: string;
	exitCode: number;
}

function renderVaultTestResult(data: VaultTestResult): string {
	const status = data.exitCode === 0 ? "PASS" : "FAIL";
	return `Vault test [${data.tier}]: ${status}`;
}

function runVaultTests(req: CliRequest, tier: string, testFile?: string): CliResponse<VaultTestResult> {
	const cmd = testFile
		? `npx vitest run --config configs/vitest.vault.config.ts ${testFile}`
		: "npx vitest run --config configs/vitest.vault.config.ts";
	// Use req.project?.path for managed projects, or the CLI source root from config
	const cwd = req.project?.path ?? req.deps.paths.resolve(".");
	const exitCode = req.deps.shell.run(cmd, { cwd });
	return dataResponse({ tier, command: `test:vault${tier !== "all" ? `:${tier}` : ""}`, exitCode }, renderVaultTestResult);
}

const actions: Record<string, ControllerAction> = {
	"test:vault": (req) => runVaultTests(req, "all"),
	"test:vault:smoke": (req) => runVaultTests(req, "smoke", "tests/vault-journeys/tier-1-smoke.test.ts"),
	"test:vault:integration": (req) => runVaultTests(req, "integration", "tests/vault-journeys/tier-2-integration.test.ts"),
	"test:vault:ecosystem": (req) => runVaultTests(req, "ecosystem", "tests/vault-journeys/tier-3-ecosystem.test.ts"),
};

export const commands = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
```

- [ ] **Step 4: Register the controller in main.ts**

In `src/main.ts`, add the import (with the other controller imports):
```typescript
import { commands as vaultTestCmds } from "./controller/vault-test.controller.js";
```

Then add the registration (with the other `registerDomain` calls around line 80-115):
```typescript
registry.registerDomain({ domain: "vault-test", commands: vaultTestCmds, projectFree: ["test:vault", "test:vault:smoke", "test:vault:integration", "test:vault:ecosystem"] });
```

- [ ] **Step 5: Run controller tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/controller/vault-test.controller.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 6: Run full type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/controller/vault-test.controller.ts" \
       "01 - Projects/Flowti CLI/tests/controller/vault-test.controller.test.ts" \
       "01 - Projects/Flowti CLI/src/main.ts"
git commit -m "feat(e2e): add vault-test controller with test:vault commands"
```

---

### Task 20: Create GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/vault-test.yml` (at vault root)

- [ ] **Step 1: Create the workflow file**

Create `C:\Projects\flowti\.github\workflows\vault-test.yml`:

```yaml
name: Vault Tests

on:
  push:
    branches: [master]
    paths:
      - "01 - Projects/Flowti CLI/src/**"
      - "01 - Projects/Flowti CLI/tests/vault-template/**"
      - "01 - Projects/Flowti CLI/tests/vault-journeys/**"
  pull_request:
    branches: [master]
  workflow_dispatch:

jobs:
  vault-tests:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: "01 - Projects/Flowti CLI"

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install CLI dependencies
        run: npm ci

      - name: Build CLI binary
        run: node configs/esbuild.config.mjs

      - name: Run unit tests
        run: npx vitest run --config configs/vitest.config.ts

      - name: Cache template vault node_modules
        uses: actions/cache@v4
        with:
          path: |
            01 - Projects/Flowti CLI/tests/vault-template/01 - Projects/Healthy App/node_modules
            01 - Projects/Flowti CLI/tests/vault-template/01 - Projects/Broken App/node_modules
          key: vault-template-${{ hashFiles('01 - Projects/Flowti CLI/tests/vault-template/**/package-lock.json') }}

      - name: Install Healthy App dependencies
        run: cd "tests/vault-template/01 - Projects/Healthy App" && npm ci

      - name: Install Broken App dependencies
        run: cd "tests/vault-template/01 - Projects/Broken App" && npm ci

      - name: "Tier 1: Smoke tests"
        run: npx vitest run --config configs/vitest.vault.config.ts tests/vault-journeys/tier-1-smoke.test.ts

      - name: "Tier 2: Integration tests"
        run: npx vitest run --config configs/vitest.vault.config.ts tests/vault-journeys/tier-2-integration.test.ts

      - name: "Tier 3: Ecosystem tests"
        run: npx vitest run --config configs/vitest.vault.config.ts tests/vault-journeys/tier-3-ecosystem.test.ts

      - name: Upload test report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: vault-testreport
          path: "01 - Projects/Flowti CLI/reports/tests/vault-testreport.json"
```

- [ ] **Step 2: Commit**

```bash
git add ".github/workflows/vault-test.yml"
git commit -m "ci: add vault test GitHub Actions workflow"
```

---

### Task 21: End-to-end verification

- [ ] **Step 1: Build the CLI binary**

Run: `cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs`
Expected: `.flowti/bin/main.js` produced

- [ ] **Step 2: Run full unit test suite to verify no regressions**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`
Expected: All 6,691+ tests pass

- [ ] **Step 3: Run Tier 1 smoke tests**

Run: `cd "01 - Projects/Flowti CLI" && npm run test:vault:smoke`
Expected: 3 journeys, all steps pass

- [ ] **Step 4: Run Tier 2 integration tests**

Run: `cd "01 - Projects/Flowti CLI" && npm run test:vault:integration`
Expected: 8 journeys. Some may fail if the CLI output format doesn't match expectations — iterate on journey definitions.

- [ ] **Step 5: Run Tier 3 ecosystem tests**

Run: `cd "01 - Projects/Flowti CLI" && npm run test:vault:ecosystem`
Expected: 4 journeys. These may need adjustments based on actual CLI state commands.

- [ ] **Step 6: Run all vault tests together**

Run: `cd "01 - Projects/Flowti CLI" && npm run test:vault`
Expected: All 15 journeys pass

- [ ] **Step 7: Run lint on all new source files**

Run: `cd "01 - Projects/Flowti CLI" && npx eslint src/domain/e2e/journey/providers/vault-test-provider.ts src/controller/vault-test.controller.ts --config configs/eslint.config.mjs`
Expected: No errors

- [ ] **Step 8: Final commit with any fixes**

```bash
git add -A "01 - Projects/Flowti CLI/"
git commit -m "feat(e2e): vault test environment complete — 3 tiers, 15 journeys"
```
