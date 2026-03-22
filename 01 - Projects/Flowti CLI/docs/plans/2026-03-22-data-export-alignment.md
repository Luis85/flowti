# Data Export & Type Alignment Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the agent dashboard export with economy + trust data, migrate `experience` → `xp`, align CLI/Plugin action types, and fix goals export shape.

**Architecture:** Read economy ledger and trust profiles in `exportAgentDashboardData()` (existing I/O function), pass an `EconomySnapshot` to the pure `buildDashboardAgent()` mapper. No new deps — `readLedger` and `loadTrustProfile` both take `{ disk, paths }` which is already `AgentExportDeps`. Plugin-side changes are field renames and fallback removal.

**Tech Stack:** TypeScript, Vitest, Node.js (CLI), Lit (Plugin)

**Spec:** `docs/specs/2026-03-22-data-export-alignment-design.md`

---

## File Map

### CLI (`01 - Projects/Flowti CLI/`)

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/domain/economy/leveling.ts` | Add `capabilitiesForLevel()` |
| Modify | `tests/domain/economy/leveling.test.ts` | Tests for `capabilitiesForLevel()` |
| Modify | `src/domain/agents/agent-export.ts` | Economy enrichment, drop `experience`, goals shape fix, new imports |
| Modify | `tests/domain/agents/agent-export.test.ts` | Economy enrichment tests, goals shape tests, no-experience tests |
| Modify | `src/domain/agents/world-state-types.ts` | Add 4 missing action types |

### Plugin (`01 - Projects/Flowti Plugin/`)

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/game/data/types.ts` | Drop `experience`, add `readonly` to economy fields |
| Modify | `src/game/brain/behavior-tree/bt-types.ts` | `experience` → `xp` on `BTAgentDef` + `BTAgentContext` |
| Modify | `src/game/brain/behavior-tree/bt-agent.ts` | `experience` → `xp` |
| Modify | `src/game/systems/bt-system.ts` | `experience` → `xp` |
| Modify | `src/game/config/world-state-agents.ts` | `experience` → `xp` |
| Modify | `src/game/config/agent-markdown-roster.ts` | `experience` → `xp` |
| Modify | `src/game/ui/panel-info.ts` | `experience` → `xp` |
| Modify | `src/game/ui/panel-economy.ts` | Remove `experience` fallback |
| Modify | `src/game/ui/panel-debug.ts` | Remove `experience` fallback |
| Modify | `src/game/engine-lifecycle.ts` | Remove `experience` fallback |
| Modify | `src/game/engine-events.ts` | Remove `experience` fallback |
| Modify | `tests/game/ui/panel-debug.test.ts` | Update fixture |
| Modify | `tests/game/config/world-state-agents.test.ts` | Update fixtures |
| Modify | `tests/game/config/agent-markdown-roster.test.ts` | Update fixtures |
| Modify | `tests/game/brain/behavior-tree/bt-agent.test.ts` | Update fixture |
| Modify | `tests/game/brain/behavior-tree/bt-agent-extensions.test.ts` | Update fixture |

---

## Chunk 1: CLI — capabilitiesForLevel + Economy Enrichment

