# Hooks & Skill Map Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Claude Code hooks for file protection and auto-linting, plus domain-mapped skill injection into agent briefs and SKILL.md sync output.

**Architecture:** Two independent workstreams. Workstream 1 (hooks) is pure config/scripts — no TypeScript. Workstream 2 (skill map) adds a `skillMap` config field and threads it through `claude-sync.ts` and `brief-store.ts` via their callers. Domain purity preserved — callers resolve `skillMap[domain]` before passing to domain functions.

**Tech Stack:** Bash (hooks), TypeScript (skill map), Vitest (tests)

---

## Chunk 1: Hooks (Config + Scripts)

### Task 1: Create hook scripts

**Files:**
- Create: `.claude/hooks/block-sensitive-files.sh`
- Create: `.claude/hooks/auto-lint.sh`
- Create: `.claude/hooks/auto-typecheck.sh`

- [ ] **Step 1: Create the hooks directory**

Run: `mkdir -p .claude/hooks`

- [ ] **Step 2: Write block-sensitive-files.sh**

```bash
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FILE=$(node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(j.tool_input.file_path||'')" 2>/dev/null)
case "$FILE" in
  *.env|*.env.*) echo "BLOCKED: Cannot edit $FILE — contains secrets" >&2; exit 1;;
  *package-lock.json|*pnpm-lock.yaml) echo "BLOCKED: Cannot edit lock file $FILE" >&2; exit 1;;
esac
```

- [ ] **Step 3: Write auto-lint.sh**

```bash
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/../../01 - Projects/Flowti CLI"
FILE=$(node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(j.tool_input.file_path||'')" 2>/dev/null)
case "$FILE" in
  */Flowti\ CLI/src/*.ts)
    cd "$PROJECT_DIR" && npx eslint --config configs/eslint.config.mjs "$FILE" 2>&1;;
esac
```

- [ ] **Step 4: Write auto-typecheck.sh**

```bash
#!/bin/bash
set -o pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/../../01 - Projects/Flowti CLI"
FILE=$(node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(j.tool_input.file_path||'')" 2>/dev/null)
case "$FILE" in
  */Flowti\ CLI/src/*.ts|*/Flowti\ CLI/tests/*.ts)
    cd "$PROJECT_DIR" && npx tsc --noEmit --project configs/tsconfig.json 2>&1 | tail -10;;
esac
```

- [ ] **Step 5: Commit hook scripts**

```bash
git add .claude/hooks/block-sensitive-files.sh .claude/hooks/auto-lint.sh .claude/hooks/auto-typecheck.sh
git commit -m "feat: add Claude Code hook scripts for file protection and auto-lint/typecheck"
```

### Task 2: Configure hooks in settings.json

**Files:**
- Modify: `.claude/settings.json`

- [ ] **Step 1: Add hooks config to settings.json**

Add the `hooks` key alongside existing `enabledPlugins`:

```json
{
  "enabledPlugins": {
    "superpowers@claude-plugins-official": true,
    "feature-dev@claude-plugins-official": true,
    "ralph-loop@claude-plugins-official": true,
    "skill-creator@claude-plugins-official": true,
    "claude-code-setup@claude-plugins-official": true
  },
  "hooks": {
    "PreToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [{ "type": "command", "command": "bash .claude/hooks/block-sensitive-files.sh" }]
    }],
    "PostToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [
        { "type": "command", "command": "bash .claude/hooks/auto-lint.sh" },
        { "type": "command", "command": "bash .claude/hooks/auto-typecheck.sh" }
      ]
    }]
  }
}
```

- [ ] **Step 2: Commit settings change**

```bash
git add .claude/settings.json
git commit -m "feat: configure Claude Code hooks for edit protection and auto-lint/typecheck"
```

---

## Chunk 2: Skill Map — Type + Config

