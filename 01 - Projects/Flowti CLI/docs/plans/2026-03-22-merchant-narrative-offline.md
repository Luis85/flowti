# Merchant, Narrative & Offline Progress — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Merchant NPC purchase UI, emergent narrative log (vault markdown per day cycle), and offline progress simulation with narrative briefing on return.

**Architecture:** Plugin-side implementation. Three systems (NarrativeSystem, OfflineProgress, MerchantSystem) integrate with existing game engine via EngineContext. Lit components for UI. Dialogue integration via ConversationEngine + TalkEngine + FragmentComposer. CLI remains data authority — Plugin calls CLI commands for economy mutations.

**Tech Stack:** TypeScript (Lit, ExcaliburJS), Vitest, existing Plugin patterns (FlowtiElement, DashboardStore, EngineContext)

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-22-merchant-narrative-offline-design.md`

**Commands (run from `01 - Projects/Flowti Plugin/`):**

```bash
# Run single test
npx vitest run tests/game/systems/narrative-system.test.ts

# Run all game tests
npx vitest run tests/game/

# Type check
npx tsc -noEmit -skipLibCheck

# Full check
npm test

# Dev build with hot-reload
npm run build:dev
```

---

## File Map

### New Files (Create)

| File | Purpose |
|------|---------|
| `src/game/systems/narrative-system.ts` | Beat collection, story composition, vault markdown output |
| `src/game/data/narrative-templates.ts` | Story fragment templates by event category |
| `src/game/systems/offline-progress.ts` | Bounded simulation of agent work while away |
| `src/game/ui/briefing-panel.ts` | Lit component: Merchant NPC narrative greeting on return |
| `src/game/systems/merchant-system.ts` | Purchase flow coordination, catalog reading, CLI command calls |
| `src/game/ui/merchant-panel.ts` | Lit component: shop catalog UI |
| `src/game/systems/talk/templates/conversation-scripts-merchant.ts` | Merchant NPC dialogue scripts |
| `src/game/systems/talk/templates/conversation-scripts-offline.ts` | Offline-return greeting scripts |
| `tests/game/systems/narrative-system.test.ts` | Beat collection, composition, vault output tests |
| `tests/game/systems/offline-progress.test.ts` | Simulation bounds, XP/Coin calc, rested bonus tests |
| `tests/game/systems/merchant-system.test.ts` | Purchase validation, catalog filtering tests |

### Modified Files (Extend)

| File | Change |
|------|--------|
| `src/game/systems/day-clock.ts` | Add `onCycleEnd(cb)` / `offCycleEnd(cb)` callback API |
| `src/game/engine-simulation.ts` | Wire narrative system into tick phases |
| `src/game/engine-lifecycle.ts` | Call offline progress on startup before first tick |
| `src/game/store/dashboard-store.ts` | Add narrative, offline results, and merchant catalog state |
| `src/game/actors/merchant-stall.ts` | Add click handler to open merchant panel |
| `src/game/engine-events.ts` | Subscribe narrative system to game events |

---

## Chunk 1: Narrative System

### Task 1: DayClock onCycleEnd Callback

**Files:**
- Modify: `src/game/systems/day-clock.ts`
- Test: `tests/game/systems/day-clock.test.ts`

**Reference:** Read `src/game/systems/day-clock.ts` to find where the cycle wraps and emits `morning-arrival`. The `onCycleEnd` callback fires just BEFORE the cycle wraps — this is where the narrative system composes the day's story.

- [ ] **Step 1: Read day-clock.ts to find the cycle wrap logic**

Locate where `cycleCount` increments and `morning-arrival` is emitted. The `onCycleEnd` callback fires at this point, before the phase resets.

- [ ] **Step 2: Write the failing test**

```typescript
// In tests/game/systems/day-clock.test.ts — add to existing file
describe("onCycleEnd", () => {
	it("fires callback when cycle wraps", () => {
		const clock = new DayClock(1000); // 1-second cycle
		const cb = vi.fn();
		clock.onCycleEnd(cb);
		clock.update(1001); // tick past full cycle
		expect(cb).toHaveBeenCalledTimes(1);
	});

	it("does not fire mid-cycle", () => {
		const clock = new DayClock(1000);
		const cb = vi.fn();
		clock.onCycleEnd(cb);
		clock.update(500);
		expect(cb).not.toHaveBeenCalled();
	});

	it("can unsubscribe via offCycleEnd", () => {
		const clock = new DayClock(1000);
		const cb = vi.fn();
		clock.onCycleEnd(cb);
		clock.offCycleEnd(cb);
		clock.update(1001);
		expect(cb).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/game/systems/day-clock.test.ts`
Expected: FAIL — `onCycleEnd` is not a function

- [ ] **Step 4: Implement onCycleEnd/offCycleEnd**

Add to `DayClock` class:
- Private field: `private readonly cycleEndCallbacks: Array<() => void> = [];`
- Public methods: `onCycleEnd(cb)` pushes to array, `offCycleEnd(cb)` filters it out
- In the `update()` method, where `cycleCount` increments, call all cycleEnd callbacks before resetting phase

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/game/systems/day-clock.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/game/systems/day-clock.ts tests/game/systems/day-clock.test.ts
git commit -m "feat(game): add onCycleEnd callback to DayClock"
```

---

### Task 2: Narrative Templates

**Files:**
- Create: `src/game/data/narrative-templates.ts`

**Reference:** Pure data file — no logic, no imports besides types. Templates organized by story beat category. Uses `${variable}` interpolation syntax.

- [ ] **Step 1: Create the template data file**

```typescript
// src/game/data/narrative-templates.ts

export interface NarrativeTemplate {
	readonly category: string;
	readonly event: string;
	readonly significance: "headline" | "detail" | "color";
	readonly templates: readonly string[];
}

export interface TransitionTemplate {
	readonly phase: string;
	readonly templates: readonly string[];
}

export const NARRATIVE_TEMPLATES: readonly NarrativeTemplate[] = [
	// --- Task events ---
	{
		category: "task", event: "task-completed", significance: "detail",
		templates: [
			"${agent} completed ${count} ${domain} task${plural}, earning ${xp} XP.",
			"${agent} wrapped up work on ${domain}, banking ${xp} XP and ${coin} Coin.",
			"${agent} quietly knocked out ${count} task${plural} in ${domain}.",
		],
	},
	{
		category: "task", event: "task-assigned", significance: "detail",
		templates: [
			"${agent} picked up a new ${domain} task.",
			"A fresh assignment landed on ${agent}'s desk — ${domain} work.",
		],
	},

	// --- Economy events ---
	{
		category: "economy", event: "level-up", significance: "headline",
		templates: [
			"The highlight: ${agent} reached Level ${level} — ${title}! Nearby agents paused to celebrate.",
			"${agent} leveled up to ${title} (Level ${level})! A round of applause from the team.",
			"Big moment — ${agent} hit Level ${level}. ${title} suits them.",
		],
	},
	{
		category: "economy", event: "trust-promoted", significance: "headline",
		templates: [
			"${agent} earned auto-trust for ${operation}. One less thing for the Director to review.",
			"Trust promoted: ${agent} can now handle ${operation} autonomously.",
		],
	},
	{
		category: "economy", event: "merchant-purchase", significance: "detail",
		templates: [
			"${agent} picked up ${item} from the Merchant for ${cost} Coin.",
			"A visit to the shop — ${agent} bought ${item}.",
		],
	},

	// --- Social events ---
	{
		category: "social", event: "conversation", significance: "color",
		templates: [
			"${agent1} and ${agent2} had a chat at the ${location}.",
			"${agent1} and ${agent2} were deep in conversation — something about ${topic}.",
		],
	},
	{
		category: "social", event: "running-joke", significance: "color",
		templates: [
			"The ${joke} joke made another appearance. ${agent1} started it this time.",
			"${agent1} brought up ${joke} again. ${agent2} groaned.",
		],
	},

	// --- Need events ---
	{
		category: "need", event: "need-critical", significance: "color",
		templates: [
			"${agent} was running on empty — ${need} critically low.",
			"${agent} looked like they needed a break. ${need} was bottoming out.",
		],
	},

	// --- Pet events ---
	{
		category: "pet", event: "steal-food", significance: "color",
		templates: [
			"${pet} stole ${agent}'s snack again. ${agent} didn't seem to mind.",
			"${pet} made a daring raid on the snack table. ${agent} watched in disbelief.",
		],
	},
	{
		category: "pet", event: "bonding", significance: "color",
		templates: [
			"${pet} spent the afternoon curled up near ${agent}'s workstation.",
			"${agent} and ${pet} shared a quiet moment.",
		],
	},

	// --- Ritual events ---
	{
		category: "ritual", event: "standup-completed", significance: "detail",
		templates: [
			"Morning standup went smoothly — ${count} agents checked in.",
			"The team gathered for standup. ${agent} had the most to share.",
		],
	},
	{
		category: "ritual", event: "celebration", significance: "headline",
		templates: [
			"The team celebrated! ${reason}.",
		],
	},
];

export const PHASE_TRANSITIONS: readonly TransitionTemplate[] = [
	{ phase: "Morning", templates: ["The team arrived in good spirits.", "A new day cycle began.", "Morning light filled the workspace."] },
	{ phase: "Lunch", templates: ["Lunchtime rolled around.", "The team took a break for food.", "Midday — time to refuel."] },
	{ phase: "Afternoon", templates: ["Back to work after lunch.", "The afternoon pushed on.", "Productivity picked up again."] },
	{ phase: "Wind-Down", templates: ["The pace slowed as the day wound down.", "Energy levels dipped in the late afternoon."] },
	{ phase: "Evening", templates: ["As the day came to a close:", "The evening wrapped things up:"] },
];

export const DAY_PHASE_TO_NARRATIVE: Readonly<Record<string, string>> = {
	"morning-arrival": "Morning",
	"productive-morning": "Morning",
	"lunch": "Lunch",
	"afternoon": "Afternoon",
	"afternoon-slump": "Afternoon",
	"wind-down": "Wind-Down",
	"evening-departure": "Evening",
};

export const OFFLINE_TEMPLATES = {
	condensed: [
		"During the night, the team quietly worked through ${tasks} tasks across ${cycles} cycles.",
		"While the Director was away, the team kept busy — ${tasks} tasks completed over ${cycles} cycles.",
	],
	highlight: [
		"${agent} hit Level ${level} (${title}) while you were away.",
		"${agent} leveled up to ${title} during the offline period.",
	],
	rested: [
		"The team also took some well-deserved downtime.",
		"Everyone got some rest — the team is refreshed and ready.",
	],
};
```

- [ ] **Step 2: Run type check**

Run: `npx tsc -noEmit -skipLibCheck`
Expected: No errors in new file

- [ ] **Step 3: Commit**

```bash
git add src/game/data/narrative-templates.ts
git commit -m "feat(game): add narrative story templates by event category"
```

---

### Task 3: Narrative System

**Files:**
- Create: `src/game/systems/narrative-system.ts`
- Create: `tests/game/systems/narrative-system.test.ts`

**Reference:** The NarrativeSystem collects story beats during a day cycle, then composes a markdown story at cycle end. It subscribes to game events and writes vault files.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/game/systems/narrative-system.test.ts
import { describe, it, expect, vi } from "vitest";
import { NarrativeSystem } from "../../../src/game/systems/narrative-system.js";
import type { StoryBeat } from "../../../src/game/systems/narrative-system.js";

describe("NarrativeSystem", () => {
	function makeSystem() {
		const writtenFiles: Record<string, string> = {};
		return {
			system: new NarrativeSystem({
				writeFile: (path: string, content: string) => { writtenFiles[path] = content; },
				narrativeDir: "03 - Resources/Narrative",
				currentDate: () => "2026-03-22",
			}),
			writtenFiles,
		};
	}

	describe("recordBeat", () => {
		it("accumulates beats during a cycle", () => {
			const { system } = makeSystem();
			system.recordBeat({
				timestamp: 1000,
				phase: "morning-arrival",
				category: "task",
				actors: ["Auditor"],
				event: "task-completed",
				detail: { count: 3, domain: "analysis", xp: 150 },
			});
			expect(system.getCurrentBeats()).toHaveLength(1);
		});
	});

	describe("composeCycleNarrative", () => {
		it("groups beats by narrative phase", () => {
			const { system } = makeSystem();
			system.recordBeat({ timestamp: 100, phase: "morning-arrival", category: "task", actors: ["A"], event: "task-completed", detail: { count: 1, domain: "eng", xp: 50 } });
			system.recordBeat({ timestamp: 500, phase: "lunch", category: "social", actors: ["A", "B"], event: "conversation", detail: {} });

			const story = system.composeCycleNarrative(5);
			expect(story).toContain("## Morning");
			expect(story).toContain("## Lunch");
		});

		it("puts headlines before details", () => {
			const { system } = makeSystem();
			system.recordBeat({ timestamp: 100, phase: "afternoon", category: "economy", actors: ["Auditor"], event: "level-up", detail: { level: 4, title: "Artisan" } });
			system.recordBeat({ timestamp: 200, phase: "afternoon", category: "task", actors: ["Writer"], event: "task-completed", detail: { count: 2, domain: "design", xp: 100 } });

			const story = system.composeCycleNarrative(5);
			const levelUpIdx = story.indexOf("Level 4");
			const taskIdx = story.indexOf("Writer");
			expect(levelUpIdx).toBeLessThan(taskIdx);
		});

		it("adds summary footer", () => {
			const { system } = makeSystem();
			system.recordBeat({ timestamp: 100, phase: "morning-arrival", category: "task", actors: ["A"], event: "task-completed", detail: { count: 5, xp: 250, coin: 125 } });
			const story = system.composeCycleNarrative(10);
			expect(story).toContain("Day 10");
		});
	});

	describe("flushToVault", () => {
		it("writes markdown file with frontmatter", () => {
			const { system, writtenFiles } = makeSystem();
			system.recordBeat({ timestamp: 100, phase: "morning-arrival", category: "task", actors: ["Auditor"], event: "task-completed", detail: { count: 1, domain: "eng", xp: 50 } });
			system.flushToVault(7);

			const keys = Object.keys(writtenFiles);
			expect(keys).toHaveLength(1);
			expect(keys[0]).toContain("2026-03-22-day-7.md");

			const content = writtenFiles[keys[0]];
			expect(content).toContain("type: NarrativeLog");
			expect(content).toContain("cycle: 7");
		});

		it("clears beats after flush", () => {
			const { system } = makeSystem();
			system.recordBeat({ timestamp: 100, phase: "morning-arrival", category: "task", actors: ["A"], event: "task-completed", detail: {} });
			system.flushToVault(1);
			expect(system.getCurrentBeats()).toHaveLength(0);
		});

		it("skips write when no beats collected", () => {
			const { system, writtenFiles } = makeSystem();
			system.flushToVault(1);
			expect(Object.keys(writtenFiles)).toHaveLength(0);
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/systems/narrative-system.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

The NarrativeSystem class should:
- Constructor takes `{ writeFile, narrativeDir, currentDate }` deps
- `recordBeat(beat: StoryBeat)` — push to internal `beats[]` array
- `getCurrentBeats()` — return current beats (for in-game feed)
- `composeCycleNarrative(cycleNumber)` — group beats by narrative phase, rank by significance, select templates, compose markdown with YAML frontmatter
- `flushToVault(cycleNumber)` — compose + write to `narrativeDir/{date}-day-{cycle}.md`, clear beats
- `composeOfflineNarrative(results)` — condensed narrative for offline progress

Template selection: find matching `NarrativeTemplate` by category+event, pick random template, interpolate `${var}` from beat detail. Phase transitions use `PHASE_TRANSITIONS`.

YAML frontmatter: `type`, `date`, `cycle`, `agents` (unique from beats), `highlights` (headline events), `offline` (boolean).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/systems/narrative-system.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Run type check**

Run: `npx tsc -noEmit -skipLibCheck`

- [ ] **Step 6: Commit**

```bash
git add src/game/systems/narrative-system.ts tests/game/systems/narrative-system.test.ts
git commit -m "feat(game): add narrative system with beat collection and story composition"
```

---

### Task 4: Wire Narrative System to Engine

**Files:**
- Modify: `src/game/engine-events.ts`
- Modify: `src/game/engine-simulation.ts`
- Modify: `src/game/store/dashboard-store.ts`

**Reference:** Read these files first. The narrative system needs to:
1. Be instantiated during engine setup and added to EngineContext systems
2. Subscribe to game events (task-completed, level-up, conversation, etc.) via the existing event wiring in engine-events.ts
3. Register its `flushToVault` on the DayClock's new `onCycleEnd` callback

- [ ] **Step 1: Read engine-events.ts, engine-simulation.ts, and dashboard-store.ts**

Understand where systems are initialized, how events are subscribed, and the EngineContext type.

- [ ] **Step 2: Add NarrativeSystem to EngineContext**

In the type definition (likely `engine-types.ts` or inline in engine-simulation), add `narrative: NarrativeSystem` to the systems object.

- [ ] **Step 3: Instantiate NarrativeSystem during engine setup**

In `engine-lifecycle.ts` or wherever systems are created, instantiate NarrativeSystem with `writeFile` bound to vault filesystem write and `narrativeDir` from vault path config.

- [ ] **Step 4: Subscribe to events in engine-events.ts**

Add event subscriptions that call `narrative.recordBeat()`:
- `task-completed` → `{ category: "task", event: "task-completed", ... }`
- `level-up` → `{ category: "economy", event: "level-up", ... }`
- `trust-promoted` → `{ category: "economy", event: "trust-promoted", ... }`
- Social conversations → `{ category: "social", event: "conversation", ... }`
- Pet events → `{ category: "pet", event: "steal-food", ... }`

- [ ] **Step 5: Register onCycleEnd callback**

Where the DayClock is set up, register:
```typescript
dayClock.onCycleEnd(() => {
	narrative.flushToVault(dayClock.getCycleCount());
});
```

- [ ] **Step 6: Add narrative state to DashboardStore**

Add `currentNarrativeBeats: StoryBeat[]` to DashboardStore for the in-game feed display.

- [ ] **Step 7: Run full test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/game/engine-events.ts src/game/engine-simulation.ts src/game/store/dashboard-store.ts src/game/engine-lifecycle.ts
git commit -m "feat(game): wire narrative system to engine events and day clock"
```

---

## Chunk 2: Offline Progress

### Task 5: Offline Progress System

**Files:**
- Create: `src/game/systems/offline-progress.ts`
- Create: `tests/game/systems/offline-progress.test.ts`

**Reference:** Read `src/game/systems/day-clock.ts` for `DayClockState` (has `lastUpdated` field), `src/game/config/cli-data-provider.ts` for how CLI commands are called, and the spec Section 2.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/game/systems/offline-progress.test.ts
import { describe, it, expect } from "vitest";
import { calculateOfflineProgress, shouldShowBriefing } from "../../../src/game/systems/offline-progress.js";
import type { OfflineResults } from "../../../src/game/systems/offline-progress.js";

describe("offline-progress", () => {
	const baseAgents = [
		{ name: "Auditor", level: 2, xp: 150, coin: 75, assignedTasks: 5, avgTasksPerCycle: 1.5 },
		{ name: "Writer", level: 1, xp: 50, coin: 25, assignedTasks: 3, avgTasksPerCycle: 1.0 },
	];

	describe("shouldShowBriefing", () => {
		it("returns false for < 5 minutes", () => {
			expect(shouldShowBriefing(4 * 60 * 1000)).toBe(false);
		});

		it("returns true for >= 5 minutes", () => {
			expect(shouldShowBriefing(5 * 60 * 1000)).toBe(true);
		});

		it("returns true for 8+ hours", () => {
			expect(shouldShowBriefing(9 * 60 * 60 * 1000)).toBe(true);
		});
	});

	describe("calculateOfflineProgress", () => {
		it("simulates correct number of cycles for 2 hours", () => {
			const elapsed = 2 * 60 * 60 * 1000; // 2 hours
			const result = calculateOfflineProgress(elapsed, baseAgents);
			// 2 hours = 120 min / 25 min per cycle = ~4 cycles
			expect(result.cyclesSimulated).toBeGreaterThanOrEqual(4);
			expect(result.cyclesSimulated).toBeLessThanOrEqual(5);
		});

		it("caps simulation at 8 hours", () => {
			const elapsed = 24 * 60 * 60 * 1000; // 24 hours
			const result = calculateOfflineProgress(elapsed, baseAgents);
			expect(result.simulatedMs).toBeLessThanOrEqual(8 * 60 * 60 * 1000);
			expect(result.rested).toBe(true);
		});

		it("calculates XP per agent based on tasks completed", () => {
			const elapsed = 25 * 60 * 1000; // 1 cycle (25 min)
			const result = calculateOfflineProgress(elapsed, baseAgents);
			const auditor = result.agentResults.find(a => a.name === "Auditor");
			expect(auditor).toBeDefined();
			expect(auditor!.xpEarned).toBeGreaterThan(0);
		});

		it("detects level-ups", () => {
			const agents = [
				{ name: "NearLevelUp", level: 1, xp: 90, coin: 0, assignedTasks: 10, avgTasksPerCycle: 5 },
			];
			const elapsed = 25 * 60 * 1000; // 1 cycle
			const result = calculateOfflineProgress(elapsed, agents);
			const agent = result.agentResults[0];
			// 5 tasks × 50 XP = 250 XP, starting at 90 → 340 XP, level 2 threshold is 100
			expect(agent.leveledUp).toBe(true);
			expect(agent.currentLevel).toBeGreaterThan(agent.previousLevel);
		});

		it("sets rested bonus when elapsed > 8 hours", () => {
			const elapsed = 10 * 60 * 60 * 1000;
			const result = calculateOfflineProgress(elapsed, baseAgents);
			expect(result.rested).toBe(true);
			for (const agent of result.agentResults) {
				expect(agent.needsRestored).toBe(true);
			}
		});

		it("returns empty results for agents with no tasks", () => {
			const agents = [{ name: "Idle", level: 1, xp: 0, coin: 0, assignedTasks: 0, avgTasksPerCycle: 0 }];
			const result = calculateOfflineProgress(25 * 60 * 1000, agents);
			expect(result.agentResults[0].tasksCompleted).toBe(0);
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/systems/offline-progress.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/game/systems/offline-progress.ts

const CYCLE_DURATION_MS = 25 * 60 * 1000;  // 25 minutes
const MAX_SIMULATION_MS = 8 * 60 * 60 * 1000;  // 8 hours
const MIN_BRIEFING_MS = 5 * 60 * 1000;  // 5 minutes
const BASE_XP_PER_TASK = 50;
const BASE_COIN_PER_TASK = 25;

// Import leveling from CLI domain (or inline the XP thresholds)
const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2200, 3000];

export interface AgentOfflineInput {
	readonly name: string;
	readonly level: number;
	readonly xp: number;
	readonly coin: number;
	readonly assignedTasks: number;
	readonly avgTasksPerCycle: number;
}

export interface AgentOfflineResult {
	readonly name: string;
	readonly tasksCompleted: number;
	readonly xpEarned: number;
	readonly coinEarned: number;
	readonly leveledUp: boolean;
	readonly previousLevel: number;
	readonly currentLevel: number;
	readonly needsRestored: boolean;
}

export interface OfflineResults {
	readonly elapsedMs: number;
	readonly simulatedMs: number;
	readonly cyclesSimulated: number;
	readonly agentResults: readonly AgentOfflineResult[];
	readonly rested: boolean;
}

export function shouldShowBriefing(elapsedMs: number): boolean {
	return elapsedMs >= MIN_BRIEFING_MS;
}

function levelForXp(xp: number): number {
	for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
		if (xp >= LEVEL_THRESHOLDS[i]) return i + 1;
	}
	return 1;
}

export function calculateOfflineProgress(
	elapsedMs: number,
	agents: readonly AgentOfflineInput[],
): OfflineResults {
	const simulatedMs = Math.min(elapsedMs, MAX_SIMULATION_MS);
	const cyclesSimulated = Math.floor(simulatedMs / CYCLE_DURATION_MS);
	const rested = elapsedMs > MAX_SIMULATION_MS;

	const agentResults: AgentOfflineResult[] = agents.map(agent => {
		const tasksPerCycle = agent.avgTasksPerCycle || (agent.assignedTasks > 0 ? 1 : 0);
		const totalTasks = Math.min(
			Math.floor(tasksPerCycle * cyclesSimulated),
			agent.assignedTasks,
		);
		const xpEarned = totalTasks * BASE_XP_PER_TASK;
		const coinEarned = totalTasks * BASE_COIN_PER_TASK;
		const newXp = agent.xp + xpEarned;
		const currentLevel = levelForXp(newXp);

		return {
			name: agent.name,
			tasksCompleted: totalTasks,
			xpEarned,
			coinEarned,
			leveledUp: currentLevel > agent.level,
			previousLevel: agent.level,
			currentLevel,
			needsRestored: rested,
		};
	});

	return { elapsedMs, simulatedMs, cyclesSimulated, agentResults, rested };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/systems/offline-progress.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/systems/offline-progress.ts tests/game/systems/offline-progress.test.ts
git commit -m "feat(game): add offline progress simulation with bounded cycles"
```

---

### Task 6: Offline Return Conversation Scripts

**Files:**
- Create: `src/game/systems/talk/templates/conversation-scripts-offline.ts`

**Reference:** Follow the exact pattern from `conversation-scripts-friend.ts` — exported array of `ConversationScript` objects with id, tierRange, trigger, weight, cooldownMs, tags, and turns array.

- [ ] **Step 1: Create the offline-return scripts**

Scripts use trigger `"offline-return"` and are tier-independent (Merchant NPC has a fixed personality). Variable interpolation: `{days_offline}`, `{total_xp}`, `{highlight_agent}`, `{highlight_event}`, `{tasks_completed}`, `{cycles_simulated}`.

Create 5-8 script variants for the Merchant's greeting, covering:
- Short absence (< 1 hour): casual, brief
- Medium absence (1-8 hours): informative, summary-focused
- Long absence (> 8 hours): warm welcome, rested note
- Highlight scripts: agent leveled up, trust promoted, many tasks completed

- [ ] **Step 2: Register scripts with ConversationEngine**

Read `engine-events.ts` or wherever scripts are registered with `engine.registerScripts()`. Add the offline scripts to the registration.

- [ ] **Step 3: Commit**

```bash
git add src/game/systems/talk/templates/conversation-scripts-offline.ts
git commit -m "feat(game): add offline-return conversation scripts for Merchant NPC"
```

---

### Task 7: Briefing Panel & Engine Integration

**Files:**
- Create: `src/game/ui/briefing-panel.ts`
- Modify: `src/game/engine-lifecycle.ts`

**Reference:** Read `src/game/ui/ask-bob.ts` for the Lit component pattern (extends FlowtiElement, static properties, static styles). Read `engine-lifecycle.ts` for startup flow.

- [ ] **Step 1: Create the briefing panel Lit component**

A modal-style panel showing:
- Merchant NPC portrait/icon at top
- Headlines section (1-3 significant events)
- Summary stats (time away, tasks, XP/Coin)
- Color commentary (personality observation)
- "View Full Report" link
- "Dismiss" button
- Auto-dismiss after 30 seconds (clearTimeout on interaction)

The panel receives `OfflineResults` + composed narrative text as properties.

- [ ] **Step 2: Wire offline progress into engine startup**

In `engine-lifecycle.ts`, after engine initialization but before the first tick:
1. Read `lastUpdated` from world-clock state
2. Calculate elapsed time
3. If `shouldShowBriefing(elapsed)`: run `calculateOfflineProgress()`, compose offline narrative via NarrativeSystem, show BriefingPanel
4. Credit offline earnings via CLI commands (`flowti economy:grant`)

- [ ] **Step 3: Test manually**

Build dev: `npm run build:dev`
Open Obsidian, verify briefing appears after 5+ minute absence.

- [ ] **Step 4: Commit**

```bash
git add src/game/ui/briefing-panel.ts src/game/engine-lifecycle.ts
git commit -m "feat(game): add briefing panel and wire offline progress into engine startup"
```

---

## Chunk 3: Merchant NPC

### Task 8: Merchant System

**Files:**
- Create: `src/game/systems/merchant-system.ts`
- Create: `tests/game/systems/merchant-system.test.ts`

**Reference:** Read `src/game/config/cli-data-provider.ts` for how CLI commands are called. Read the CLI's `src/domain/merchant/merchant-types.ts` for `CatalogItem` type.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/game/systems/merchant-system.test.ts
import { describe, it, expect, vi } from "vitest";
import { MerchantSystem } from "../../../src/game/systems/merchant-system.js";

describe("MerchantSystem", () => {
	function makeSystem(catalog = defaultCatalog(), balances = defaultBalances()) {
		const cliCalls: string[] = [];
		return {
			system: new MerchantSystem({
				runCli: async (cmd: string) => { cliCalls.push(cmd); return '{"ok":true}'; },
				getCatalog: () => catalog,
				getBalance: (agent: string) => balances[agent] ?? { coin: 0, level: 1 },
			}),
			cliCalls,
		};
	}

	function defaultCatalog() {
		return [
			{ id: "tool-vault-write", name: "Vault Write Access", category: "capability", cost: 200, requiresLevel: 3, oneTime: true },
			{ id: "token-pack-5k", name: "Token Pack (5,000)", category: "resource", cost: 100, oneTime: false },
			{ id: "title-senior", name: "Senior Title Badge", category: "cosmetic", cost: 150, requiresLevel: 5, oneTime: true },
		];
	}

	function defaultBalances(): Record<string, { coin: number; level: number }> {
		return { "Auditor": { coin: 500, level: 4 }, "Writer": { coin: 50, level: 2 } };
	}

	describe("getAvailableItems", () => {
		it("filters by agent level", () => {
			const { system } = makeSystem();
			const items = system.getAvailableItems("Writer"); // level 2
			expect(items.find(i => i.id === "tool-vault-write")).toBeUndefined(); // requires level 3
			expect(items.find(i => i.id === "token-pack-5k")).toBeDefined(); // no level req
		});
	});

	describe("canAfford", () => {
		it("returns true when agent has enough coin", () => {
			const { system } = makeSystem();
			expect(system.canAfford("Auditor", "token-pack-5k")).toBe(true); // 500 >= 100
		});

		it("returns false when insufficient coin", () => {
			const { system } = makeSystem();
			expect(system.canAfford("Writer", "tool-vault-write")).toBe(false); // 50 < 200
		});
	});

	describe("purchase", () => {
		it("calls CLI shop:buy command", async () => {
			const { system, cliCalls } = makeSystem();
			await system.purchase("Auditor", "token-pack-5k");
			expect(cliCalls).toHaveLength(1);
			expect(cliCalls[0]).toContain("shop:buy");
			expect(cliCalls[0]).toContain("Auditor");
			expect(cliCalls[0]).toContain("token-pack-5k");
		});
	});

	describe("shouldAutoPurchase", () => {
		it("returns true for level 5+ trusted agents with affordable capability items", () => {
			const balances = { "Senior": { coin: 300, level: 5 } };
			const { system } = makeSystem(defaultCatalog(), balances);
			expect(system.shouldAutoPurchase("Senior")).toBe(true);
		});

		it("returns false for agents below level 5", () => {
			const { system } = makeSystem();
			expect(system.shouldAutoPurchase("Auditor")).toBe(false); // level 4
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/systems/merchant-system.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

MerchantSystem class:
- Constructor takes `{ runCli, getCatalog, getBalance }` deps
- `getAvailableItems(agentName)` — filter catalog by agent level
- `canAfford(agentName, itemId)` — check coin >= cost
- `purchase(agentName, itemId)` — call `runCli("shop:buy --agent=X --item=Y")`
- `shouldAutoPurchase(agentName)` — level 5+, has affordable capability item not yet owned

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/systems/merchant-system.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/systems/merchant-system.ts tests/game/systems/merchant-system.test.ts
git commit -m "feat(game): add merchant system with purchase flow and auto-purchase logic"
```

---

### Task 9: Merchant Conversation Scripts

**Files:**
- Create: `src/game/systems/talk/templates/conversation-scripts-merchant.ts`

**Reference:** Same pattern as `conversation-scripts-offline.ts` (Task 6). Triggers: `"merchant-browse"`, `"merchant-purchase"`.

- [ ] **Step 1: Create merchant scripts**

- Browse scripts (4-6): agent thinking aloud while browsing, price reactions, wishlisting
- Purchase scripts (4-6): satisfaction after buying, showing off to nearby agents, buyer's remorse humor
- Variables: `{agent}`, `{item}`, `{cost}`, `{coin_remaining}`

- [ ] **Step 2: Register with ConversationEngine**

Add to script registration in engine-events.ts.

- [ ] **Step 3: Commit**

```bash
git add src/game/systems/talk/templates/conversation-scripts-merchant.ts
git commit -m "feat(game): add merchant browse and purchase conversation scripts"
```

---

### Task 10: Merchant Panel UI

**Files:**
- Create: `src/game/ui/merchant-panel.ts`
- Modify: `src/game/actors/merchant-stall.ts`

**Reference:** Read `src/game/ui/ask-bob.ts` for the Lit component pattern. Read `src/game/actors/merchant-stall.ts` for the current actor (likely just a sprite with no click handler yet).

- [ ] **Step 1: Create the Merchant Panel Lit component**

Properties:
- `catalog` — catalog items array
- `selectedAgent` — currently selected agent name
- `agentBalance` — `{ coin, level }` for selected agent
- `ownedItems` — set of item IDs the selected agent already owns

UI structure:
- Agent selector dropdown
- Category tabs (Capability | Resource | Cosmetic | Pet Cosmetic | Room)
- Item grid: name, cost, level requirement, owned badge
- Buy button (disabled states: insufficient coin, level too low, already owned)
- Balance display at top

Events:
- `purchase` CustomEvent with `{ agent, itemId }` — parent wires to MerchantSystem

- [ ] **Step 2: Add click handler to merchant-stall.ts**

Read the current merchant-stall actor. Add a pointer event handler that:
- Emits a custom event or calls a callback to show the MerchantPanel
- The parent (likely engine or director system) handles showing/hiding the panel

- [ ] **Step 3: Wire MerchantPanel to MerchantSystem**

In engine setup, when the MerchantPanel dispatches `purchase`, call `merchantSystem.purchase(agent, itemId)`.

- [ ] **Step 4: Test manually**

Build dev: `npm run build:dev`
Open Obsidian, click Merchant stall, verify catalog appears, buy an item.

- [ ] **Step 5: Commit**

```bash
git add src/game/ui/merchant-panel.ts src/game/actors/merchant-stall.ts
git commit -m "feat(game): add merchant panel UI and stall click handler"
```

---

### Task 11: Merchant BT Auto-Purchase

**Files:**
- Modify: `src/game/brain/behavior-tree/bt-agent.ts`

**Reference:** Read `bt-agent.ts` to understand the master selector subtrees. The `[MerchantVisit]` subtree slots in at low priority (after work cycle, before idle).

- [ ] **Step 1: Read bt-agent.ts to find subtree insertion point**

Locate the master selector and find where `[WorkCycle]` and `[IdleBehavior]` are. The `[MerchantVisit]` goes between them.

- [ ] **Step 2: Add MerchantVisit subtree**

```
[MerchantVisit] — checked once per day cycle
  Condition: agent.level >= 5 AND agent.trustTier === "trusted"
  Condition: merchantSystem.shouldAutoPurchase(agent.name)
  Sequence:
    → MoveTo(merchantStall.position)
    → Wait(3000-5000ms)  // "browsing"
    → triggerReactive(agent, "browsing-merchant")
    → merchantSystem.purchase(agent, bestItem)
    → triggerReactive(agent, "just-purchased")
```

The exact BT node types depend on what the mistreevous library provides — read the existing subtrees for patterns.

- [ ] **Step 3: Test manually**

Set an agent to level 5+ with enough coin and trusted tier. Observe them walking to the Merchant stall and auto-purchasing.

- [ ] **Step 4: Commit**

```bash
git add src/game/brain/behavior-tree/bt-agent.ts
git commit -m "feat(game): add MerchantVisit BT subtree for auto-purchase"
```

---

## Final Verification

After all tasks complete:

- [ ] **Run full test suite**: `cd "01 - Projects/Flowti Plugin" && npm test`
- [ ] **Build production**: `cd "01 - Projects/Flowti Plugin" && npm run build`
- [ ] **Manual verification in Obsidian**:
  - Open vault after 5+ minute absence → briefing panel appears
  - Click Merchant stall → catalog panel opens, can buy items
  - Watch a full day cycle → narrative markdown file appears in `03 - Resources/Narrative/`
  - Check `flowti economy:balance --agent=auditor` → balance reflects purchases/offline earnings