### Task 1: Add `capabilitiesForLevel` to leveling.ts

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/domain/economy/leveling.ts:53-56`
- Test: `01 - Projects/Flowti CLI/tests/domain/economy/leveling.test.ts`

- [ ] **Step 1: Write failing tests**

In `tests/domain/economy/leveling.test.ts`, add a new `describe` block after the existing `isEligible` describe (line 67):

```typescript
describe("capabilitiesForLevel", () => {
	it("returns vault-read and simple-tasks for level 1", () => {
		expect(capabilitiesForLevel(1)).toEqual(["vault-read", "simple-tasks"]);
	});

	it("returns cumulative unlocks for level 4", () => {
		expect(capabilitiesForLevel(4)).toEqual([
			"vault-read", "simple-tasks",
			"standing-orders",
			"vault-write", "self-proposed",
			"delegation", "journey",
		]);
	});

	it("returns all unlocks for level 8", () => {
		expect(capabilitiesForLevel(8)).toHaveLength(13);
		expect(capabilitiesForLevel(8)).toContain("full-autonomy");
		expect(capabilitiesForLevel(8)).toContain("economy-influence");
	});

	it("returns empty for level 0", () => {
		expect(capabilitiesForLevel(0)).toEqual([]);
	});
});
```

Update the import on line 2 to include `capabilitiesForLevel`:

```typescript
import { levelForXp, xpForLevel, titleForLevel, isEligible, capabilitiesForLevel, LEVEL_TABLE } from "../../../src/domain/economy/leveling.js";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/economy/leveling.test.ts --config configs/vitest.config.ts`

Expected: FAIL — `capabilitiesForLevel` is not exported

- [ ] **Step 3: Implement capabilitiesForLevel**

In `src/domain/economy/leveling.ts`, add after the `isEligible` function (line 56):

```typescript
export function capabilitiesForLevel(level: number): string[] {
	const caps: string[] = [];
	for (const entry of LEVEL_TABLE) {
		if (level >= entry.level) {
			caps.push(...entry.unlocks);
		}
	}
	return caps;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/economy/leveling.test.ts --config configs/vitest.config.ts`

Expected: PASS — all leveling tests pass

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/economy/leveling.ts" "01 - Projects/Flowti CLI/tests/domain/economy/leveling.test.ts"
git commit -m "feat(economy): add capabilitiesForLevel helper"
```

---

### Task 2: Enrich DashboardAgent with economy + trust data

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/domain/agents/agent-export.ts:1-252`
- Test: `01 - Projects/Flowti CLI/tests/domain/agents/agent-export.test.ts`

- [ ] **Step 1: Write failing tests for buildDashboardAgent with economy**

In `tests/domain/agents/agent-export.test.ts`, add new tests inside the existing `describe("buildDashboardAgent")` block (after line 346):

```typescript
it("includes economy fields when economy snapshot is provided", () => {
	const agent = createMockAgent();
	const economy = { level: 3, xp: 350, coin: 50, tokens: 10, trustTier: "trusted" as const, capabilities: ["vault-read", "simple-tasks", "standing-orders", "vault-write", "self-proposed"] };
	const result = buildDashboardAgent(agent, { status: "idle" }, economy);
	expect(result.level).toBe(3);
	expect(result.xp).toBe(350);
	expect(result.coin).toBe(50);
	expect(result.tokens).toBe(10);
	expect(result.trustTier).toBe("trusted");
	expect(result.capabilities).toEqual(["vault-read", "simple-tasks", "standing-orders", "vault-write", "self-proposed"]);
});

it("economy fields are undefined when no snapshot provided", () => {
	const agent = createMockAgent();
	const result = buildDashboardAgent(agent, { status: "idle" });
	expect(result.level).toBeUndefined();
	expect(result.xp).toBeUndefined();
	expect(result.coin).toBeUndefined();
	expect(result.tokens).toBeUndefined();
	expect(result.trustTier).toBeUndefined();
	expect(result.capabilities).toBeUndefined();
});

it("does not include experience field", () => {
	const agent = createMockAgent({ experience: 500 });
	const economy = { level: 5, xp: 1000, coin: 100, tokens: 20, trustTier: "autonomous" as const, capabilities: [] };
	const result = buildDashboardAgent(agent, { status: "idle" }, economy);
	expect("experience" in result).toBe(false);
	expect(result.xp).toBe(1000);
});

it("includes name field in goals alongside text and priority", () => {
	const agent = createMockAgent({ goals: [{ name: "complete-review", priority: 2 }] });
	const result = buildDashboardAgent(agent, { status: "idle" });
	expect(result.goals).toEqual([{ name: "complete-review", text: "complete-review", priority: "2" }]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/agent-export.test.ts -t "buildDashboardAgent" --config configs/vitest.config.ts`

Expected: FAIL — `buildDashboardAgent` doesn't accept third arg, `experience` still present, goals missing `name`

- [ ] **Step 3: Update DashboardAgent interface and buildDashboardAgent**

In `src/domain/agents/agent-export.ts`:

**3a. Add imports** (after line 18):

```typescript
import { readLedger, getAccount } from "../economy/economy-ledger.js";
import { loadTrustProfile, deriveTier } from "../trust/trust-manager.js";
import { capabilitiesForLevel } from "../economy/leveling.js";
```

**3b. Add EconomySnapshot type** (after line 22, before `DashboardAgent`):

```typescript
interface EconomySnapshot {
	readonly level: number;
	readonly xp: number;
	readonly coin: number;
	readonly tokens: number;
	readonly trustTier: "supervised" | "trusted" | "autonomous";
	readonly capabilities: readonly string[];
}
```

**3c. Update DashboardAgent interface** — replace lines 24-42:

```typescript
export interface DashboardAgent {
	readonly name: string;
	readonly agentType: string;
	readonly domain?: string;
	readonly status: AgentStatus;
	readonly project?: string;
	readonly iteration?: string;
	readonly phase?: string;
	readonly persona?: string;
	readonly mood?: string;
	readonly personality?: readonly string[];
	readonly attributes?: AgentAttributes;
	readonly skills?: readonly AgentSkill[];
	readonly relationships?: readonly AgentRelationship[];
	readonly suggestedTasks?: readonly SuggestedTask[];
	readonly goals?: readonly { name: string; text: string; priority: string }[];
	readonly behaviors?: readonly string[];
	readonly level?: number;
	readonly xp?: number;
	readonly coin?: number;
	readonly tokens?: number;
	readonly trustTier?: "supervised" | "trusted" | "autonomous";
	readonly capabilities?: readonly string[];
}
```

Key changes: removed `experience`, added 6 economy fields, added `name` to goals type.

**3d. Update buildDashboardAgent** — replace lines 229-252:

```typescript
export function buildDashboardAgent(
	agent: AgentSummary,
	derived: { status: AgentStatus; project?: string; iteration?: string; phase?: string },
	economy?: EconomySnapshot,
): DashboardAgent {
	return {
		name: agent.name,
		agentType: agent.agentType,
		domain: agent.domain,
		status: derived.status,
		project: derived.project,
		iteration: derived.iteration,
		phase: derived.phase,
		persona: agent.persona,
		mood: agent.mood,
		personality: agent.personality,
		attributes: agent.attributes,
		skills: agent.skills.length > 0 ? agent.skills : undefined,
		relationships: agent.relationships,
		suggestedTasks: agent.suggestedTasks,
		goals: agent.goals?.map(g => ({ name: g.name, text: g.name, priority: String(g.priority ?? 0) })),
		behaviors: agent.behaviors,
		level: economy?.level,
		xp: economy?.xp,
		coin: economy?.coin,
		tokens: economy?.tokens,
		trustTier: economy?.trustTier,
		capabilities: economy?.capabilities ? [...economy.capabilities] : undefined,
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/agent-export.test.ts -t "buildDashboardAgent" --config configs/vitest.config.ts`

Expected: PASS

- [ ] **Step 5: Update existing tests that reference experience**

In `tests/domain/agents/agent-export.test.ts`:

**5a.** In the test "buildDashboardAgent includes RPG fields" (line 307), remove the `experience` assertions:

Replace:
```typescript
		expect(result.experience).toBe(150);
```

With:
```typescript
		expect("experience" in result).toBe(false);
```

**5b.** In the test "passes through optional RPG fields as undefined when not set" (line 334), remove the `experience` assertion:

Replace:
```typescript
		expect(result.experience).toBeUndefined();
```

With:
```typescript
		expect("experience" in result).toBe(false);
```

- [ ] **Step 6: Run full agent-export tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/agent-export.test.ts --config configs/vitest.config.ts`

Expected: PASS — all tests pass

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/agent-export.ts" "01 - Projects/Flowti CLI/tests/domain/agents/agent-export.test.ts"
git commit -m "feat(export): enrich DashboardAgent with economy + trust, drop experience, fix goals shape"
```

---

### Task 3: Wire economy enrichment into exportAgentDashboardData

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/domain/agents/agent-export.ts:193-227`
- Test: `01 - Projects/Flowti CLI/tests/domain/agents/agent-export.test.ts`

- [ ] **Step 1: Write failing test for enrichment**

In `tests/domain/agents/agent-export.test.ts`, add mocks for the new imports at the top of the file (after the existing `vi.mock` calls, before `import { agentStore }`):

```typescript
vi.mock("../../../src/domain/economy/economy-ledger.js", () => ({
	readLedger: vi.fn(() => ({ version: 1, updatedAt: "", accounts: {} })),
	getAccount: vi.fn(() => ({ xp: 0, level: 1, coin: 0, tokens: 0, totalEarned: { xp: 0, coin: 0 }, totalSpent: { coin: 0, tokens: 0 } })),
}));

vi.mock("../../../src/domain/trust/trust-manager.js", () => ({
	loadTrustProfile: vi.fn(() => ({ tier: "supervised", operations: {}, promotionLog: [] })),
	deriveTier: vi.fn(() => "supervised"),
}));

vi.mock("../../../src/domain/economy/leveling.js", () => ({
	capabilitiesForLevel: vi.fn(() => ["vault-read", "simple-tasks"]),
}));
```

Add imports for the mocked modules (after the existing module imports):

```typescript
import { readLedger, getAccount } from "../../../src/domain/economy/economy-ledger.js";
import { loadTrustProfile, deriveTier } from "../../../src/domain/trust/trust-manager.js";
import { capabilitiesForLevel } from "../../../src/domain/economy/leveling.js";
```

Add mock aliases:

```typescript
const mockReadLedger = vi.mocked(readLedger);
const mockGetAccount = vi.mocked(getAccount);
const mockLoadTrustProfile = vi.mocked(loadTrustProfile);
const mockDeriveTier = vi.mocked(deriveTier);
const mockCapabilitiesForLevel = vi.mocked(capabilitiesForLevel);
```

Add these tests inside the `describe("exportAgentDashboardData")` block (after line 218):

```typescript
it("enriches agents with economy data from ledger and trust profile", () => {
	mockListAgents.mockReturnValue([makeAgent("Bob", "ai")]);
	mockReadLedger.mockReturnValue({ version: 1, updatedAt: "", accounts: { Bob: { xp: 500, level: 4, coin: 80, tokens: 15, totalEarned: { xp: 500, coin: 80 }, totalSpent: { coin: 0, tokens: 0 } } } });
	mockGetAccount.mockReturnValue({ xp: 500, level: 4, coin: 80, tokens: 15, totalEarned: { xp: 500, coin: 80 }, totalSpent: { coin: 0, tokens: 0 } });
	mockDeriveTier.mockReturnValue("trusted");
	mockCapabilitiesForLevel.mockReturnValue(["vault-read", "simple-tasks", "standing-orders", "vault-write", "self-proposed", "delegation", "journey"]);

	const data = exportAgentDashboardData("/vault", undefined, [], mockDeps);
	expect(data.agents[0].level).toBe(4);
	expect(data.agents[0].xp).toBe(500);
	expect(data.agents[0].coin).toBe(80);
	expect(data.agents[0].tokens).toBe(15);
	expect(data.agents[0].trustTier).toBe("trusted");
	expect(data.agents[0].capabilities).toContain("delegation");
});

it("uses default economy values when no ledger entry exists", () => {
	mockListAgents.mockReturnValue([makeAgent("Eve", "ai")]);
	mockReadLedger.mockReturnValue({ version: 1, updatedAt: "", accounts: {} });
	mockGetAccount.mockReturnValue({ xp: 0, level: 1, coin: 0, tokens: 0, totalEarned: { xp: 0, coin: 0 }, totalSpent: { coin: 0, tokens: 0 } });
	mockDeriveTier.mockReturnValue("supervised");
	mockCapabilitiesForLevel.mockReturnValue(["vault-read", "simple-tasks"]);

	const data = exportAgentDashboardData("/vault", undefined, [], mockDeps);
	expect(data.agents[0].level).toBe(1);
	expect(data.agents[0].xp).toBe(0);
	expect(data.agents[0].trustTier).toBe("supervised");
});
```

Also add resets in the existing `beforeEach` block:

```typescript
mockReadLedger.mockReset();
mockGetAccount.mockReset();
mockLoadTrustProfile.mockReset();
mockDeriveTier.mockReset();
mockCapabilitiesForLevel.mockReset();
// Re-apply defaults after reset
mockReadLedger.mockReturnValue({ version: 1, updatedAt: "", accounts: {} });
mockGetAccount.mockReturnValue({ xp: 0, level: 1, coin: 0, tokens: 0, totalEarned: { xp: 0, coin: 0 }, totalSpent: { coin: 0, tokens: 0 } });
mockLoadTrustProfile.mockReturnValue({ tier: "supervised", operations: {} as never, promotionLog: [] });
mockDeriveTier.mockReturnValue("supervised");
mockCapabilitiesForLevel.mockReturnValue(["vault-read", "simple-tasks"]);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/agent-export.test.ts -t "enriches agents" --config configs/vitest.config.ts`

Expected: FAIL — `exportAgentDashboardData` doesn't call economy/trust functions yet

- [ ] **Step 3: Wire economy reads into exportAgentDashboardData**

In `src/domain/agents/agent-export.ts`, update `exportAgentDashboardData` (lines 193-227). Replace the function body:

```typescript
export function exportAgentDashboardData(
	vaultRoot: string,
	vaultAgentsConfig: AgentsConfig | undefined,
	projects: ProjectEntry[],
	deps: AgentExportDeps,
): DashboardData {
	const allAgents = agentStore.list(deps, vaultRoot, vaultAgentsConfig ? { dir: vaultAgentsConfig.dir } : undefined);

	const ledger = readLedger(deps, vaultRoot);

	const projectRosters = new Map<string, string[]>();
	const activeIterations = new Map<string, IterationSummary[]>();
	const dashboardProjects: DashboardProject[] = [];

	for (const project of projects) {
		const roster = project.config.management?.agents?.roster ?? [];
		if (roster.length > 0) {
			projectRosters.set(project.name, roster);
		}

		const iterations = listIterations(deps, project.path, project.config.management?.iterations);
		const active = iterations.filter((it) => BUSY_STATUSES.has(it.status));
		if (active.length > 0) {
			activeIterations.set(project.name, active);
		}

		const environment = buildProjectEnvironment(project, deps);
		dashboardProjects.push({ name: project.name, agents: roster, environment });
	}

	const dashboardAgents: DashboardAgent[] = allAgents.map((agent) => {
		const derived = deriveAgentStatus(agent.name, projectRosters, activeIterations);
		const account = getAccount(ledger, agent.name);
		const trust = loadTrustProfile(deps, vaultRoot, agent.name);
		const tier = deriveTier(trust);
		const caps = capabilitiesForLevel(account.level);
		const economy: EconomySnapshot = {
			level: account.level,
			xp: account.xp,
			coin: account.coin,
			tokens: account.tokens,
			trustTier: tier,
			capabilities: caps,
		};
		return buildDashboardAgent(agent, derived, economy);
	});

	return { agents: dashboardAgents, projects: dashboardProjects };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/agent-export.test.ts --config configs/vitest.config.ts`

Expected: PASS — all export tests pass

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/agent-export.ts" "01 - Projects/Flowti CLI/tests/domain/agents/agent-export.test.ts"
git commit -m "feat(export): wire economy ledger + trust profile into agent export pipeline"
```

---

### Task 4: Add missing action types to world-state-types.ts

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/domain/agents/world-state-types.ts:9-31`

- [ ] **Step 1: Add 4 missing action types**

In `src/domain/agents/world-state-types.ts`, replace lines 30-31:

```typescript
	| "seek-rest" | "seek-agent" | "seek-quiet" | "wander-sad"
	| "seek-merchant" | "merchant-purchase";
```

With:

```typescript
	| "seek-rest" | "seek-agent" | "seek-quiet" | "wander-sad"
	| "seek-merchant" | "merchant-purchase"
	| "seek-food" | "seek-drink"
	| "seek-preferred-food" | "seek-preferred-drink";
```

- [ ] **Step 2: Type-check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/world-state-types.ts"
git commit -m "feat(types): add seek-food, seek-drink action types to match Plugin"
```

---

### Task 5: Run full CLI test suite

- [ ] **Step 1: Run all tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts 2>&1 | tail -10`

Expected: All tests pass

- [ ] **Step 2: Run lint**

Run: `cd "01 - Projects/Flowti CLI" && npx eslint src/ --config configs/eslint.config.mjs`

Expected: 0 errors

- [ ] **Step 3: Build**

Run: `cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs`

Expected: Build succeeds

---

## Chunk 2: Plugin — experience → xp Migration

### Task 6: Update Plugin DashboardAgent type and BT types

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/data/types.ts:68-92`
- Modify: `01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/bt-types.ts:51-65,159-167`

- [ ] **Step 1: Update DashboardAgent — drop experience, add readonly to economy fields**

In `src/game/data/types.ts`, replace lines 68-92:

```typescript
export interface DashboardAgent {
	readonly name: string;
	readonly agentType: AgentType;
	readonly domain?: string;
	readonly status: "busy" | "idle" | "unassigned";
	readonly persona?: string;
	readonly mood?: string;
	readonly personality?: readonly string[];
	readonly attributes?: AgentAttributes;
	readonly skills?: readonly { name: string; level: string }[];
	readonly relationships?: readonly { target: string; type: string }[];
	readonly suggestedTasks?: readonly { name: string; phases: string[]; input?: { type: "text"; prompt: string }; tool?: { command: string } }[];
	readonly goals?: readonly { text: string; priority: string; name?: string }[];
	readonly behaviors?: readonly string[];
	readonly project?: string;
	readonly iteration?: string;
	readonly phase?: string;
	readonly level?: number;
	readonly coin?: number;
	readonly tokens?: number;
	readonly xp?: number;
	readonly trustTier?: "supervised" | "trusted" | "autonomous";
	readonly capabilities?: readonly string[];
}
```

Key changes: removed `experience`, made all economy fields `readonly`.

- [ ] **Step 2: Update BTAgentDef — experience → xp**

In `src/game/brain/behavior-tree/bt-types.ts`, replace line 58:

```typescript
	readonly experience?: number;
```

With:

```typescript
	readonly xp?: number;
```

- [ ] **Step 3: Update BTAgentContext — experience → xp**

In `src/game/brain/behavior-tree/bt-types.ts`, replace line 165:

```typescript
	readonly experience: number;
```

With:

```typescript
	readonly xp: number;
```

- [ ] **Step 4: Type-check to find all downstream breakages**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit`

Expected: Multiple errors where code references `experience` — this gives us the exact list for the next task.

- [ ] **Step 5: Commit types**

```bash
git add "01 - Projects/Flowti Plugin/src/game/data/types.ts" "01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/bt-types.ts"
git commit -m "feat(plugin): drop experience from DashboardAgent and BT types, use xp"
```

---

### Task 7: Fix all Plugin experience → xp references

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/bt-agent.ts:103`
- Modify: `01 - Projects/Flowti Plugin/src/game/systems/bt-system.ts:54`
- Modify: `01 - Projects/Flowti Plugin/src/game/config/world-state-agents.ts:68,80`
- Modify: `01 - Projects/Flowti Plugin/src/game/config/agent-markdown-roster.ts:156`
- Modify: `01 - Projects/Flowti Plugin/src/game/ui/panel-info.ts:288,296`
- Modify: `01 - Projects/Flowti Plugin/src/game/ui/panel-economy.ts:174`
- Modify: `01 - Projects/Flowti Plugin/src/game/ui/panel-debug.ts:328`
- Modify: `01 - Projects/Flowti Plugin/src/game/engine-lifecycle.ts:247`
- Modify: `01 - Projects/Flowti Plugin/src/game/engine-events.ts:522`

- [ ] **Step 1: Fix bt-agent.ts**

Find `experience: agent.experience ?? 0` (approx line 103) and replace with:

```typescript
xp: agent.xp ?? 0,
```

- [ ] **Step 2: Fix bt-system.ts**

Find `experience: agent.experience` (approx line 54) and replace with:

```typescript
xp: agent.xp ?? 0,
```

- [ ] **Step 3: Fix world-state-agents.ts**

The world-state entity components are written by the CLI's world-state-manager (out of scope), which may still write `experience` as the component key. Read both keys for compatibility and map to `xp`.

Replace line 68:
```typescript
const experience = typeof c["experience"] === "number" ? c["experience"] : undefined;
```
With:
```typescript
const xp = typeof c["xp"] === "number" ? c["xp"] : (typeof c["experience"] === "number" ? c["experience"] : undefined);
```

Replace line 80:
```typescript
...(experience !== undefined && { experience }),
```
With:
```typescript
...(xp !== undefined && { xp }),
```

- [ ] **Step 4: Fix agent-markdown-roster.ts**

Find `experience` frontmatter parse (approx line 156). The frontmatter field in agent markdown files is still called `experience` — parse it and map to `xp`:

Replace the `experience` field assignment with:

```typescript
xp: frontmatter.experience ? Number(frontmatter.experience) : undefined,
```

- [ ] **Step 5: Fix panel-info.ts**

Find destructuring of `experience` (approx line 288) and replace with `xp`. Find `renderXp(experience)` call (approx line 296) and replace with `renderXp(xp)`.

**Deferred:** `panel-info.ts` has its own `renderXp()` with a simplified leveling formula (`Math.floor(xp / 100)`) that duplicates `panel-economy.ts`'s proper `LEVEL_TABLE`-based rendering. Simplifying or removing that duplicate is out of scope — file as follow-on work.

- [ ] **Step 6: Fix panel-economy.ts**

Find `this.agent.xp ?? this.agent.experience ?? 0` (approx line 174) and simplify to:

```typescript
this.agent.xp ?? 0
```

- [ ] **Step 7: Fix panel-debug.ts**

Find `this.agent!.xp ?? this.agent!.experience ?? 0` (approx line 328) and simplify to:

```typescript
this.agent!.xp ?? 0
```

- [ ] **Step 8: Fix engine-lifecycle.ts**

Find `a.xp ?? a.experience ?? 0` (approx line 247) and simplify to:

```typescript
a.xp ?? 0
```

- [ ] **Step 9: Fix engine-events.ts**

Find `agent?.experience ?? 0` (approx line 522) and replace with:

```typescript
agent?.xp ?? 0
```

- [ ] **Step 10: Type-check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit`

Expected: 0 errors

- [ ] **Step 11: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/"
git commit -m "refactor(plugin): migrate all experience references to xp"
```

---

### Task 8: Update Plugin test fixtures

**Files:**
- Modify: `01 - Projects/Flowti Plugin/tests/game/ui/panel-debug.test.ts:80`
- Modify: `01 - Projects/Flowti Plugin/tests/game/config/world-state-agents.test.ts:84,97,108,125`
- Modify: `01 - Projects/Flowti Plugin/tests/game/config/agent-markdown-roster.test.ts:72,76,78,81,88`
- Modify: `01 - Projects/Flowti Plugin/tests/game/brain/behavior-tree/bt-agent.test.ts:25`
- Modify: `01 - Projects/Flowti Plugin/tests/game/brain/behavior-tree/bt-agent-extensions.test.ts:18`

- [ ] **Step 1: Update all test fixtures**

In each test file, find `experience:` in agent fixtures and rename to `xp:`. Find any assertion checking `experience` and rename to `xp`.

Use grep to find all occurrences:

Run: `cd "01 - Projects/Flowti Plugin" && npx grep -rn "experience" tests/ --include="*.ts" | grep -v node_modules`

Fix each occurrence. The exact change is `experience` → `xp` in fixture objects and assertions.

- [ ] **Step 2: Run Plugin tests**

Run: `cd "01 - Projects/Flowti Plugin" && npm test`

Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/tests/"
git commit -m "test(plugin): update fixtures for experience → xp migration"
```

---

### Task 9: Final verification

- [ ] **Step 1: Run CLI tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts 2>&1 | tail -10`

Expected: All tests pass

- [ ] **Step 2: Run Plugin tests**

Run: `cd "01 - Projects/Flowti Plugin" && npm test`

Expected: All tests pass

- [ ] **Step 3: Build both projects**

```bash
cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs
```

```bash
cd "01 - Projects/Flowti Plugin" && npm run build
```

Expected: Both builds succeed

- [ ] **Step 4: Lint CLI**

Run: `cd "01 - Projects/Flowti CLI" && npx eslint src/ --config configs/eslint.config.mjs`

Expected: 0 errors

- [ ] **Step 5: Commit any fix-ups**

If any fixes were needed:

```bash
git add "01 - Projects/"
git commit -m "fix: address lint and type issues from data export alignment"
```