### Task 3: Add skillMap to AgentsConfig type

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/infrastructure/types-config.ts:222`
- Test: type-check only

- [ ] **Step 1: Write the failing type-check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: PASS (baseline — no changes yet)

- [ ] **Step 2: Add skillMap field to AgentsConfig**

In `src/infrastructure/types-config.ts:222`, change:

```typescript
export interface AgentsConfig { dir?: string; roster?: string[]; autonomous?: boolean; claudeSync?: boolean; }
```

to:

```typescript
export interface AgentsConfig { dir?: string; roster?: string[]; autonomous?: boolean; claudeSync?: boolean; skillMap?: Record<string, string[]>; }
```

- [ ] **Step 3: Verify type-check passes**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/types-config.ts"
git commit -m "feat: add skillMap field to AgentsConfig interface"
```

### Task 4: Add skillMap config data

**Files:**
- Modify: `.flowti/config.json`

- [ ] **Step 1: Add skillMap to .flowti/config.json**

Add `skillMap` under the existing `agents` section:

```json
{
  "agents": {
    "dir": "03 - Resources/Agents",
    "claudeSync": true,
    "skillMap": {
      "engineering": [
        "superpowers:test-driven-development",
        "superpowers:systematic-debugging",
        "superpowers:requesting-code-review",
        "superpowers:verification-before-completion"
      ],
      "design": [
        "superpowers:brainstorming",
        "superpowers:writing-plans",
        "feature-dev:feature-dev"
      ],
      "product": [
        "superpowers:brainstorming",
        "superpowers:writing-plans"
      ],
      "management": [
        "superpowers:dispatching-parallel-agents",
        "superpowers:writing-plans",
        "superpowers:executing-plans"
      ],
      "quality": [
        "superpowers:requesting-code-review",
        "superpowers:verification-before-completion"
      ],
      "analysis": [
        "superpowers:brainstorming",
        "superpowers:writing-plans"
      ],
      "operations": [
        "superpowers:verification-before-completion",
        "superpowers:finishing-a-development-branch"
      ],
      "orchestration": [
        "superpowers:dispatching-parallel-agents",
        "superpowers:brainstorming",
        "superpowers:writing-plans",
        "superpowers:executing-plans"
      ]
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add .flowti/config.json
git commit -m "feat: add domain-to-skill mappings in vault config"
```

### Task 5: Add skillMap validation to config validators

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/domain/project/config-validators-review.ts:121-133`
- Test: `01 - Projects/Flowti CLI/tests/domain/project/config-validators-review.test.ts`

- [ ] **Step 1: Write failing tests for skillMap validation**

This test file may not exist yet. If it does, add to the `validateAgentsRoster` describe block. If not, create it with the standard mock boilerplate (see `tests/domain/project/` for patterns), import `validateAgentsRoster` from `../../../src/domain/project/config-validators-review.js`, and wrap in a `describe("validateAgentsRoster")` block. Note: `validateAgentsRoster` is not currently exported — you'll need to either export it or test it indirectly via `validateProjectConfig`. If the function is not exported, test through the public `validateProjectConfig` function by passing a config object with `management.agents.skillMap`.

Tests to add:

```typescript
it("accepts valid skillMap", () => {
	const w: string[] = [];
	validateAgentsRoster({ skillMap: { engineering: ["superpowers:tdd"] } }, w);
	expect(w).toEqual([]);
});

it("warns when skillMap value is not an array", () => {
	const w: string[] = [];
	validateAgentsRoster({ skillMap: { engineering: "not-an-array" } }, w);
	expect(w.length).toBeGreaterThan(0);
	expect(w[0]).toContain("skillMap");
});

it("warns when skillMap value contains empty strings", () => {
	const w: string[] = [];
	validateAgentsRoster({ skillMap: { engineering: ["valid", ""] } }, w);
	expect(w.length).toBeGreaterThan(0);
	expect(w[0]).toContain("skillMap");
});

it("warns when skillMap key is empty string", () => {
	const w: string[] = [];
	validateAgentsRoster({ skillMap: { "": ["superpowers:tdd"] } }, w);
	expect(w.length).toBeGreaterThan(0);
	expect(w[0]).toContain("skillMap");
});

it("skips validation when skillMap is undefined", () => {
	const w: string[] = [];
	validateAgentsRoster({}, w);
	expect(w).toEqual([]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/project/config-validators-review.test.ts --config configs/vitest.config.ts`
Expected: FAIL (new tests fail because validation logic doesn't exist yet)

- [ ] **Step 3: Implement skillMap validation**

In `src/domain/project/config-validators-review.ts`, after the `validateAgentsRoster` function (line 121-133), add skillMap validation inside the function body, after the roster validation:

```typescript
function validateAgentsRoster(agents: Record<string, unknown>, warnings: string[]): void {
	expectType(agents, "autonomous", "boolean", "management.agents", warnings);
	if (agents.roster === undefined) return; // existing early return — REMOVE THIS
	if (agents.roster !== undefined) {
		if (!Array.isArray(agents.roster)) {
			warnings.push('"management.agents.roster" must be an array of strings.');
		} else {
			for (let i = 0; i < agents.roster.length; i++) {
				if (typeof agents.roster[i] !== "string" || (agents.roster[i] as string).length === 0) {
					warnings.push(`management.agents.roster[${i}]: must be a non-empty string.`);
				}
			}
		}
	}
	if (agents.skillMap !== undefined) {
		if (typeof agents.skillMap !== "object" || agents.skillMap === null || Array.isArray(agents.skillMap)) {
			warnings.push('"management.agents.skillMap" must be an object mapping domains to skill arrays.');
		} else {
			const map = agents.skillMap as Record<string, unknown>;
			for (const [key, value] of Object.entries(map)) {
				if (key.length === 0) {
					warnings.push('management.agents.skillMap: domain key must be a non-empty string.');
				}
				if (!Array.isArray(value)) {
					warnings.push(`management.agents.skillMap.${key}: must be an array of strings.`);
				} else {
					for (let i = 0; i < value.length; i++) {
						if (typeof value[i] !== "string" || (value[i] as string).length === 0) {
							warnings.push(`management.agents.skillMap.${key}[${i}]: must be a non-empty string.`);
						}
					}
				}
			}
		}
	}
}
```

Note: The existing early `return` after roster check (`if (agents.roster === undefined) return;`) must be removed so skillMap validation runs even when roster is not set. Wrap the roster block in `if (agents.roster !== undefined)` instead.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/project/config-validators-review.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Run ALL config validator tests to check for regressions**

The early `return` removal could affect existing tests. Run:
`cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/project/ --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/project/config-validators-review.ts" "01 - Projects/Flowti CLI/tests/domain/project/config-validators-review.test.ts"
git commit -m "feat: validate skillMap shape in config validators"
```

---

## Chunk 3: Skill Map — claude-sync.ts Injection

### Task 6: Inject skill map into SKILL.md generation

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/domain/claude-sync/claude-sync.ts:47-116`
- Test: `01 - Projects/Flowti CLI/tests/domain/claude-sync/claude-sync.test.ts`

- [ ] **Step 1: Write failing tests**

Add to the existing test file:

```typescript
describe("generateAgentSkillContent — skillMap", () => {
	it("appends Recommended Skills when agent domain matches skillMap", () => {
		const agent = makeAgent({ domain: "engineering" });
		const skillMap = { engineering: ["superpowers:test-driven-development", "superpowers:systematic-debugging"] };
		const content = generateAgentSkillContent([agent], "/agents", makeDeps(), skillMap);
		expect(content).toContain("**Recommended Skills**:");
		expect(content).toContain("`/superpowers:test-driven-development`");
		expect(content).toContain("`/superpowers:systematic-debugging`");
	});

	it("omits Recommended Skills when agent has no domain", () => {
		const agent = makeAgent({ domain: undefined });
		const skillMap = { engineering: ["superpowers:tdd"] };
		const content = generateAgentSkillContent([agent], "/agents", makeDeps(), skillMap);
		expect(content).not.toContain("Recommended Skills");
	});

	it("omits Recommended Skills when domain not in skillMap", () => {
		const agent = makeAgent({ domain: "design" });
		const skillMap = { engineering: ["superpowers:tdd"] };
		const content = generateAgentSkillContent([agent], "/agents", makeDeps(), skillMap);
		expect(content).not.toContain("Recommended Skills");
	});

	it("omits Recommended Skills when skillMap is undefined", () => {
		const agent = makeAgent({ domain: "engineering" });
		const content = generateAgentSkillContent([agent], "/agents", makeDeps(), undefined);
		expect(content).not.toContain("Recommended Skills");
	});

	it("omits Recommended Skills when skillMap is empty", () => {
		const agent = makeAgent({ domain: "engineering" });
		const content = generateAgentSkillContent([agent], "/agents", makeDeps(), {});
		expect(content).not.toContain("Recommended Skills");
	});

	it("omits Recommended Skills when skills array is empty", () => {
		const agent = makeAgent({ domain: "engineering" });
		const content = generateAgentSkillContent([agent], "/agents", makeDeps(), { engineering: [] });
		expect(content).not.toContain("Recommended Skills");
	});

	it("renders multiple agents with different domains correctly", () => {
		const eng = makeAgent({ name: "Dev", domain: "engineering" });
		const des = makeAgent({ name: "UX", domain: "design", file: "ux.md" });
		const skillMap = {
			engineering: ["superpowers:tdd"],
			design: ["superpowers:brainstorming"],
		};
		const content = generateAgentSkillContent([eng, des], "/agents", makeDeps(), skillMap);
		expect(content).toContain("`/superpowers:tdd`");
		expect(content).toContain("`/superpowers:brainstorming`");
	});

	it("auto-generates human-readable description from slug", () => {
		const agent = makeAgent({ domain: "engineering" });
		const skillMap = { engineering: ["superpowers:test-driven-development"] };
		const content = generateAgentSkillContent([agent], "/agents", makeDeps(), skillMap);
		expect(content).toContain("Test driven development");
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/claude-sync/claude-sync.test.ts --config configs/vitest.config.ts`
Expected: FAIL (generateAgentSkillContent doesn't accept 4th param yet)

- [ ] **Step 3: Add skillMap parameter and rendering logic**

In `src/domain/claude-sync/claude-sync.ts`:

Add a helper function after the existing helpers (after line 43):

```typescript
function slugToLabel(slug: string): string {
	const name = slug.includes(":") ? slug.split(":").pop()! : slug;
	return name.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function appendSkillMap(lines: string[], domain: string | undefined, skillMap?: Record<string, string[]>): void {
	if (!domain || !skillMap) return;
	const skills = skillMap[domain];
	if (!skills || skills.length === 0) return;
	lines.push("**Recommended Skills**:");
	for (const slug of skills) lines.push(`- \`/${slug}\` — ${slugToLabel(slug)}`);
	lines.push("");
}
```

Update `agentDetailBlock` signature (line 47) to accept and use skillMap:

```typescript
function agentDetailBlock(agent: AgentSummary, prompt: string | null, skillMap?: Record<string, string[]>): string {
```

Add `appendSkillMap(lines, agent.domain, skillMap);` before the prompt section (before line 73).

Update `generateAgentSkillContent` signature (line 82):

```typescript
export function generateAgentSkillContent(agents: AgentSummary[], agentsDir: string, deps: ClaudeSyncDeps, skillMap?: Record<string, string[]>): string {
```

Update the detail section loop (line 112) to pass skillMap:

```typescript
lines.push(agentDetailBlock(agent, prompt, skillMap));
```

Update `syncAgentsToClaude` (line 182) to accept and pass skillMap:

```typescript
export function syncAgentsToClaude(deps: ClaudeSyncDeps, vaultRoot: string, agentsDir: string, agents: AgentSummary[], skillMap?: Record<string, string[]>): ClaudeSyncResult {
	const content = generateAgentSkillContent(agents, agentsDir, deps, skillMap);
```

Update `syncAllToClaude` (line 200) to accept and pass skillMap:

```typescript
export function syncAllToClaude(
	deps: ClaudeSyncDeps, vaultRoot: string, agentsDir: string,
	agents: AgentSummary[], tools: LoadedAiTool[], skillMap?: Record<string, string[]>,
): ClaudeSyncResult {
	const agentResult = syncAgentsToClaude(deps, vaultRoot, agentsDir, agents, skillMap);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/claude-sync/claude-sync.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Run full type-check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/claude-sync/claude-sync.ts" "01 - Projects/Flowti CLI/tests/domain/claude-sync/claude-sync.test.ts"
git commit -m "feat: inject recommended skills into SKILL.md based on agent domain"
```

### Task 7: Thread skillMap through claude-sync callers

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/controller/claude-sync.controller.ts:26`
- Modify: `01 - Projects/Flowti CLI/src/ui/handlers/extensibility-handlers.ts:86-91`

- [ ] **Step 1: Update claude-sync.controller.ts**

At line 26, pass `cliConfig.agents?.skillMap` to `syncAllToClaude`:

```typescript
const result = syncAllToClaude(req.deps, VAULT_ROOT, agentsDir, agents, tools, cliConfig.agents?.skillMap);
```

- [ ] **Step 2: Update maybeSyncAgents in extensibility-handlers.ts**

At line 90, pass `cliConfig.agents?.skillMap` to `syncAgentsToClaude`:

```typescript
syncAgentsToClaude(ctx.deps, VAULT_ROOT, agentsDir, agents, cliConfig.agents?.skillMap);
```

- [ ] **Step 3: Run type-check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: PASS

- [ ] **Step 4: Run existing tests to verify no regressions**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/claude-sync/claude-sync.test.ts tests/ui/handlers/extensibility-handlers.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/controller/claude-sync.controller.ts" "01 - Projects/Flowti CLI/src/ui/handlers/extensibility-handlers.ts"
git commit -m "feat: pass skillMap from vault config to claude-sync functions"
```

---

## Chunk 4: Skill Map — brief-store.ts Injection

### Task 8: Add availableSkills to BriefContext and generate skills section

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/domain/agents/brief-store.ts:30-41, 205-225`
- Test: `01 - Projects/Flowti CLI/tests/domain/agents/brief-store.test.ts`

- [ ] **Step 1: Write failing tests**

Add to the existing brief-store test file (or create if it doesn't exist at that path — check `tests/domain/agents/` for the right file):

```typescript
describe("generateBrief — availableSkills", () => {
	it("includes Available Skills section when availableSkills provided", () => {
		const ctx = makeContext({ availableSkills: ["superpowers:test-driven-development", "superpowers:systematic-debugging"] });
		const brief = generateBrief(ctx);
		expect(brief).toContain("## Available Skills");
		expect(brief).toContain("`/superpowers:test-driven-development`");
		expect(brief).toContain("`/superpowers:systematic-debugging`");
	});

	it("omits Available Skills section when availableSkills is undefined", () => {
		const ctx = makeContext({ availableSkills: undefined });
		const brief = generateBrief(ctx);
		expect(brief).not.toContain("Available Skills");
	});

	it("omits Available Skills section when availableSkills is empty", () => {
		const ctx = makeContext({ availableSkills: [] });
		const brief = generateBrief(ctx);
		expect(brief).not.toContain("Available Skills");
	});

	it("renders skills with / prefix in invocation format", () => {
		const ctx = makeContext({ availableSkills: ["feature-dev:feature-dev"] });
		const brief = generateBrief(ctx);
		expect(brief).toContain("`/feature-dev:feature-dev`");
	});

	it("places Available Skills after Your Role section", () => {
		const ctx = makeContext({ availableSkills: ["superpowers:brainstorming"] });
		const brief = generateBrief(ctx);
		const roleIdx = brief.indexOf("## Your Role");
		const skillsIdx = brief.indexOf("## Available Skills");
		const systemIdx = brief.indexOf("## System Prompt");
		expect(skillsIdx).toBeGreaterThan(roleIdx);
		if (systemIdx > -1) expect(skillsIdx).toBeLessThan(systemIdx);
	});
});
```

Note: You'll need to adapt the `makeContext` helper to match whatever test helper pattern already exists in the brief-store test file. Use the existing `IterationSummary` mock.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/brief-store.test.ts --config configs/vitest.config.ts`
Expected: FAIL

- [ ] **Step 3: Add availableSkills to BriefContext**

In `src/domain/agents/brief-store.ts:30-41`, add the field to `BriefContext`:

```typescript
export interface BriefContext {
	readonly agentName: string;
	readonly agentDescription?: string;
	readonly agentSkills?: readonly string[];
	readonly agentRoles?: readonly string[];
	readonly systemPrompt?: string | null;
	readonly iteration: IterationSummary;
	readonly iterationTemplate?: LifecycleTemplate;
	readonly rosterAgents?: readonly RosterEntry[];
	readonly orchestration?: OrchestrationConfig;
	readonly availableSkills?: readonly string[];
}
```

- [ ] **Step 4: Add the slug-to-label helper and appendAvailableSkills function**

Add after the existing section builders (after `appendRole`, around line 250):

```typescript
function skillSlugToLabel(slug: string): string {
	const name = slug.includes(":") ? slug.split(":").pop()! : slug;
	return name.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function appendAvailableSkills(lines: string[], skills?: readonly string[]): void {
	if (!skills || skills.length === 0) return;
	lines.push("## Available Skills", "");
	lines.push("You have access to the following skills that can help with your work.");
	lines.push("Use them when the task benefits from a structured approach:", "");
	for (const slug of skills) lines.push(`- \`/${slug}\` — ${skillSlugToLabel(slug)}`);
	lines.push("");
}
```

- [ ] **Step 5: Call appendAvailableSkills in generateBrief**

In `generateBrief()` (line 205-225), add the call after `appendRole` and before `appendSystemPrompt`:

```typescript
export function generateBrief(ctx: BriefContext): string {
	const lines: string[] = [];
	const phase = ctx.iteration.status;
	appendFrontmatter(lines, ctx.agentName, ctx.iteration.number, phase);
	appendHeader(lines, ctx.agentName, ctx.iteration.number, ctx.orchestration);
	appendRole(lines, ctx);
	appendAvailableSkills(lines, ctx.availableSkills);  // NEW
	appendSystemPrompt(lines, ctx.systemPrompt, ctx.rosterAgents);
	// ...rest unchanged
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/brief-store.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/brief-store.ts" "01 - Projects/Flowti CLI/tests/domain/agents/brief-store.test.ts"
git commit -m "feat: inject available skills into agent briefs based on domain"
```

### Task 9: Thread availableSkills through brief callers

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/ui/handlers/iteration-handlers.ts:71-74, 120-123`
- Modify: `01 - Projects/Flowti CLI/src/ui/menus/agents-run-menu.ts:19`
- Modify: `01 - Projects/Flowti CLI/src/ui/menus/roster-task-menu.ts:56-60`

- [ ] **Step 1: Update generateIterationBrief in iteration-handlers.ts**

At line 71-74, add `availableSkills` to the `generateBrief` call. First resolve the skills from config. Note: `VAULT_ROOT`/`cliConfig` are used inside `resolveAgentPrompt` and `resolveAgentDetails` but via their own dynamic imports — they are not in scope here. You need your own dynamic imports:

```typescript
async function generateIterationBrief(ctx: RouterContext): Promise<string | null> {
	// ...existing code through line 70 (systemPrompt, details, template are resolved)...
	const { VAULT_ROOT, cliConfig } = await import("../../infrastructure/config.js");
	const { findAgent } = await import("../../domain/agents/agent-store.js");
	const agentDef = findAgent(ctx.deps, VAULT_ROOT, active.name, cliConfig.agents);
	const availableSkills = cliConfig.agents?.skillMap?.[agentDef?.domain ?? ""];
	const brief = generateBrief({
		agentName: active.name, agentDescription: details?.description, agentSkills: details?.skills, agentRoles: details?.roles,
		systemPrompt, iteration, iterationTemplate: template ?? undefined, availableSkills,
	});
```

- [ ] **Step 2: Update writeFullBrief in iteration-handlers.ts**

At line 120-123, add `availableSkills`:

```typescript
const agentDef = (await import("../../domain/agents/agent-store.js")).findAgent(ctx.deps, VAULT_ROOT, agent.name, cliConfig.agents);
const availableSkills = cliConfig.agents?.skillMap?.[agentDef?.domain ?? ""];
const brief = generateBrief({
	agentName: agent.name, agentDescription: agent.description,
	agentSkills: agent.skills.map((s) => s.name), agentRoles: agent.roles,
	systemPrompt, iteration, iterationTemplate: template, orchestration: config?.orchestration, rosterAgents, availableSkills,
});
```

- [ ] **Step 3: Update runAgentInteractive in agents-run-menu.ts**

At line 19, the `generateBrief` call needs `availableSkills`. The function doesn't currently have access to vault config. Add a new optional parameter:

```typescript
export async function runAgentInteractive(
	agent: AgentSummary, iteration: IterationSummary, iterDir: string,
	autonomous: boolean, deps: RunMenuDeps, stateFilePath?: string, availableSkills?: readonly string[],
): Promise<void> {
	const { generateBrief, saveBrief } = await import("../../domain/agents/brief-store.js");
	const brief = generateBrief({ agentName: agent.name, agentDescription: agent.description, agentSkills: agent.skills.map((s) => s.name), agentRoles: agent.roles, systemPrompt: agent.ai?.systemPrompt, iteration, availableSkills });
```

Then update the caller in `extensibility-handlers.ts` (`runAgentAfterInteraction`, line 66):

```typescript
const availableSkills = cliConfig.agents?.skillMap?.[agent.domain ?? ""];
await runAgentInteractive(agent, iteration, iterDir, autonomous, ctx.deps, stateFilePath, availableSkills);
```

- [ ] **Step 4: Update rosterTaskInteractive in roster-task-menu.ts**

At line 56-60, add `availableSkills`:

```typescript
const availableSkills = opts.agentsConfig?.skillMap?.[agent.domain ?? ""];
const brief = generateBrief({
	agentName: agent.name, agentDescription: agent.description,
	agentSkills: agent.skills.map((s) => s.name), agentRoles: agent.roles,
	systemPrompt: readSystemPrompt(deps, opts.vaultRoot, agent.name, opts.agentsConfig),
	iteration, iterationTemplate: opts.template, rosterAgents, availableSkills,
});
```

- [ ] **Step 5: Run type-check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: PASS

- [ ] **Step 6: Run full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`
Expected: PASS (all existing + new tests)

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/ui/handlers/iteration-handlers.ts" "01 - Projects/Flowti CLI/src/ui/menus/agents-run-menu.ts" "01 - Projects/Flowti CLI/src/ui/menus/roster-task-menu.ts" "01 - Projects/Flowti CLI/src/ui/handlers/extensibility-handlers.ts"
git commit -m "feat: thread availableSkills from vault config through all brief generation callers"
```

---

## Chunk 5: Verification

### Task 10: Run claude:sync and verify output

- [ ] **Step 1: Run full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npm test`
Expected: PASS (lint + tsc + vitest)

- [ ] **Step 2: Build the CLI**

Run: `cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs`
Expected: Build succeeds

- [ ] **Step 3: Run claude:sync and inspect output**

Run: `.\flowti.cmd claude:sync`
Then inspect `.claude/skills/agents/SKILL.md` — verify agents with domains have "Recommended Skills" sections.

- [ ] **Step 4: Verify a generated brief**

Generate a brief for any agent (e.g., via `flowti agents` menu → pick agent → Run Agent) and verify it contains the "Available Skills" section with the correct domain-mapped skills.

- [ ] **Step 5: Final commit if any cleanup needed**

Stage only the specific files that changed during verification (do not use `git add -A`). If no cleanup was needed, skip this step.
