# Agent Liveness Systems — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 6 new game systems (needs, director, sensor, engagement, ritual, tool-executor) to the Flowti Plugin's agent world, making agents feel alive, social, and useful without LLM calls.

**Architecture:** Flat systems following existing register/unregister/update pattern, wired via callbacks in `createAgentWorld()`. Each system is a standalone class with no direct imports of other systems. Cross-system communication via getter callbacks injected by the engine.

**Tech Stack:** TypeScript, ExcaliburJS (actors/scenes), Vitest (testing), Obsidian API (vault events)

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-20-agent-liveness-systems-design.md`

**All commands run from:** `cd "01 - Projects/Flowti Plugin"`

**Test command:** `npx vitest run tests/game/ --reporter=verbose`

**Type check:** `npx tsc --noEmit`

---

## File Structure

### New Files

```
src/game/data/
  world-config.ts            — WorldConfig interface, defaults, deep-merge loader
  sensor-rules.ts            — Default SensorRule[] with conditions + SensorRuleOverride type
  tool-registry.ts           — Default AgentTool[] definitions
  engagement-templates.ts    — Tier 1/2/3 template line arrays
  huddle-templates.ts        — Cluster conversation line arrays

src/game/systems/
  needs-system.ts            — NeedsSystem class (decay/restore/mood derivation)
  director-system.ts         — DirectorSystem class (cursor tracking, idle timer, context signals)
  sensor-system.ts           — SensorSystem class (event processing, rule evaluation, cooldowns)
  engagement-system.ts       — EngagementSystem class (escalation tiers, agent selection)
  ritual-system.ts           — RitualSystem class (markdown parser, choreography engine)
  tool-executor-system.ts    — ToolExecutor class (command queue, execution, result parsing)

tests/game/data/
  world-config.test.ts       — Config defaults, deep-merge, partial overrides
  sensor-rules.test.ts       — Rule definitions, override application
  engagement-templates.test.ts — Template variable interpolation

tests/game/systems/
  needs-system.test.ts       — Decay/restore rates, attribute modifiers, mood derivation, thresholds
  director-system.test.ts    — Cursor tracking, idle timer, interaction recording
  sensor-system.test.ts      — Event processing, cooldowns, rule matching, agent filtering
  engagement-system.test.ts  — Tier escalation, agent selection, reset behavior
  ritual-system.test.ts      — Markdown parsing, choreography phases, participant selection
  tool-executor-system.test.ts — Command queue, approval gating, result parsing
  bubble-system.test.ts      — Priority flag bypass behavior
  brain-system.test.ts       — walkTo method, needs integration
  social-system.test.ts      — Cluster detection, getNeeds callback
```

### Modified Files

```
src/game/systems/bubble-system.ts   — Add priority?: boolean parameter to showBubble()
src/game/systems/brain-system.ts    — Add walkTo() method, accept getNeeds callback
src/game/systems/social-system.ts   — Add cluster detection, accept getNeeds callback in update()
src/game/brain/brain-types.ts       — Add "custom" to MovementTarget.kind union
src/game/engine.ts                  — Wire all 12 systems in createAgentWorld()
```

---

## Chunk 1: Foundation — Config Types, Defaults, and Template Data

### Task 1: WorldConfig types and defaults

**Files:**
- Create: `src/game/data/world-config.ts`
- Test: `tests/game/data/world-config.test.ts`

- [ ] **Step 1: Write failing test for config defaults**

```typescript
// tests/game/data/world-config.test.ts
import { describe, it, expect } from "vitest";
import { DEFAULT_WORLD_CONFIG, mergeWorldConfig } from "../../../src/game/data/world-config.js";
import type { WorldConfig } from "../../../src/game/data/world-config.js";

describe("DEFAULT_WORLD_CONFIG", () => {
	it("provides initial need values", () => {
		const c = DEFAULT_WORLD_CONFIG;
		expect(c.needs.initial.energy).toBe(80);
		expect(c.needs.initial.social).toBe(60);
		expect(c.needs.initial.focus).toBe(70);
		expect(c.needs.initial.morale).toBe(75);
	});

	it("provides decay rates", () => {
		const c = DEFAULT_WORLD_CONFIG;
		expect(c.needs.decay.energy.working).toBe(3);
		expect(c.needs.decay.social.alone).toBe(2);
		expect(c.needs.decay.focus.perInterruption).toBe(4);
		expect(c.needs.decay.morale.perError).toBe(1);
	});

	it("provides engagement tier timings", () => {
		const c = DEFAULT_WORLD_CONFIG;
		expect(c.engagement.tiers.ambient.idleMs).toBe(30_000);
		expect(c.engagement.tiers.nudge.idleMs).toBe(90_000);
		expect(c.engagement.tiers.offer.idleMs).toBe(180_000);
		expect(c.engagement.engagementDuration).toBe(10_000);
	});

	it("provides director awareness radii", () => {
		const c = DEFAULT_WORLD_CONFIG;
		expect(c.director.awareness.noticeRadius).toBe(60);
		expect(c.director.awareness.greetRadius).toBe(40);
	});

	it("provides sensor cooldowns", () => {
		const c = DEFAULT_WORLD_CONFIG;
		expect(c.sensors.globalCooldown).toBe(10_000);
		expect(c.sensors.perAgentCooldown).toBe(5_000);
	});

	it("provides group dynamics defaults", () => {
		const c = DEFAULT_WORLD_CONFIG;
		expect(c.groups.clusterMinAgents).toBe(3);
		expect(c.groups.clusterProximityMs).toBe(6_000);
		expect(c.groups.ritualsFolder).toBe(".flowti/rituals/");
	});

	it("provides tool defaults", () => {
		const c = DEFAULT_WORLD_CONFIG;
		expect(c.tools.defaultTimeout).toBe(30_000);
	});
});

describe("mergeWorldConfig", () => {
	it("returns defaults when no overrides", () => {
		const result = mergeWorldConfig({});
		expect(result).toEqual(DEFAULT_WORLD_CONFIG);
	});

	it("deep-merges partial overrides", () => {
		const result = mergeWorldConfig({
			needs: { initial: { energy: 50 } },
		});
		expect(result.needs.initial.energy).toBe(50);
		expect(result.needs.initial.social).toBe(60); // unchanged
	});

	it("preserves non-overridden sections", () => {
		const result = mergeWorldConfig({
			engagement: { engagementDuration: 5000 },
		});
		expect(result.engagement.tiers.ambient.idleMs).toBe(30_000);
		expect(result.engagement.engagementDuration).toBe(5000);
		expect(result.needs).toEqual(DEFAULT_WORLD_CONFIG.needs);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/data/world-config.test.ts --reporter=verbose`
Expected: FAIL — module not found

- [ ] **Step 3: Implement world-config.ts**

```typescript
// src/game/data/world-config.ts

export interface SensorRuleOverride {
	readonly id: string;
	readonly cooldown?: number;
	readonly enabled?: boolean;
}

export interface AgentTool {
	readonly id: string;
	readonly command: string;
	readonly description: string;
	readonly domain: string[];
	readonly trigger: "sensor" | "schedule" | "need" | "engagement";
	readonly cooldown: number;
	readonly requiresApproval: boolean;
}

export interface WorldConfig {
	readonly needs: {
		readonly initial: { readonly energy: number; readonly social: number; readonly focus: number; readonly morale: number };
		readonly decay: {
			readonly energy: { readonly working: number; readonly walking: number };
			readonly social: { readonly alone: number };
			readonly focus: { readonly perInterruption: number };
			readonly morale: { readonly perError: number; readonly idlePerMinute: number; readonly ignored: number };
		};
		readonly restore: {
			readonly energy: { readonly onBreak: number; readonly idle: number };
			readonly social: { readonly perNearbyAgent: number; readonly conversation: number };
			readonly focus: { readonly workingUninterrupted: number };
			readonly morale: { readonly taskCompleted: number; readonly directorPraise: number; readonly celebration: number };
		};
		readonly thresholds: {
			readonly energy: { readonly forceBreak: number; readonly exhausted: number };
			readonly social: { readonly seekCompany: number; readonly seekDirector: number };
			readonly focus: { readonly seekQuiet: number };
			readonly morale: { readonly sad: number; readonly demoralized: number };
		};
	};
	readonly director: {
		readonly cursorSpirit: { readonly radius: number; readonly opacity: number; readonly fadeMs: number };
		readonly awareness: {
			readonly noticeRadius: number; readonly noticeDelay: number;
			readonly greetRadius: number; readonly greetDelay: number;
			readonly greetCooldown: number; readonly noticeCooldown: number;
		};
		readonly signals: {
			readonly clickPulseRadius: number; readonly clickPulseDuration: number;
			readonly praiseParticleCount: number; readonly glanceRadius: number;
		};
	};
	readonly sensors: {
		readonly globalCooldown: number;
		readonly perAgentCooldown: number;
		readonly domainPaths: Record<string, readonly string[]>;
		readonly ruleOverrides: readonly SensorRuleOverride[];
	};
	readonly groups: {
		readonly clusterMinAgents: number;
		readonly clusterProximityMs: number;
		readonly clusterCooldown: number;
		readonly clusterDispersePause: number;
		readonly ritualsFolder: string;
	};
	readonly engagement: {
		readonly tiers: {
			readonly ambient: { readonly idleMs: number; readonly frequency: number };
			readonly nudge: { readonly idleMs: number; readonly frequency: number };
			readonly offer: { readonly idleMs: number; readonly frequency: number };
		};
		readonly maxTier: number;
		readonly engagementDuration: number;
	};
	readonly tools: {
		readonly defaultTimeout: number;
		readonly registry: readonly AgentTool[];
	};
}

export const DEFAULT_WORLD_CONFIG: WorldConfig = {
	needs: {
		initial: { energy: 80, social: 60, focus: 70, morale: 75 },
		decay: {
			energy: { working: 3, walking: 3 },
			social: { alone: 2 },
			focus: { perInterruption: 4 },
			morale: { perError: 1, idlePerMinute: 1, ignored: 1 },
		},
		restore: {
			energy: { onBreak: 5, idle: 5 },
			social: { perNearbyAgent: 4, conversation: 4 },
			focus: { workingUninterrupted: 2 },
			morale: { taskCompleted: 5, directorPraise: 10, celebration: 5 },
		},
		thresholds: {
			energy: { forceBreak: 30, exhausted: 15 },
			social: { seekCompany: 25, seekDirector: 10 },
			focus: { seekQuiet: 20 },
			morale: { sad: 30, demoralized: 10 },
		},
	},
	director: {
		cursorSpirit: { radius: 12, opacity: 0.3, fadeMs: 300 },
		awareness: {
			noticeRadius: 60, noticeDelay: 2000,
			greetRadius: 40, greetDelay: 4000,
			greetCooldown: 60_000, noticeCooldown: 30_000,
		},
		signals: {
			clickPulseRadius: 40, clickPulseDuration: 400,
			praiseParticleCount: 8, glanceRadius: 80,
		},
	},
	sensors: {
		globalCooldown: 10_000,
		perAgentCooldown: 5_000,
		domainPaths: {
			engineering: ["src/domain/", "src/infrastructure/"],
			quality: ["tests/", "configs/vitest"],
			design: ["src/ui/", "styles"],
			operations: ["configs/", ".flowti/"],
			product: ["docs/", "configs/sitemap"],
		},
		ruleOverrides: [],
	},
	groups: {
		clusterMinAgents: 3,
		clusterProximityMs: 6_000,
		clusterCooldown: 180_000,
		clusterDispersePause: 3_000,
		ritualsFolder: ".flowti/rituals/",
	},
	engagement: {
		tiers: {
			ambient: { idleMs: 30_000, frequency: 45_000 },
			nudge: { idleMs: 90_000, frequency: 90_000 },
			offer: { idleMs: 180_000, frequency: 180_000 },
		},
		maxTier: 3,
		engagementDuration: 10_000,
	},
	tools: {
		defaultTimeout: 30_000,
		registry: [],
	},
};

function deepMerge<T extends Record<string, unknown>>(base: T, override: Record<string, unknown>): T {
	const result = { ...base };
	for (const key of Object.keys(override)) {
		const baseVal = (base as Record<string, unknown>)[key];
		const overVal = override[key];
		if (
			baseVal !== null && overVal !== null &&
			typeof baseVal === "object" && typeof overVal === "object" &&
			!Array.isArray(baseVal) && !Array.isArray(overVal)
		) {
			(result as Record<string, unknown>)[key] = deepMerge(
				baseVal as Record<string, unknown>,
				overVal as Record<string, unknown>,
			);
		} else {
			(result as Record<string, unknown>)[key] = overVal;
		}
	}
	return result;
}

export function mergeWorldConfig(overrides: Record<string, unknown>): WorldConfig {
	return deepMerge(DEFAULT_WORLD_CONFIG as unknown as Record<string, unknown>, overrides) as unknown as WorldConfig;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/data/world-config.test.ts --reporter=verbose`
Expected: PASS (all 8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/game/data/world-config.ts tests/game/data/world-config.test.ts
git commit -m "feat(world): add WorldConfig types, defaults, and deep-merge loader"
```

---

### Task 2: Template data files

**Files:**
- Create: `src/game/data/engagement-templates.ts`
- Create: `src/game/data/huddle-templates.ts`
- Create: `src/game/data/tool-registry.ts`
- Test: `tests/game/data/engagement-templates.test.ts`

- [ ] **Step 1: Write failing test for engagement templates**

```typescript
// tests/game/data/engagement-templates.test.ts
import { describe, it, expect } from "vitest";
import {
	TIER1_TEMPLATES, TIER2_TEMPLATES, TIER3_TEMPLATES,
	interpolateTemplate,
} from "../../../src/game/data/engagement-templates.js";

describe("engagement templates", () => {
	it("has tier 1 thinking-aloud lines", () => {
		expect(TIER1_TEMPLATES.length).toBeGreaterThanOrEqual(5);
	});

	it("has tier 2 addressing-director lines", () => {
		expect(TIER2_TEMPLATES.length).toBeGreaterThanOrEqual(4);
	});

	it("has tier 3 offering-action lines", () => {
		expect(TIER3_TEMPLATES.length).toBeGreaterThanOrEqual(4);
	});

	it("interpolates variables", () => {
		const result = interpolateTemplate("Score is {healthScore}", { healthScore: "85" });
		expect(result).toBe("Score is 85");
	});

	it("leaves unknown variables as-is", () => {
		const result = interpolateTemplate("Hello {unknown}", {});
		expect(result).toBe("Hello {unknown}");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/data/engagement-templates.test.ts --reporter=verbose`
Expected: FAIL — module not found

- [ ] **Step 3: Implement engagement-templates.ts**

```typescript
// src/game/data/engagement-templates.ts

export const TIER1_TEMPLATES: readonly string[] = [
	"Tests haven't run since {lastTestTime}...",
	"Health score is sitting at {healthScore}...",
	"The iteration has {remainingItems} items left...",
	"{agentName} has been working alone for a while...",
	"No one's touched {domain} in {daysSince} days...",
];

export const TIER2_TEMPLATES: readonly string[] = [
	"Hey boss, got a minute?",
	"Something came up you might want to know about.",
	"Just wanted to flag something.",
	"When you get a chance — I noticed something in {domain}.",
];

export const TIER3_TEMPLATES: readonly string[] = [
	"Want me to run a health check? Last one was {timeSince} ago.",
	"I could generate the {reportType} report if you'd like.",
	"Should I kick off the tests? Been a while.",
	"The iteration status might be worth reviewing. Want me to pull it up?",
];

export function interpolateTemplate(
	template: string,
	vars: Record<string, string>,
): string {
	return template.replace(/\{(\w+)\}/g, (match, key: string) =>
		key in vars ? vars[key] : match,
	);
}
```

- [ ] **Step 4: Implement huddle-templates.ts**

```typescript
// src/game/data/huddle-templates.ts

export const HUDDLE_TEMPLATES: readonly string[] = [
	"Here's where I'm at...",
	"Anyone else stuck on something?",
	"Quick update from my side...",
	"Things are moving along in {domain}.",
	"I've been thinking about our approach...",
	"Just wanted to sync up real quick.",
	"Feeling {mood_adj} about the progress.",
	"Nothing blocked on my end.",
	"Could use some input on {domain} stuff.",
	"Making progress. Slowly but surely.",
];
```

- [ ] **Step 5: Implement tool-registry.ts**

```typescript
// src/game/data/tool-registry.ts
import type { AgentTool } from "./world-config.js";

export const DEFAULT_TOOLS: readonly AgentTool[] = [
	{
		id: "health-check",
		command: 'flowti health --project="{project}" --format=json',
		description: "Run a project health check",
		domain: ["management", "orchestration"],
		trigger: "engagement",
		cooldown: 300_000,
		requiresApproval: false,
	},
	{
		id: "run-tests",
		command: 'flowti test --project="{project}"',
		description: "Run the project test suite",
		domain: ["quality", "engineering"],
		trigger: "engagement",
		cooldown: 60_000,
		requiresApproval: true,
	},
	{
		id: "generate-report",
		command: 'flowti reports --project="{project}"',
		description: "Generate project reports",
		domain: ["analysis", "management"],
		trigger: "engagement",
		cooldown: 300_000,
		requiresApproval: true,
	},
	{
		id: "build",
		command: 'flowti build --project="{project}"',
		description: "Build the project",
		domain: ["engineering", "operations"],
		trigger: "sensor",
		cooldown: 120_000,
		requiresApproval: true,
	},
	{
		id: "iteration-status",
		command: 'flowti info --project="{project}" --format=json',
		description: "Check iteration status",
		domain: ["product", "management"],
		trigger: "engagement",
		cooldown: 60_000,
		requiresApproval: false,
	},
	{
		id: "validate-sitemap",
		command: "flowti sitemap:validate",
		description: "Validate the sitemap configuration",
		domain: ["design", "product"],
		trigger: "sensor",
		cooldown: 60_000,
		requiresApproval: false,
	},
];
```

- [ ] **Step 6: Run tests and type check**

Run: `npx vitest run tests/game/data/ --reporter=verbose && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/game/data/engagement-templates.ts src/game/data/huddle-templates.ts src/game/data/tool-registry.ts tests/game/data/engagement-templates.test.ts
git commit -m "feat(world): add engagement, huddle, and tool template data files"
```

---

## Chunk 2: NeedsSystem — Personality-Weighted Needs Engine

### Task 3: NeedsSystem core — decay, restore, and mood derivation

**Files:**
- Create: `src/game/systems/needs-system.ts`
- Test: `tests/game/systems/needs-system.test.ts`

**Reference:** Spec Section 1 — Needs System. Read `src/game/data/types.ts` for `AgentAttributes`, `src/game/brain/brain-types.ts` for `BrainState`.

- [ ] **Step 1: Write failing tests for NeedsSystem**

```typescript
// tests/game/systems/needs-system.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { NeedsSystem } from "../../../src/game/systems/needs-system.js";
import type { AgentAttributes } from "../../../src/game/data/types.js";
import type { BrainState } from "../../../src/game/brain/brain-types.js";

function attrs(overrides: Partial<AgentAttributes> = {}): AgentAttributes {
	return { str: 10, int: 10, wis: 10, cha: 10, dex: 10, con: 10, ...overrides };
}

describe("NeedsSystem", () => {
	let system: NeedsSystem;

	beforeEach(() => {
		system = new NeedsSystem();
	});

	describe("register/unregister", () => {
		it("registers agent with initial needs from config defaults", () => {
			system.register("alice", attrs());
			const needs = system.getNeeds("alice");
			expect(needs.energy).toBe(80);
			expect(needs.social).toBe(60);
			expect(needs.focus).toBe(70);
			expect(needs.morale).toBe(75);
		});

		it("returns zero needs for unregistered agent", () => {
			const needs = system.getNeeds("ghost");
			expect(needs.energy).toBe(0);
		});

		it("unregisters agent", () => {
			system.register("alice", attrs());
			system.unregister("alice");
			expect(system.getNeeds("alice").energy).toBe(0);
		});
	});

	describe("energy decay", () => {
		it("decays energy while working", () => {
			system.register("alice", attrs());
			const before = system.getNeeds("alice").energy;
			// Simulate 60s of working (decay rate = 3/min base)
			system.update(60_000, () => "working", () => []);
			const after = system.getNeeds("alice").energy;
			expect(after).toBeLessThan(before);
			expect(after).toBeCloseTo(before - 3, 0);
		});

		it("high CON slows energy drain", () => {
			system.register("alice", attrs({ con: 20 }));
			system.register("bob", attrs({ con: 5 }));
			system.update(60_000, () => "working", () => []);
			// High CON agent should have more energy remaining
			expect(system.getNeeds("alice").energy).toBeGreaterThan(system.getNeeds("bob").energy);
		});

		it("restores energy while idle", () => {
			system.register("alice", attrs());
			// Drain first
			system.update(120_000, () => "working", () => []);
			const drained = system.getNeeds("alice").energy;
			// Now idle for 60s
			system.update(60_000, () => "idle", () => []);
			expect(system.getNeeds("alice").energy).toBeGreaterThan(drained);
		});
	});

	describe("social decay/restore", () => {
		it("decays social when alone", () => {
			system.register("alice", attrs());
			const before = system.getNeeds("alice").social;
			system.update(60_000, () => "idle", () => []);
			expect(system.getNeeds("alice").social).toBeLessThan(before);
		});

		it("restores social with nearby agents (capped at +10/min)", () => {
			system.register("alice", attrs());
			// Drain social first
			system.update(300_000, () => "idle", () => []);
			const drained = system.getNeeds("alice").social;
			// Now with 5 nearby agents — should cap at +10/min
			system.update(60_000, () => "idle", () => ["bob", "charlie", "dave", "eve", "frank"]);
			const restored = system.getNeeds("alice").social;
			expect(restored).toBeGreaterThan(drained);
			expect(restored - drained).toBeLessThanOrEqual(11); // +10/min + rounding
		});

		it("high CHA drains social faster", () => {
			system.register("alice", attrs({ cha: 18 }));
			system.register("bob", attrs({ cha: 5 }));
			system.update(60_000, () => "idle", () => []);
			// High CHA needs people more — faster drain
			expect(system.getNeeds("alice").social).toBeLessThan(system.getNeeds("bob").social);
		});
	});

	describe("focus", () => {
		it("restores focus while working uninterrupted", () => {
			system.register("alice", attrs());
			// Lose some focus
			system.applyEffect("alice", { focus: -20 });
			const before = system.getNeeds("alice").focus;
			system.update(60_000, () => "working", () => []);
			expect(system.getNeeds("alice").focus).toBeGreaterThan(before);
		});

		it("loses focus on interruption via applyEffect", () => {
			system.register("alice", attrs());
			const before = system.getNeeds("alice").focus;
			system.applyEffect("alice", { focus: -4 });
			expect(system.getNeeds("alice").focus).toBe(before - 4);
		});
	});

	describe("morale", () => {
		it("boosts morale on task completion via applyEffect", () => {
			system.register("alice", attrs());
			const before = system.getNeeds("alice").morale;
			system.applyEffect("alice", { morale: 5 });
			expect(system.getNeeds("alice").morale).toBe(before + 5);
		});

		it("clamps needs to 0-100 range", () => {
			system.register("alice", attrs());
			system.applyEffect("alice", { morale: 100 });
			expect(system.getNeeds("alice").morale).toBe(100);
			system.applyEffect("alice", { morale: -200 });
			expect(system.getNeeds("alice").morale).toBe(0);
		});
	});

	describe("mood derivation", () => {
		it("derives happy when morale > 70 and energy > 50", () => {
			system.register("alice", attrs());
			// Defaults: morale=75, energy=80 → happy
			expect(system.getMood("alice")).toBe("happy");
		});

		it("derives frustrated when morale < 30", () => {
			system.register("alice", attrs());
			system.applyEffect("alice", { morale: -50 });
			expect(system.getMood("alice")).toBe("frustrated");
		});

		it("derives focused when focus > 70 and energy > 40", () => {
			system.register("alice", attrs());
			system.applyEffect("alice", { morale: -50, focus: 5 });
			// morale=25 (<30) → frustrated takes priority
			// Need morale between 30-70, focus > 70
			system.applyEffect("alice", { morale: 20 }); // morale=45
			expect(system.getMood("alice")).toBe("focused"); // focus=75, energy=80
		});

		it("returns neutral as fallback", () => {
			system.register("alice", attrs());
			// Set needs to middle-ground values that don't trigger any specific mood
			system.applyEffect("alice", { morale: -30, energy: -40, focus: -30, social: -30 });
			expect(system.getMood("alice")).toBe("neutral");
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/systems/needs-system.test.ts --reporter=verbose`
Expected: FAIL — module not found

- [ ] **Step 3: Implement needs-system.ts**

```typescript
// src/game/systems/needs-system.ts
import type { AgentAttributes } from "../data/types.js";
import type { BrainState } from "../brain/brain-types.js";
import { DEFAULT_WORLD_CONFIG } from "../data/world-config.js";

export interface AgentNeeds {
	energy: number;
	social: number;
	focus: number;
	morale: number;
}

const WORKING_STATES: ReadonlySet<BrainState> = new Set(["working", "walking-to"]);
const RESTING_STATES: ReadonlySet<BrainState> = new Set(["idle", "on-break", "waiting"]);
const SOCIAL_RESTORE_CAP = 10; // max +10/min regardless of nearby count

interface NeedsEntry {
	needs: AgentNeeds;
	attrs: AgentAttributes;
	workingMs: number; // continuous working time for focus restore
	lastTaskCompletedAt: number;
}

function clamp(value: number): number {
	return Math.max(0, Math.min(100, value));
}

function attrVal(attrs: AgentAttributes, key: keyof AgentAttributes): number {
	return attrs[key] ?? 10;
}

export class NeedsSystem {
	private readonly entries = new Map<string, NeedsEntry>();
	private readonly config = DEFAULT_WORLD_CONFIG.needs;

	register(agentName: string, attributes: AgentAttributes): void {
		this.entries.set(agentName, {
			needs: { ...this.config.initial },
			attrs: attributes,
			workingMs: 0,
			lastTaskCompletedAt: 0,
		});
	}

	unregister(agentName: string): void {
		this.entries.delete(agentName);
	}

	update(
		deltaMs: number,
		getBrainState: (name: string) => BrainState,
		getNearbyAgents: (name: string) => string[],
	): void {
		const deltaMins = deltaMs / 60_000;

		for (const [name, entry] of this.entries) {
			const state = getBrainState(name);
			const nearby = getNearbyAgents(name);
			const { needs, attrs } = entry;

			// Energy
			if (WORKING_STATES.has(state)) {
				const conMod = 1 - attrVal(attrs, "con") / 40;
				needs.energy = clamp(needs.energy - this.config.decay.energy.working * conMod * deltaMins);
			} else if (RESTING_STATES.has(state)) {
				needs.energy = clamp(needs.energy + this.config.restore.energy.onBreak * deltaMins);
			}

			// Social
			if (nearby.length === 0) {
				const chaMod = 1 + attrVal(attrs, "cha") / 20;
				needs.social = clamp(needs.social - this.config.decay.social.alone * chaMod * deltaMins);
			} else {
				// +4 for first, +2 each additional, cap +10/min
				const restoreRate = Math.min(
					SOCIAL_RESTORE_CAP,
					this.config.restore.social.perNearbyAgent + (nearby.length - 1) * 2,
				);
				needs.social = clamp(needs.social + restoreRate * deltaMins);
			}

			// Focus
			if (WORKING_STATES.has(state)) {
				entry.workingMs += deltaMs;
				if (entry.workingMs > 10_000) {
					needs.focus = clamp(needs.focus + this.config.restore.focus.workingUninterrupted * deltaMins);
				}
			} else {
				entry.workingMs = 0;
			}

			// Morale — idle decay
			if (state === "idle") {
				const wisMod = 1 - attrVal(attrs, "wis") / 40;
				needs.morale = clamp(needs.morale - this.config.decay.morale.idlePerMinute * wisMod * deltaMins);
			}
		}
	}

	getNeeds(agentName: string): Readonly<AgentNeeds> {
		const entry = this.entries.get(agentName);
		if (!entry) return { energy: 0, social: 0, focus: 0, morale: 0 };
		return { ...entry.needs };
	}

	getMood(agentName: string): string {
		const entry = this.entries.get(agentName);
		if (!entry) return "neutral";
		const { needs } = entry;

		if (needs.morale < 30) return "frustrated";
		if (Date.now() - entry.lastTaskCompletedAt < 60_000) return "inspired";
		if (needs.morale > 70 && needs.energy > 50) return "happy";
		if (needs.focus > 70 && needs.energy > 40) return "focused";
		if (needs.social > 80 && needs.morale > 50) return "empathetic";
		return "neutral";
	}

	applyEffect(agentName: string, effect: Partial<AgentNeeds>): void {
		const entry = this.entries.get(agentName);
		if (!entry) return;
		if (effect.energy !== undefined) entry.needs.energy = clamp(entry.needs.energy + effect.energy);
		if (effect.social !== undefined) entry.needs.social = clamp(entry.needs.social + effect.social);
		if (effect.focus !== undefined) entry.needs.focus = clamp(entry.needs.focus + effect.focus);
		if (effect.morale !== undefined) entry.needs.morale = clamp(entry.needs.morale + effect.morale);
	}

	markTaskCompleted(agentName: string): void {
		const entry = this.entries.get(agentName);
		if (entry) entry.lastTaskCompletedAt = Date.now();
	}

	getAgentNames(): readonly string[] {
		return [...this.entries.keys()];
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/game/systems/needs-system.test.ts --reporter=verbose`
Expected: PASS (all tests)

- [ ] **Step 5: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/game/systems/needs-system.ts tests/game/systems/needs-system.test.ts
git commit -m "feat(world): add NeedsSystem with personality-weighted decay, restore, and mood derivation"
```

---

## Chunk 3: DirectorSystem — Cursor Spirit and Context Signals

### Task 4: DirectorSystem — cursor tracking, idle timer, context signals

**Files:**
- Create: `src/game/systems/director-system.ts`
- Test: `tests/game/systems/director-system.test.ts`

**Reference:** Spec Section 2 — Director Presence.

- [ ] **Step 1: Write failing tests for DirectorSystem**

```typescript
// tests/game/systems/director-system.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { DirectorSystem } from "../../../src/game/systems/director-system.js";
import type { DirectorPresence } from "../../../src/game/systems/director-system.js";

describe("DirectorSystem", () => {
	let system: DirectorSystem;

	beforeEach(() => {
		system = new DirectorSystem();
	});

	describe("initial state", () => {
		it("starts with no presence", () => {
			const p = system.getPresence();
			expect(p.worldPos).toBeNull();
			expect(p.visible).toBe(false);
			expect(p.idleMs).toBe(0);
			expect(p.lastInteraction).toBeNull();
		});
	});

	describe("cursor tracking", () => {
		it("updates world position on mouse move", () => {
			system.onMouseMove(100, 200);
			const p = system.getPresence();
			expect(p.worldPos).toEqual({ x: 100, y: 200 });
			expect(p.visible).toBe(true);
		});

		it("clears position on mouse leave", () => {
			system.onMouseMove(100, 200);
			system.onMouseLeave();
			const p = system.getPresence();
			expect(p.worldPos).toBeNull();
			expect(p.visible).toBe(false);
		});
	});

	describe("idle timer", () => {
		it("increments idle time on update when no interaction", () => {
			system.update(5000);
			expect(system.getPresence().idleMs).toBe(5000);
		});

		it("resets idle timer on interaction", () => {
			system.update(10_000);
			system.recordInteraction("click", { x: 50, y: 50 });
			expect(system.getPresence().idleMs).toBe(0);
		});

		it("continues accumulating after reset", () => {
			system.recordInteraction("click", { x: 50, y: 50 });
			system.update(3000);
			expect(system.getPresence().idleMs).toBe(3000);
		});
	});

	describe("interactions", () => {
		it("records click interaction", () => {
			system.recordInteraction("click", { x: 10, y: 20 });
			const p = system.getPresence();
			expect(p.lastInteraction).not.toBeNull();
			expect(p.lastInteraction!.type).toBe("click");
			expect(p.lastInteraction!.worldPos).toEqual({ x: 10, y: 20 });
		});

		it("records praise interaction", () => {
			system.recordInteraction("praise", { x: 30, y: 40 });
			expect(system.getPresence().lastInteraction!.type).toBe("praise");
		});

		it("overwrites previous interaction", () => {
			system.recordInteraction("click", { x: 10, y: 20 });
			system.recordInteraction("message", { x: 30, y: 40 });
			expect(system.getPresence().lastInteraction!.type).toBe("message");
		});
	});

	describe("agent awareness helpers", () => {
		it("returns distance to cursor from a given point", () => {
			system.onMouseMove(100, 100);
			const dist = system.distanceTo(100, 140);
			expect(dist).toBe(40);
		});

		it("returns Infinity when cursor not visible", () => {
			expect(system.distanceTo(100, 100)).toBe(Infinity);
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/systems/director-system.test.ts --reporter=verbose`
Expected: FAIL — module not found

- [ ] **Step 3: Implement director-system.ts**

```typescript
// src/game/systems/director-system.ts

export interface DirectorPresence {
	readonly worldPos: { x: number; y: number } | null;
	readonly visible: boolean;
	readonly idleMs: number;
	readonly lastInteraction: {
		readonly type: "click" | "message" | "permission" | "praise";
		readonly worldPos: { x: number; y: number };
		readonly timestamp: number;
	} | null;
}

type InteractionType = DirectorPresence["lastInteraction"] extends { type: infer T } | null ? T : never;

export class DirectorSystem {
	private worldPos: { x: number; y: number } | null = null;
	private visible = false;
	private idleMs = 0;
	private lastInteraction: DirectorPresence["lastInteraction"] = null;

	update(deltaMs: number): void {
		this.idleMs += deltaMs;
	}

	getPresence(): DirectorPresence {
		return {
			worldPos: this.worldPos ? { ...this.worldPos } : null,
			visible: this.visible,
			idleMs: this.idleMs,
			lastInteraction: this.lastInteraction,
		};
	}

	onMouseMove(worldX: number, worldY: number): void {
		this.worldPos = { x: worldX, y: worldY };
		this.visible = true;
	}

	onMouseLeave(): void {
		this.worldPos = null;
		this.visible = false;
	}

	recordInteraction(
		type: InteractionType,
		worldPos: { x: number; y: number },
	): void {
		this.idleMs = 0;
		this.lastInteraction = {
			type,
			worldPos: { ...worldPos },
			timestamp: Date.now(),
		};
	}

	distanceTo(x: number, y: number): number {
		if (!this.worldPos) return Infinity;
		const dx = this.worldPos.x - x;
		const dy = this.worldPos.y - y;
		return Math.sqrt(dx * dx + dy * dy);
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/game/systems/director-system.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/systems/director-system.ts tests/game/systems/director-system.test.ts
git commit -m "feat(world): add DirectorSystem with cursor tracking, idle timer, and context signals"
```

---

## Chunk 4: Existing System Modifications — BubbleSystem Priority, BrainSystem walkTo, SocialSystem Clusters

### Task 5: BubbleSystem priority flag

**Files:**
- Modify: `src/game/systems/bubble-system.ts`
- Test: `tests/game/systems/bubble-system.test.ts`

**Reference:** Spec Section 4 — BubbleSystem Priority Flag. Read `src/game/systems/bubble-system.ts` for current `showBubble()` implementation.

- [ ] **Step 1: Write failing test for priority bypass**

```typescript
// tests/game/systems/bubble-system.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { BubbleSystem } from "../../../src/game/systems/bubble-system.js";

// Minimal mock actor with addChild
function mockActor() {
	return {
		addChild: vi.fn(),
		children: [] as unknown[],
		pos: { x: 0, y: 0 },
	};
}

function mockGetActor(actor: ReturnType<typeof mockActor>) {
	return (_name: string) => actor as unknown as ReturnType<typeof mockActor>;
}

describe("BubbleSystem priority flag", () => {
	let system: BubbleSystem;

	beforeEach(() => {
		system = new BubbleSystem();
		system.register("alice", [], { speedMultiplier: 1, socialRadius: 100, focusDuration: 10000, idleResistance: 8000, quoteFrequency: 20000 });
	});

	it("throttles non-priority bubbles within 500ms", () => {
		const actor = mockActor();
		const getActor = mockGetActor(actor);
		const scene = {} as unknown;

		system.showBubble("alice", "speech", "first", scene, getActor as never);
		system.showBubble("alice", "speech", "second", scene, getActor as never);

		// Second bubble should be throttled (only 1 addChild call)
		expect(actor.addChild).toHaveBeenCalledTimes(1);
	});

	it("allows priority bubbles to bypass throttle", () => {
		const actor = mockActor();
		const getActor = mockGetActor(actor);
		const scene = {} as unknown;

		system.showBubble("alice", "speech", "first", scene, getActor as never);
		system.showBubble("alice", "speech", "priority!", scene, getActor as never, 5000, true);

		// Priority bubble should bypass — 2 addChild calls
		expect(actor.addChild).toHaveBeenCalledTimes(2);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/systems/bubble-system.test.ts --reporter=verbose`
Expected: FAIL — second assertion fails (priority bubble gets throttled)

- [ ] **Step 3: Add priority parameter to showBubble()**

Read `src/game/systems/bubble-system.ts`, find the `showBubble` method. Add `priority?: boolean` as the 7th parameter. In the throttle check, skip the 500ms check when `priority === true`:

```typescript
// In the showBubble method, modify the throttle guard:
// BEFORE:
// if (entry.lastBubbleTime && now - entry.lastBubbleTime < 500) return;
// AFTER:
if (!priority && entry.lastBubbleTime && now - entry.lastBubbleTime < 500) return;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/game/systems/bubble-system.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/systems/bubble-system.ts tests/game/systems/bubble-system.test.ts
git commit -m "feat(world): add priority flag to BubbleSystem.showBubble() to bypass throttle"
```

---

### Task 6: BrainSystem walkTo method

**Files:**
- Modify: `src/game/systems/brain-system.ts`
- Modify: `src/game/brain/brain-types.ts`
- Test: `tests/game/systems/brain-system.test.ts`

**Reference:** Spec Section 5 — Movement Override. Read `src/game/systems/brain-system.ts` for existing state management.

- [ ] **Step 1: Write failing test for walkTo**

```typescript
// tests/game/systems/brain-system.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { BrainSystem } from "../../../src/game/systems/brain-system.js";

describe("BrainSystem.walkTo", () => {
	let system: BrainSystem;

	beforeEach(() => {
		system = new BrainSystem({
			bounds: { minX: 0, maxX: 800, minY: 0, maxY: 500 },
			onWorkstationChange: vi.fn(),
			onWorkstationResolve: vi.fn(() => null),
		});
		system.register("alice", { str: 10, int: 10, wis: 10, cha: 10, dex: 10, con: 10 }, "happy", "engineering");
	});

	it("sets agent to walking-to state with custom target", () => {
		system.walkTo("alice", { x: 200, y: 300 });
		const state = system.getState("alice");
		expect(state).toBeDefined();
		expect(state!.state).toBe("walking-to");
	});

	it("does nothing for unknown agent", () => {
		// Should not throw
		system.walkTo("ghost", { x: 100, y: 100 });
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/systems/brain-system.test.ts --reporter=verbose`
Expected: FAIL — walkTo is not a function

- [ ] **Step 3: Add "custom" to MovementTarget.kind in brain-types.ts**

Read `src/game/brain/brain-types.ts`. Add `"custom"` to the `kind` union in `MovementTarget`:

```typescript
// BEFORE:
readonly kind: "wander" | "workstation" | "agent" | "doorway" | "none"
// AFTER:
readonly kind: "wander" | "workstation" | "agent" | "doorway" | "none" | "custom"
```

- [ ] **Step 4: Add walkTo method to brain-system.ts**

Read `src/game/systems/brain-system.ts`. Add a new public method after `assignWork`:

```typescript
walkTo(name: string, target: { x: number; y: number }): void {
	const entry = this.entries.get(name);
	if (!entry) return;
	entry.state = "walking-to";
	entry.target = { kind: "custom", x: target.x, y: target.y };
	entry.targetPos = { x: target.x, y: target.y };
}
```

Also ensure the walking-to arrival logic handles `kind: "custom"` — when the agent arrives at a custom target, it should transition to `"idle"` (same as non-workstation arrivals). Check the existing arrival handler in `update()` to verify this path already works for non-workstation targets.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/game/systems/brain-system.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 6: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/game/systems/brain-system.ts src/game/brain/brain-types.ts tests/game/systems/brain-system.test.ts
git commit -m "feat(world): add BrainSystem.walkTo() for arbitrary position movement"
```

---

### Task 7: SocialSystem cluster detection

**Files:**
- Modify: `src/game/systems/social-system.ts`
- Test: `tests/game/systems/social-system.test.ts`

**Reference:** Spec Section 4 — Emergent Clusters. Read `src/game/systems/social-system.ts` for existing pair detection.

- [ ] **Step 1: Write failing test for cluster detection**

```typescript
// tests/game/systems/social-system.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { SocialSystem } from "../../../src/game/systems/social-system.js";
import type { AgentNeeds } from "../../../src/game/systems/needs-system.js";

const fullNeeds: AgentNeeds = { energy: 80, social: 60, focus: 70, morale: 75 };
const lowFocus: AgentNeeds = { energy: 80, social: 60, focus: 15, morale: 75 };

describe("SocialSystem cluster detection", () => {
	let system: SocialSystem;
	let clusterCallback: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		system = new SocialSystem();
		clusterCallback = vi.fn();
		system.onCluster(clusterCallback);

		// Register 3 agents with socialRadius 100
		system.register("alice", { domain: "engineering", personality: [], socialRadius: 100, relationships: [] });
		system.register("bob", { domain: "engineering", personality: [], socialRadius: 100, relationships: [] });
		system.register("charlie", { domain: "engineering", personality: [], socialRadius: 100, relationships: [] });
	});

	it("fires cluster callback when 3+ idle agents are near for 6s", () => {
		const getPosition = (name: string) => ({ x: name === "charlie" ? 20 : 0, y: 0 });
		const getState = () => "idle" as const;
		const getNeeds = () => fullNeeds;

		// Simulate 7 seconds of proximity (above 6s threshold)
		for (let i = 0; i < 7; i++) {
			system.update(1000, getPosition, getState, getNeeds);
		}

		expect(clusterCallback).toHaveBeenCalledTimes(1);
		const [agents] = clusterCallback.mock.calls[0];
		expect(agents).toHaveLength(3);
	});

	it("does not fire cluster for agents with focus < 20", () => {
		const getPosition = () => ({ x: 0, y: 0 });
		const getState = () => "idle" as const;
		const getNeeds = (name: string) => name === "alice" ? lowFocus : fullNeeds;

		for (let i = 0; i < 7; i++) {
			system.update(1000, getPosition, getState, getNeeds);
		}

		// Alice excluded due to low focus — only 2 agents left, below cluster threshold
		expect(clusterCallback).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/systems/social-system.test.ts --reporter=verbose`
Expected: FAIL — onCluster is not a function / update() arity mismatch

- [ ] **Step 3: Extend SocialSystem**

Read `src/game/systems/social-system.ts`. Add:

1. A 4th parameter `getNeeds` to `update()` signature
2. An `onCluster(cb)` callback registration method
3. Cluster detection logic using union-find on existing proximity pairs:
   - Track cluster proximity timer (separate from pair timer)
   - When 3+ idle agents (with focus >= 20) within socialRadius for 6s → fire cluster callback
   - Cluster cooldown: 180s for same group composition (hash the sorted agent names)

Key implementation points:
- Reuse existing `pairKey()` function to detect proximity pairs
- Build adjacency from pairs, then find connected components via union-find
- Filter components to only include idle agents with `getNeeds(name).focus >= 20`
- Fire callback with the agent name array when component size >= `clusterMinAgents`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/game/systems/social-system.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/game/systems/social-system.ts tests/game/systems/social-system.test.ts
git commit -m "feat(world): add cluster detection to SocialSystem with focus-gated participation"
```

---

## Chunk 5: SensorSystem — Project-Aware Event Reactions

### Task 8: SensorSystem — event processing, rule evaluation, cooldowns

**Files:**
- Create: `src/game/systems/sensor-system.ts`
- Create: `src/game/data/sensor-rules.ts`
- Test: `tests/game/systems/sensor-system.test.ts`

**Reference:** Spec Section 3 — Sensor System.

- [ ] **Step 1: Write failing tests for SensorSystem**

```typescript
// tests/game/systems/sensor-system.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { SensorSystem } from "../../../src/game/systems/sensor-system.js";

describe("SensorSystem", () => {
	let system: SensorSystem;
	let reactionCallback: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		system = new SensorSystem();
		reactionCallback = vi.fn();
		system.onReaction(reactionCallback);
		system.register("alice", "quality");
		system.register("bob", "engineering");
	});

	describe("event processing", () => {
		it("fires reaction for matching rule", () => {
			system.pushEvent({ type: "test-pass", data: { passCount: 100, failCount: 0 } });
			system.update(0);
			expect(reactionCallback).toHaveBeenCalledTimes(1);
			const [reaction] = reactionCallback.mock.calls[0];
			expect(reaction.agentName).toBe("alice"); // nearest quality-domain
		});

		it("does not fire when on global cooldown", () => {
			system.pushEvent({ type: "test-pass", data: { passCount: 100, failCount: 0 } });
			system.update(0);
			expect(reactionCallback).toHaveBeenCalledTimes(1);

			// Push another event immediately — should be cooled down
			system.pushEvent({ type: "build-success", data: {} });
			system.update(0);
			expect(reactionCallback).toHaveBeenCalledTimes(1); // no new call
		});

		it("fires after cooldown expires", () => {
			system.pushEvent({ type: "test-pass", data: { passCount: 100, failCount: 0 } });
			system.update(0);

			// Advance past global cooldown (10s)
			system.update(11_000);
			system.pushEvent({ type: "build-success", data: {} });
			system.update(0);
			expect(reactionCallback).toHaveBeenCalledTimes(2);
		});
	});

	describe("agent filtering", () => {
		it("selects nearest domain-match agent", () => {
			system.pushEvent({ type: "test-fail", data: { passCount: 90, failCount: 10 } });
			system.update(0);
			const [reaction] = reactionCallback.mock.calls[0];
			expect(reaction.agentName).toBe("alice"); // quality domain
		});
	});

	describe("domain path matching", () => {
		it("matches file path to domain", () => {
			system.pushEvent({ type: "file-saved", data: { path: "src/domain/foo.ts" } });
			system.update(0);
			const [reaction] = reactionCallback.mock.calls[0];
			expect(reaction.agentName).toBe("bob"); // engineering domain
		});
	});

	describe("rule overrides", () => {
		it("disables a rule via override", () => {
			system.applyOverrides([{ id: "test-pass", enabled: false }]);
			system.pushEvent({ type: "test-pass", data: { passCount: 100, failCount: 0 } });
			system.update(0);
			expect(reactionCallback).not.toHaveBeenCalled();
		});
	});

	describe("feedback queue", () => {
		it("accepts tool result feedback for next frame processing", () => {
			system.pushFeedback({ type: "test-pass", data: { passCount: 100, failCount: 0 } });
			// Not processed in current frame
			system.update(11_000);
			expect(reactionCallback).not.toHaveBeenCalled();

			// Processed next update
			system.update(0);
			expect(reactionCallback).toHaveBeenCalledTimes(1);
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/systems/sensor-system.test.ts --reporter=verbose`
Expected: FAIL — module not found

- [ ] **Step 3: Implement sensor-rules.ts**

```typescript
// src/game/data/sensor-rules.ts
import type { BubbleKind } from "../systems/talk/talk-types.js";
import type { AgentNeeds } from "../systems/needs-system.js";

export type SensorEventType =
	| "test-pass" | "test-fail" | "test-delta"
	| "build-success" | "build-failure"
	| "health-improved" | "health-dropped"
	| "iteration-milestone"
	| "file-saved" | "file-opened";

export interface SensorEventData {
	readonly type: SensorEventType;
	readonly data: Record<string, unknown>;
}

export interface SensorReaction {
	readonly agentName: string;
	readonly bubble?: { readonly kind: BubbleKind; readonly text: string };
	readonly emote?: number;
	readonly needsEffect?: Partial<AgentNeeds>;
	readonly brainEvent?: string;
}

export interface SensorRule {
	readonly id: string;
	readonly event: SensorEventType;
	readonly condition?: (data: Record<string, unknown>) => boolean;
	readonly agentFilter: "nearest-domain" | "all" | "domain-match";
	readonly domainHint?: string;
	readonly reaction: {
		readonly bubble?: { readonly kind: BubbleKind; readonly template: string };
		readonly emote?: number;
		readonly needsEffect?: Partial<AgentNeeds>;
		readonly brainEvent?: string;
	};
	readonly cooldown: number;
}

export const DEFAULT_SENSOR_RULES: readonly SensorRule[] = [
	{
		id: "test-pass",
		event: "test-pass",
		condition: (d) => (d.failCount as number) === 0,
		agentFilter: "nearest-domain",
		domainHint: "quality",
		reaction: {
			bubble: { kind: "speech", template: "All green!" },
			needsEffect: { morale: 3 },
		},
		cooldown: 30_000,
	},
	{
		id: "test-fail",
		event: "test-fail",
		condition: (d) => (d.failCount as number) > 0,
		agentFilter: "nearest-domain",
		domainHint: "quality",
		reaction: {
			bubble: { kind: "speech", template: "{failCount} failures... let me look" },
			needsEffect: { morale: -2 },
		},
		cooldown: 30_000,
	},
	{
		id: "build-success",
		event: "build-success",
		agentFilter: "nearest-domain",
		domainHint: "operations",
		reaction: {
			bubble: { kind: "speech", template: "Build complete!" },
			needsEffect: { morale: 2 },
		},
		cooldown: 30_000,
	},
	{
		id: "build-failure",
		event: "build-failure",
		agentFilter: "nearest-domain",
		domainHint: "operations",
		reaction: {
			bubble: { kind: "speech", template: "Build broke." },
			emote: 10,
			needsEffect: { morale: -2 },
		},
		cooldown: 30_000,
	},
	{
		id: "health-improved",
		event: "health-improved",
		agentFilter: "nearest-domain",
		domainHint: "management",
		reaction: {
			bubble: { kind: "speech", template: "Health score went up to {score}!" },
		},
		cooldown: 60_000,
	},
	{
		id: "health-dropped",
		event: "health-dropped",
		agentFilter: "nearest-domain",
		domainHint: "management",
		reaction: {
			bubble: { kind: "thought", template: "Health dipped to {score}..." },
		},
		cooldown: 60_000,
	},
	{
		id: "test-delta",
		event: "test-delta",
		condition: (d) => (d.failDelta as number) > 0,
		agentFilter: "nearest-domain",
		domainHint: "quality",
		reaction: {
			bubble: { kind: "thought", template: "That's more failures than before..." },
			emote: 10,
		},
		cooldown: 30_000,
	},
	{
		id: "iteration-milestone",
		event: "iteration-milestone",
		agentFilter: "all",
		reaction: {
			bubble: { kind: "speech", template: "Iteration at {percent}%!" },
			needsEffect: { morale: 3 },
		},
		cooldown: 60_000,
	},
	{
		id: "file-saved",
		event: "file-saved",
		agentFilter: "domain-match",
		reaction: {
			bubble: { kind: "thought", template: "Changes in {filename}..." },
		},
		cooldown: 30_000,
	},
	{
		id: "file-opened",
		event: "file-opened",
		agentFilter: "domain-match",
		reaction: {
			bubble: { kind: "thought", template: "Looking at {filename}?" },
		},
		cooldown: 60_000,
	},
];
```

- [ ] **Step 4: Implement sensor-system.ts**

```typescript
// src/game/systems/sensor-system.ts
import type { SensorEventData, SensorReaction, SensorRule } from "../data/sensor-rules.js";
import type { SensorRuleOverride } from "../data/world-config.js";
import { DEFAULT_SENSOR_RULES } from "../data/sensor-rules.js";
import { DEFAULT_WORLD_CONFIG } from "../data/world-config.js";

interface AgentEntry {
	readonly name: string;
	readonly domain: string;
}

export class SensorSystem {
	private readonly agents = new Map<string, AgentEntry>();
	private readonly eventQueue: SensorEventData[] = [];
	private readonly feedbackQueue: SensorEventData[] = [];
	private readonly ruleCooldowns = new Map<string, number>();
	private readonly disabledRules = new Set<string>();
	private readonly cooldownOverrides = new Map<string, number>();
	private globalCooldownRemaining = 0;
	private perAgentCooldowns = new Map<string, number>();
	private reactionCallback: ((reaction: SensorReaction) => void) | null = null;
	private rules: readonly SensorRule[] = DEFAULT_SENSOR_RULES;
	private readonly config = DEFAULT_WORLD_CONFIG.sensors;

	register(agentName: string, domain: string): void {
		this.agents.set(agentName, { name: agentName, domain });
	}

	unregister(agentName: string): void {
		this.agents.delete(agentName);
	}

	onReaction(cb: (reaction: SensorReaction) => void): void {
		this.reactionCallback = cb;
	}

	pushEvent(event: SensorEventData): void {
		this.eventQueue.push(event);
	}

	pushFeedback(event: SensorEventData): void {
		this.feedbackQueue.push(event);
	}

	applyOverrides(overrides: readonly SensorRuleOverride[]): void {
		for (const o of overrides) {
			if (o.enabled === false) this.disabledRules.add(o.id);
			if (o.cooldown !== undefined) this.cooldownOverrides.set(o.id, o.cooldown);
		}
	}

	update(deltaMs: number): void {
		// Tick cooldowns
		this.globalCooldownRemaining = Math.max(0, this.globalCooldownRemaining - deltaMs);
		for (const [id, remaining] of this.ruleCooldowns) {
			const next = remaining - deltaMs;
			if (next <= 0) this.ruleCooldowns.delete(id);
			else this.ruleCooldowns.set(id, next);
		}
		for (const [name, remaining] of this.perAgentCooldowns) {
			const next = remaining - deltaMs;
			if (next <= 0) this.perAgentCooldowns.delete(name);
			else this.perAgentCooldowns.set(name, next);
		}

		// Move feedback to event queue for next frame
		const feedback = this.feedbackQueue.splice(0);
		this.eventQueue.push(...feedback);

		// Process events
		if (this.globalCooldownRemaining > 0) {
			// Keep events for next frame when on cooldown? No — drop, they're stale
			// Actually: keep unprocessed events for when cooldown clears
			return;
		}

		while (this.eventQueue.length > 0) {
			if (this.globalCooldownRemaining > 0) break;

			const event = this.eventQueue.shift()!;
			this.processEvent(event);
		}
	}

	private processEvent(event: SensorEventData): void {
		for (const rule of this.rules) {
			if (rule.event !== event.type) continue;
			if (this.disabledRules.has(rule.id)) continue;
			if (this.ruleCooldowns.has(rule.id)) continue;
			if (rule.condition && !rule.condition(event.data)) continue;

			const agent = this.selectAgent(rule, event);
			if (!agent) continue;
			if (this.perAgentCooldowns.has(agent.name)) continue;

			const reaction = this.buildReaction(rule, agent, event);
			this.reactionCallback?.(reaction);

			// Set cooldowns
			const ruleCd = this.cooldownOverrides.get(rule.id) ?? rule.cooldown;
			this.ruleCooldowns.set(rule.id, ruleCd);
			this.globalCooldownRemaining = this.config.globalCooldown;
			this.perAgentCooldowns.set(agent.name, this.config.perAgentCooldown);
			break; // first match wins
		}
	}

	private selectAgent(rule: SensorRule, event: SensorEventData): AgentEntry | undefined {
		if (rule.agentFilter === "nearest-domain" && rule.domainHint) {
			for (const agent of this.agents.values()) {
				if (agent.domain === rule.domainHint) return agent;
			}
		}
		if (rule.agentFilter === "domain-match") {
			const path = event.data.path as string | undefined;
			if (path) {
				for (const agent of this.agents.values()) {
					const paths = this.config.domainPaths[agent.domain];
					if (paths?.some((p) => path.includes(p))) return agent;
				}
			}
		}
		if (rule.agentFilter === "all") {
			// Return first agent — caller should iterate
			return this.agents.values().next().value;
		}
		return undefined;
	}

	private buildReaction(rule: SensorRule, agent: AgentEntry, event: SensorEventData): SensorReaction {
		let bubbleText: string | undefined;
		if (rule.reaction.bubble) {
			bubbleText = rule.reaction.bubble.template.replace(
				/\{(\w+)\}/g,
				(match, key: string) => {
					if (key === "filename" && typeof event.data.path === "string") {
						return event.data.path.split("/").pop() ?? match;
					}
					const val = event.data[key];
					return val !== undefined ? String(val) : match;
				},
			);
		}

		return {
			agentName: agent.name,
			bubble: bubbleText ? { kind: rule.reaction.bubble!.kind, text: bubbleText } : undefined,
			emote: rule.reaction.emote,
			needsEffect: rule.reaction.needsEffect,
			brainEvent: rule.reaction.brainEvent,
		};
	}
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/game/systems/sensor-system.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 6: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/game/systems/sensor-system.ts src/game/data/sensor-rules.ts tests/game/systems/sensor-system.test.ts
git commit -m "feat(world): add SensorSystem with rule-based event processing, cooldowns, and domain matching"
```

---

## Chunk 6: EngagementSystem — Escalating Director Engagement

### Task 9: EngagementSystem — tier escalation, agent selection, response handling

**Files:**
- Create: `src/game/systems/engagement-system.ts`
- Test: `tests/game/systems/engagement-system.test.ts`

**Reference:** Spec Section 5 — Engagement System. Depends on DirectorSystem, NeedsSystem, SensorSystem.

- [ ] **Step 1: Write failing tests for EngagementSystem**

```typescript
// tests/game/systems/engagement-system.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { EngagementSystem } from "../../../src/game/systems/engagement-system.js";
import type { AgentNeeds } from "../../../src/game/systems/needs-system.js";
import type { DirectorPresence } from "../../../src/game/systems/director-system.js";

const defaultNeeds: AgentNeeds = { energy: 80, social: 60, focus: 70, morale: 75 };
const idlePresence = (idleMs: number): DirectorPresence => ({
	worldPos: null, visible: false, idleMs, lastInteraction: null,
});

describe("EngagementSystem", () => {
	let system: EngagementSystem;
	let engagementCallback: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		system = new EngagementSystem();
		engagementCallback = vi.fn();
		system.onEngagement(engagementCallback);
		system.register("alice", { domain: "quality", cha: 14 });
		system.register("bob", { domain: "engineering", cha: 8 });
	});

	it("stays at tier 0 when director is active", () => {
		system.update(0, () => idlePresence(0), () => defaultNeeds, () => "idle", () => false);
		expect(engagementCallback).not.toHaveBeenCalled();
	});

	it("escalates to tier 1 (ambient) after 30s idle", () => {
		system.update(0, () => idlePresence(31_000), () => defaultNeeds, () => "idle", () => false);
		expect(engagementCallback).toHaveBeenCalledTimes(1);
		const [engagement] = engagementCallback.mock.calls[0];
		expect(engagement.tier).toBe(1);
	});

	it("escalates to tier 2 (nudge) after 90s idle", () => {
		system.update(0, () => idlePresence(91_000), () => defaultNeeds, () => "idle", () => false);
		expect(engagementCallback).toHaveBeenCalledTimes(1);
		const [engagement] = engagementCallback.mock.calls[0];
		expect(engagement.tier).toBe(2);
	});

	it("escalates to tier 3 (offer) after 180s idle", () => {
		system.update(0, () => idlePresence(181_000), () => defaultNeeds, () => "idle", () => false);
		expect(engagementCallback).toHaveBeenCalledTimes(1);
		const [engagement] = engagementCallback.mock.calls[0];
		expect(engagement.tier).toBe(3);
	});

	it("never exceeds tier 3", () => {
		system.update(0, () => idlePresence(999_999), () => defaultNeeds, () => "idle", () => false);
		const [engagement] = engagementCallback.mock.calls[0];
		expect(engagement.tier).toBe(3);
	});

	it("selects highest-CHA idle agent as fallback", () => {
		system.update(0, () => idlePresence(31_000), () => defaultNeeds, () => "idle", () => false);
		const [engagement] = engagementCallback.mock.calls[0];
		expect(engagement.agentName).toBe("alice"); // CHA 14 > bob's 8
	});

	it("prefers agent with low morale", () => {
		const getNeeds = (name: string) =>
			name === "bob" ? { ...defaultNeeds, morale: 20 } : defaultNeeds;
		system.update(0, () => idlePresence(31_000), getNeeds, () => "idle", () => false);
		const [engagement] = engagementCallback.mock.calls[0];
		expect(engagement.agentName).toBe("bob");
	});

	it("respects frequency limit — does not fire twice within tier frequency", () => {
		system.update(0, () => idlePresence(31_000), () => defaultNeeds, () => "idle", () => false);
		expect(engagementCallback).toHaveBeenCalledTimes(1);

		// 10s later — within 45s frequency for tier 1
		system.update(10_000, () => idlePresence(41_000), () => defaultNeeds, () => "idle", () => false);
		expect(engagementCallback).toHaveBeenCalledTimes(1); // no new call
	});

	it("resets on director interaction (idleMs drops to 0)", () => {
		system.update(0, () => idlePresence(31_000), () => defaultNeeds, () => "idle", () => false);
		expect(engagementCallback).toHaveBeenCalledTimes(1);

		// Director interacts — idleMs resets
		system.update(50_000, () => idlePresence(0), () => defaultNeeds, () => "idle", () => false);
		// No new engagement while active
		expect(engagementCallback).toHaveBeenCalledTimes(1);
	});

	it("skips busy agents", () => {
		const getState = (name: string) => name === "alice" ? "working" as const : "idle" as const;
		system.update(0, () => idlePresence(31_000), () => defaultNeeds, getState, () => false);
		const [engagement] = engagementCallback.mock.calls[0];
		expect(engagement.agentName).toBe("bob"); // alice is working
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/systems/engagement-system.test.ts --reporter=verbose`
Expected: FAIL — module not found

- [ ] **Step 3: Implement engagement-system.ts**

```typescript
// src/game/systems/engagement-system.ts
import type { DirectorPresence } from "./director-system.js";
import type { AgentNeeds } from "./needs-system.js";
import type { BrainState } from "../brain/brain-types.js";
import { DEFAULT_WORLD_CONFIG } from "../data/world-config.js";
import { TIER1_TEMPLATES, TIER2_TEMPLATES, TIER3_TEMPLATES, interpolateTemplate } from "../data/engagement-templates.js";

export interface EngagementEvent {
	readonly tier: number;
	readonly agentName: string;
	readonly text: string;
	readonly bubbleKind: "thought" | "speech";
	readonly toolOfferId?: string;
}

interface AgentEntry {
	readonly name: string;
	readonly domain: string;
	readonly cha: number;
}

const IDLE_STATES: ReadonlySet<BrainState> = new Set(["idle", "on-break", "waiting"]);

export class EngagementSystem {
	private readonly agents = new Map<string, AgentEntry>();
	private readonly taskCompletedAgents = new Set<string>();
	private callback: ((e: EngagementEvent) => void) | null = null;
	private lastEngagementAt = 0;
	private activeEngagement = false;
	private readonly config = DEFAULT_WORLD_CONFIG.engagement;
	private elapsedMs = 0;

	register(agentName: string, info: { domain: string; cha: number }): void {
		this.agents.set(agentName, { name: agentName, ...info });
	}

	unregister(agentName: string): void {
		this.agents.delete(agentName);
	}

	onEngagement(cb: (e: EngagementEvent) => void): void {
		this.callback = cb;
	}

	update(
		deltaMs: number,
		getPresence: () => DirectorPresence,
		getNeeds: (name: string) => AgentNeeds,
		getBrainState: (name: string) => BrainState,
		hasPendingSensor: (name: string) => boolean,
	): void {
		this.elapsedMs += deltaMs;
		const presence = getPresence();

		// Tier 0 — director is active
		if (presence.idleMs < this.config.tiers.ambient.idleMs) {
			this.activeEngagement = false;
			return;
		}

		// Determine current tier
		const tier = this.computeTier(presence.idleMs);
		const frequency = this.getFrequency(tier);

		// Frequency check
		if (this.elapsedMs - this.lastEngagementAt < frequency) return;
		if (this.activeEngagement) return;

		// Select agent
		const agent = this.selectAgent(getNeeds, getBrainState, hasPendingSensor);
		if (!agent) return;

		// Pick template and fire
		const { text, bubbleKind } = this.pickTemplate(tier);
		this.callback?.({ tier, agentName: agent.name, text, bubbleKind });
		this.lastEngagementAt = this.elapsedMs;
		this.activeEngagement = true;
	}

	dismissEngagement(): void {
		this.activeEngagement = false;
	}

	markTaskCompleted(agentName: string): void {
		this.taskCompletedAgents.add(agentName);
	}

	clearTaskCompleted(agentName: string): void {
		this.taskCompletedAgents.delete(agentName);
	}

	private computeTier(idleMs: number): number {
		if (idleMs >= this.config.tiers.offer.idleMs) return Math.min(3, this.config.maxTier);
		if (idleMs >= this.config.tiers.nudge.idleMs) return Math.min(2, this.config.maxTier);
		return 1;
	}

	private getFrequency(tier: number): number {
		if (tier >= 3) return this.config.tiers.offer.frequency;
		if (tier >= 2) return this.config.tiers.nudge.frequency;
		return this.config.tiers.ambient.frequency;
	}

	private selectAgent(
		getNeeds: (name: string) => AgentNeeds,
		getBrainState: (name: string) => BrainState,
		hasPendingSensor: (name: string) => boolean,
	): AgentEntry | undefined {
		const idle = [...this.agents.values()].filter(
			(a) => IDLE_STATES.has(getBrainState(a.name)),
		);
		if (idle.length === 0) return undefined;

		// Priority 1: pending sensor event
		const withSensor = idle.find((a) => hasPendingSensor(a.name));
		if (withSensor) return withSensor;

		// Priority 2: low morale
		const lowMorale = idle.filter((a) => getNeeds(a.name).morale < 30);
		if (lowMorale.length > 0) return lowMorale[0];

		// Priority 3: completed task awaiting acknowledgment
		const taskDone = idle.find((a) => this.taskCompletedAgents.has(a.name));
		if (taskDone) return taskDone;

		// Priority 4: highest CHA
		return idle.sort((a, b) => b.cha - a.cha)[0];
	}

	private pickTemplate(tier: number): { text: string; bubbleKind: "thought" | "speech" } {
		const templates = tier >= 3 ? TIER3_TEMPLATES : tier >= 2 ? TIER2_TEMPLATES : TIER1_TEMPLATES;
		const template = templates[Math.floor(Math.random() * templates.length)];
		const text = interpolateTemplate(template, {});
		const bubbleKind = tier >= 2 ? "speech" : "thought";
		return { text, bubbleKind };
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/game/systems/engagement-system.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/game/systems/engagement-system.ts tests/game/systems/engagement-system.test.ts
git commit -m "feat(world): add EngagementSystem with escalating tiers, agent selection, and frequency limits"
```

---

## Chunk 7: RitualSystem and ToolExecutor

### Task 10: RitualSystem — markdown parsing and choreography

**Files:**
- Create: `src/game/systems/ritual-system.ts`
- Test: `tests/game/systems/ritual-system.test.ts`

**Reference:** Spec Section 4 — Configurable Rituals.

- [ ] **Step 1: Write failing tests for RitualSystem**

```typescript
// tests/game/systems/ritual-system.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { RitualSystem, parseRitualMarkdown } from "../../../src/game/systems/ritual-system.js";
import type { RitualDefinition } from "../../../src/game/systems/ritual-system.js";

describe("parseRitualMarkdown", () => {
	it("parses frontmatter and body", () => {
		const md = `---
name: standup
trigger: manual
participants: all
duration: 30s
cooldown: 24h
---

# Gathering
gather: center
settle: 2s

# Lines
- "Here's my status: I'm feeling {mood_adj} about {domain} work."
- "Nothing blocked on my end."

# Reactions
emote: random
disperse: true`;

		const result = parseRitualMarkdown(md);
		expect(result.name).toBe("standup");
		expect(result.trigger).toBe("manual");
		expect(result.participants).toBe("all");
		expect(result.duration).toBe(30_000);
		expect(result.cooldown).toBe(86_400_000);
		expect(result.gatherPoint).toBe("center");
		expect(result.settleMs).toBe(2000);
		expect(result.lines).toHaveLength(2);
		expect(result.lines[0]).toContain("{mood_adj}");
		expect(result.reactionEmote).toBe("random");
		expect(result.disperse).toBe(true);
	});

	it("parses schedule trigger", () => {
		const md = `---
name: morning
trigger: schedule
schedule: "09:00"
participants: all
duration: 20s
cooldown: 24h
---

# Lines
- "Good morning!"`;

		const result = parseRitualMarkdown(md);
		expect(result.trigger).toBe("schedule");
		expect(result.schedule).toBe("09:00");
	});

	it("parses event trigger", () => {
		const md = `---
name: celebrate
trigger: event
event: iteration-100
participants: all
duration: 10s
cooldown: 1h
---

# Reactions
emote: random
disperse: true`;

		const result = parseRitualMarkdown(md);
		expect(result.trigger).toBe("event");
		expect(result.event).toBe("iteration-100");
		expect(result.cooldown).toBe(3_600_000);
	});
});

describe("RitualSystem", () => {
	let system: RitualSystem;
	let phaseCallback: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		system = new RitualSystem();
		phaseCallback = vi.fn();
		system.onPhase(phaseCallback);
		system.register("alice", { domain: "engineering" });
		system.register("bob", { domain: "quality" });
	});

	it("does nothing when no rituals loaded", () => {
		system.update(1000, () => "idle");
		expect(phaseCallback).not.toHaveBeenCalled();
	});

	it("triggers manual ritual when requested", () => {
		const ritual: RitualDefinition = {
			name: "standup",
			trigger: "manual",
			participants: "all",
			duration: 30_000,
			cooldown: 60_000,
			gatherPoint: "center",
			settleMs: 2000,
			lines: ["Hello from {name}"],
			reactionEmote: "random",
			disperse: true,
		};
		system.loadRitual(ritual);
		system.triggerManual("standup");
		system.update(0, () => "idle");
		expect(phaseCallback).toHaveBeenCalled();
		const [phase] = phaseCallback.mock.calls[0];
		expect(phase.type).toBe("gather");
	});

	it("respects cooldown — cannot trigger same ritual twice within cooldown", () => {
		const ritual: RitualDefinition = {
			name: "standup",
			trigger: "manual",
			participants: "all",
			duration: 5000,
			cooldown: 60_000,
			gatherPoint: "center",
			settleMs: 1000,
			lines: ["Hi"],
			reactionEmote: "random",
			disperse: true,
		};
		system.loadRitual(ritual);
		system.triggerManual("standup");

		// Run through the full ritual
		system.update(0, () => "idle"); // gather
		system.update(6000, () => "idle"); // force end via duration

		// Try to trigger again — should be on cooldown
		system.triggerManual("standup");
		phaseCallback.mockClear();
		system.update(0, () => "idle");
		expect(phaseCallback).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/systems/ritual-system.test.ts --reporter=verbose`
Expected: FAIL — module not found

- [ ] **Step 3: Implement ritual-system.ts**

Create `src/game/systems/ritual-system.ts` with:
- `parseRitualMarkdown(md: string): RitualDefinition` — parses frontmatter (key: value lines between `---` delimiters) and body (gather/settle key-values, `-` prefixed template lines, emote/disperse config)
- `parseDuration(s: string): number` — converts "30s" → 30000, "2m" → 120000, "24h" → 86400000, "1h" → 3600000
- `RitualSystem` class with:
  - `register(name, info)` / `unregister(name)` — track agent participants
  - `loadRitual(def: RitualDefinition)` — add ritual to internal registry
  - `triggerManual(ritualName)` — start a manual ritual
  - `triggerEvent(eventKey)` — check if any event-triggered ritual matches
  - `onPhase(cb)` — callback for each choreography phase
  - `update(deltaMs, getBrainState)` — advance active ritual through phases: gather → settle → lines → reactions → disperse
  - Phase state machine tracks: which phase, elapsed time, current line index, participant list

The `RitualDefinition` interface:
```typescript
export interface RitualDefinition {
	name: string;
	trigger: "manual" | "schedule" | "event";
	schedule?: string;
	event?: string;
	participants: "all" | "nearby" | "idle" | string; // string for "domain:X"
	duration: number;
	cooldown: number;
	gatherPoint: "center" | { x: number; y: number };
	settleMs: number;
	lines: string[];
	reactionEmote: "random" | number;
	disperse: boolean;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/game/systems/ritual-system.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/systems/ritual-system.ts tests/game/systems/ritual-system.test.ts
git commit -m "feat(world): add RitualSystem with markdown parser and phase choreography"
```

---

### Task 11: ToolExecutor — command queue, approval, and result parsing

**Files:**
- Create: `src/game/systems/tool-executor-system.ts`
- Test: `tests/game/systems/tool-executor-system.test.ts`

**Reference:** Spec Section 6 — Tool Execution.

- [ ] **Step 1: Write failing tests for ToolExecutor**

```typescript
// tests/game/systems/tool-executor-system.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ToolExecutor } from "../../../src/game/systems/tool-executor-system.js";
import type { AgentTool } from "../../../src/game/data/world-config.js";

const testTool: AgentTool = {
	id: "run-tests",
	command: 'flowti test --project="{project}"',
	description: "Run tests",
	domain: ["quality"],
	trigger: "engagement",
	cooldown: 60_000,
	requiresApproval: true,
};

const readOnlyTool: AgentTool = {
	id: "health-check",
	command: 'flowti health --project="{project}"',
	description: "Health check",
	domain: ["management"],
	trigger: "engagement",
	cooldown: 300_000,
	requiresApproval: false,
};

describe("ToolExecutor", () => {
	let executor: ToolExecutor;
	let approvalCallback: ReturnType<typeof vi.fn>;
	let resultCallback: ReturnType<typeof vi.fn>;
	let executeCallback: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		executor = new ToolExecutor();
		approvalCallback = vi.fn();
		resultCallback = vi.fn();
		executeCallback = vi.fn(() => Promise.resolve({ success: true, output: '{"score": 85}' }));
		executor.onApprovalNeeded(approvalCallback);
		executor.onResult(resultCallback);
		executor.setExecutor(executeCallback);
		executor.registerTools([testTool, readOnlyTool]);
	});

	it("queues a tool request", () => {
		executor.queueTool("alice", "run-tests", { project: "Flowti CLI" });
		executor.update(0);

		// Requires approval — should fire approval callback
		expect(approvalCallback).toHaveBeenCalledTimes(1);
		expect(executeCallback).not.toHaveBeenCalled();
	});

	it("auto-executes read-only tools without approval", () => {
		executor.queueTool("bob", "health-check", { project: "Flowti CLI" });
		executor.update(0);

		expect(approvalCallback).not.toHaveBeenCalled();
		expect(executeCallback).toHaveBeenCalledTimes(1);
	});

	it("executes tool after approval granted", async () => {
		executor.queueTool("alice", "run-tests", { project: "Flowti CLI" });
		executor.update(0);
		executor.grantApproval("alice", "run-tests");
		executor.update(0);

		expect(executeCallback).toHaveBeenCalledTimes(1);
		const [command] = executeCallback.mock.calls[0];
		expect(command).toContain("Flowti CLI");
	});

	it("respects tool cooldown", () => {
		executor.queueTool("bob", "health-check", { project: "Flowti CLI" });
		executor.update(0);

		// Queue same tool again immediately
		executor.queueTool("bob", "health-check", { project: "Flowti CLI" });
		executor.update(0);

		// Should only execute once due to cooldown
		expect(executeCallback).toHaveBeenCalledTimes(1);
	});

	it("substitutes template variables in command", () => {
		executor.queueTool("bob", "health-check", { project: "My Project" });
		executor.update(0);

		const [command] = executeCallback.mock.calls[0];
		expect(command).toBe('flowti health --project="My Project"');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/systems/tool-executor-system.test.ts --reporter=verbose`
Expected: FAIL — module not found

- [ ] **Step 3: Implement tool-executor-system.ts**

```typescript
// src/game/systems/tool-executor-system.ts
import type { AgentTool } from "../data/world-config.js";

interface ToolRequest {
	agentName: string;
	toolId: string;
	vars: Record<string, string>;
	approved: boolean;
}

export interface ToolResult {
	agentName: string;
	toolId: string;
	success: boolean;
	output: string;
}

export class ToolExecutor {
	private readonly tools = new Map<string, AgentTool>();
	private readonly queue: ToolRequest[] = [];
	private readonly cooldowns = new Map<string, number>();
	private approvalCallback: ((agentName: string, tool: AgentTool, vars: Record<string, string>) => void) | null = null;
	private resultCallback: ((result: ToolResult) => void) | null = null;
	private executor: ((command: string) => Promise<{ success: boolean; output: string }>) | null = null;

	registerTools(tools: readonly AgentTool[]): void {
		for (const tool of tools) {
			this.tools.set(tool.id, tool);
		}
	}

	onApprovalNeeded(cb: (agentName: string, tool: AgentTool, vars: Record<string, string>) => void): void {
		this.approvalCallback = cb;
	}

	onResult(cb: (result: ToolResult) => void): void {
		this.resultCallback = cb;
	}

	setExecutor(fn: (command: string) => Promise<{ success: boolean; output: string }>): void {
		this.executor = fn;
	}

	queueTool(agentName: string, toolId: string, vars: Record<string, string>): void {
		const tool = this.tools.get(toolId);
		if (!tool) return;
		if (this.cooldowns.has(toolId)) return;
		this.queue.push({ agentName, toolId, vars, approved: !tool.requiresApproval });
	}

	grantApproval(agentName: string, toolId: string): void {
		const req = this.queue.find((r) => r.agentName === agentName && r.toolId === toolId);
		if (req) req.approved = true;
	}

	denyApproval(agentName: string, toolId: string): void {
		const idx = this.queue.findIndex((r) => r.agentName === agentName && r.toolId === toolId);
		if (idx >= 0) this.queue.splice(idx, 1);
	}

	update(deltaMs: number): void {
		// Tick cooldowns
		for (const [id, remaining] of this.cooldowns) {
			const next = remaining - deltaMs;
			if (next <= 0) this.cooldowns.delete(id);
			else this.cooldowns.set(id, next);
		}

		// Process queue
		const pending = this.queue.splice(0);
		for (const req of pending) {
			const tool = this.tools.get(req.toolId);
			if (!tool) continue;

			if (!req.approved) {
				this.approvalCallback?.(req.agentName, tool, req.vars);
				this.queue.push(req); // keep in queue waiting for approval
				continue;
			}

			// Execute
			const command = this.substituteVars(tool.command, req.vars);
			this.cooldowns.set(req.toolId, tool.cooldown);

			if (this.executor) {
				this.executor(command).then((result) => {
					this.resultCallback?.({
						agentName: req.agentName,
						toolId: req.toolId,
						success: result.success,
						output: result.output,
					});
				});
			}
		}
	}

	private substituteVars(template: string, vars: Record<string, string>): string {
		return template.replace(/\{(\w+)\}/g, (match, key: string) =>
			key in vars ? vars[key] : match,
		);
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/game/systems/tool-executor-system.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/game/systems/tool-executor-system.ts tests/game/systems/tool-executor-system.test.ts
git commit -m "feat(world): add ToolExecutor with command queue, approval gating, and result callbacks"
```

---

## Chunk 8: Engine Wiring — Connect All 12 Systems

### Task 12: Wire new systems into createAgentWorld()

**Files:**
- Modify: `src/game/engine.ts`

**Reference:** Spec Section 8 — System Wiring & Update Order. Read `src/game/engine.ts` for current wiring pattern.

- [ ] **Step 1: Read engine.ts to understand current wiring**

Read the full `src/game/engine.ts` file. Note:
- How systems are instantiated (constructor calls)
- How systems are registered (per-agent registration in the agent loop)
- How the preframe hook calls `update()` on each system
- How callbacks connect systems (e.g., socialSystem.onConversation)

- [ ] **Step 2: Add new system imports**

Add imports at the top of `engine.ts`:

```typescript
import { NeedsSystem } from "./systems/needs-system.js";
import { DirectorSystem } from "./systems/director-system.js";
import { SensorSystem } from "./systems/sensor-system.js";
import { EngagementSystem } from "./systems/engagement-system.js";
import { RitualSystem } from "./systems/ritual-system.js";
import { ToolExecutor } from "./systems/tool-executor-system.js";
import { DEFAULT_TOOLS } from "./data/tool-registry.js";
```

- [ ] **Step 3: Instantiate new systems**

In `createAgentWorld()`, after existing system instantiation, add:

```typescript
const needsSystem = new NeedsSystem();
const directorSystem = new DirectorSystem();
const sensorSystem = new SensorSystem();
const engagementSystem = new EngagementSystem();
const ritualSystem = new RitualSystem();
const toolExecutor = new ToolExecutor();

toolExecutor.registerTools(DEFAULT_TOOLS);
```

- [ ] **Step 4: Register new systems per agent**

In the agent registration loop (where `brainSystem.register()` is called), add:

```typescript
needsSystem.register(agent.name, agent.attributes ?? {});
sensorSystem.register(agent.name, agent.domain ?? "general");
engagementSystem.register(agent.name, {
	domain: agent.domain ?? "general",
	cha: agent.attributes?.cha ?? 10,
});
ritualSystem.register(agent.name, { domain: agent.domain ?? "general" });
```

- [ ] **Step 5: Wire preframe update order**

In the preframe hook, replace/extend the system update calls with the full 12-system order:

```typescript
// 1. Sensor
sensorSystem.update(deltaMs);

// 2. Needs
needsSystem.update(
	deltaMs,
	(name) => brainSystem.getState(name)?.state ?? "idle",
	(name) => {
		const pos = brainSystem.getPosition(name);
		if (!pos) return [];
		const params = brainSystem.getState(name);
		const radius = params?.params.socialRadius ?? 100;
		return [...brainSystem.getAllEntries()]
			.filter(([n]) => {
				if (n === name) return false;
				const otherPos = brainSystem.getPosition(n);
				if (!otherPos) return false;
				const dx = pos.x - otherPos.x;
				const dy = pos.y - otherPos.y;
				return Math.sqrt(dx * dx + dy * dy) < radius;
			})
			.map(([n]) => n);
	},
);

// 3. Director
directorSystem.update(deltaMs);

// 4. Engagement
engagementSystem.update(
	deltaMs,
	() => directorSystem.getPresence(),
	(name) => needsSystem.getNeeds(name),
	(name) => brainSystem.getState(name)?.state ?? "idle",
	() => false, // hasPendingSensor — wire later
);

// 5. Brain (existing, now reads needs)
brainSystem.update(deltaMs, findAgentActor);

// 6. Ritual
ritualSystem.update(deltaMs, (name) => brainSystem.getState(name)?.state ?? "idle");

// 7. Social (extended with getNeeds)
socialSystem.update(
	deltaMs,
	(name) => brainSystem.getPosition(name) ?? { x: 0, y: 0 },
	(name) => brainSystem.getState(name)?.state ?? "idle",
	(name) => needsSystem.getNeeds(name),
);

// 8. Talk (existing — keep existing call)
talkEngine.update(deltaMs);

// 9. Emote (existing — keep existing call)
emoteSystem.update(deltaMs, (name) => brainSystem.getState(name)?.state ?? "idle");

// 10. Tool executor
toolExecutor.update(deltaMs);

// 11. Bubble (existing — keep existing call)
bubbleSystem.update(
	deltaMs,
	(name) => brainSystem.getState(name)?.state === "idle",
	scene,
	(name) => findAgentActor(name),
);

// 12. Particles (existing — keep existing call)
```

- [ ] **Step 6: Wire mood derivation per-tick**

After `needsSystem.update()`, add mood propagation:

```typescript
for (const name of needsSystem.getAgentNames()) {
	const mood = needsSystem.getMood(name);
	brainSystem.updateMood(name, mood);
	emoteSystem.updateMood(name, mood);
}
```

- [ ] **Step 7: Wire callback connections**

Connect system callbacks:

```typescript
// Sensor → Bubble + Needs
sensorSystem.onReaction((reaction) => {
	if (reaction.bubble) {
		bubbleSystem.showBubble(
			reaction.agentName, reaction.bubble.kind, reaction.bubble.text,
			scene, getActor, 5000, true,
		);
	}
	if (reaction.needsEffect) {
		needsSystem.applyEffect(reaction.agentName, reaction.needsEffect);
	}
});

// Engagement → Bubble + Brain
engagementSystem.onEngagement((e) => {
	if (e.tier >= 2) {
		// Walk agent to camera edge
		const camPos = /* camera center position */;
		brainSystem.walkTo(e.agentName, { x: camPos.x - 50, y: camPos.y });
	}
	bubbleSystem.showBubble(
		e.agentName, e.bubbleKind, e.text,
		scene, getActor, 5000, true,
	);
});

// Ritual → Brain + Bubble + Needs
ritualSystem.onPhase((phase) => {
	if (phase.type === "gather") {
		for (const name of phase.participants) {
			brainSystem.applyEvent(name, "speaking");
		}
	}
	if (phase.type === "line") {
		bubbleSystem.showBubble(
			phase.agentName, "speech", phase.text,
			scene, getActor, 4000, true,
		);
	}
	if (phase.type === "disperse") {
		for (const name of phase.participants) {
			brainSystem.applyEvent(name, "idle");
			needsSystem.applyEffect(name, { social: 8, morale: 5 });
		}
	}
});

// Cluster → Bubble (huddle)
socialSystem.onCluster((agents) => {
	// Huddle choreography handled inline
	// Walk agents to centroid, round-robin template lines
});

// Tool → Sensor feedback + Needs
toolExecutor.onResult((result) => {
	const eventType = result.success ? "test-pass" : "test-fail";
	sensorSystem.pushFeedback({ type: eventType, data: { output: result.output } });
	needsSystem.applyEffect(result.agentName, {
		morale: result.success ? 3 : -2,
		energy: -5,
	});
	bubbleSystem.showBubble(
		result.agentName, "speech",
		result.success ? "Done! All good." : "Something went wrong...",
		scene, getActor, 5000, true,
	);
});
```

- [ ] **Step 8: Wire Director mouse events**

Connect canvas mouse events to DirectorSystem:

```typescript
// In the ExcaliburJS engine setup or canvas event listeners:
engine.input.pointers.primary.on("move", (evt) => {
	const worldPos = engine.currentScene.camera.screenToWorldCoordinates(evt.screenPos);
	directorSystem.onMouseMove(worldPos.x, worldPos.y);
});

canvas.addEventListener("mouseleave", () => {
	directorSystem.onMouseLeave();
});

// On agent click (existing handler), add:
directorSystem.recordInteraction("click", { x: actor.pos.x, y: actor.pos.y });

// On message sent (existing handler), add:
directorSystem.recordInteraction("message", { x: targetActor.pos.x, y: targetActor.pos.y });
```

- [ ] **Step 9: Add cursor spirit renderer**

Add a canvas-drawn actor that renders the Director's cursor glow each frame. Follow the same pattern as `createParticleRenderer()`:

```typescript
// In createAgentWorld(), add a cursor spirit actor to each scene:
const cursorSpirit = new ex.Actor({ anchor: ex.vec(0.5, 0.5) });
cursorSpirit.graphics.use(new ex.Canvas({
	width: 24, height: 24,
	draw: (ctx) => {
		const presence = directorSystem.getPresence();
		if (!presence.worldPos || !presence.visible) return;
		const opacity = presence.idleMs > 30_000 ? 0.15 : 0.3;
		const gradient = ctx.createRadialGradient(12, 12, 0, 12, 12, 12);
		gradient.addColorStop(0, `rgba(100, 180, 255, ${opacity})`);
		gradient.addColorStop(1, `rgba(100, 180, 255, 0)`);
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, 24, 24);
	},
}));
// Update position each frame in preframe:
cursorSpirit.pos = presence.worldPos
	? ex.vec(presence.worldPos.x, presence.worldPos.y)
	: ex.vec(-1000, -1000); // off-screen when not visible
scene.add(cursorSpirit);
```

- [ ] **Step 10: Add unregister calls**

In the agent unregistration path (when agents are removed from the world), add:

```typescript
needsSystem.unregister(name);
sensorSystem.unregister(name);
engagementSystem.unregister(name);
ritualSystem.unregister(name);
```

- [ ] **Step 11: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS (may need adjustments based on exact callback signatures)

- [ ] **Step 12: Manual integration test**

Build and load the plugin in Obsidian:

```bash
npm run build:dev
```

Open the agent world view. Verify:
1. Agents still move, talk, and emote as before (no regression)
2. Cursor spirit glow appears when hovering over the canvas
3. Agents react when cursor hovers near them for 2+ seconds
4. After 30s idle, an agent shows a Tier 1 thought bubble
5. File saves trigger sensor reactions from domain-relevant agents

- [ ] **Step 13: Commit**

```bash
git add src/game/engine.ts
git commit -m "feat(world): wire all 12 systems in createAgentWorld() with full callback connections"
```

---

## Chunk 9: Built-in Ritual Templates

### Task 13: Ship standup.md and celebration.md

**Files:**
- Create: `.flowti/rituals/standup.md`
- Create: `.flowti/rituals/celebration.md`

- [ ] **Step 1: Create rituals directory at vault root**

```bash
mkdir -p "../../.flowti/rituals"
```

Note: `.flowti/rituals/` must be at the vault root (`c:\Projects\flowti\.flowti\rituals\`), not the Plugin project root. All paths below are relative to vault root.

- [ ] **Step 2: Write standup.md**

```markdown
---
name: standup
trigger: manual
participants: all
duration: 30s
cooldown: 24h
---

# Gathering
gather: center
settle: 2s

# Lines
- "Here's my status: I'm feeling {mood_adj} about {domain} work."
- "Nothing blocked on my end."
- "Could use some help with {domain} stuff."
- "All good here, {mood_adj} day."
- "Making progress. Slowly but surely."
- "Been heads-down on {domain}. Good progress."
- "Quick flag — something in {domain} needs attention."

# Reactions
emote: random
disperse: true
```

- [ ] **Step 3: Write celebration.md**

```markdown
---
name: celebration
trigger: event
event: iteration-100
participants: all
duration: 10s
cooldown: 1h
---

# Gathering
gather: center
settle: 1s

# Lines
- "We did it!"
- "Great work, everyone!"
- "That's a wrap on this iteration!"

# Reactions
emote: 3
disperse: true
```

- [ ] **Step 4: Commit**

```bash
cd ../.. && git add .flowti/rituals/standup.md .flowti/rituals/celebration.md
git commit -m "feat(world): ship standup and celebration ritual templates"
cd "01 - Projects/Flowti Plugin"
```

---

## Chunk 10: Final Integration and Verification

### Task 14: End-to-end type check and test suite

- [ ] **Step 1: Run full test suite**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/ --reporter=verbose
```

Expected: All game system tests pass.

- [ ] **Step 2: Run full type check**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Run full plugin test suite**

```bash
npm test
```

Expected: All existing tests still pass (no regression).

- [ ] **Step 4: Build plugin**

```bash
npm run build
```

Expected: Clean build with no errors.

- [ ] **Step 5: Commit any fixes**

If any fixes were needed, commit them:

```bash
git add -A
git commit -m "fix(world): resolve integration issues from agent liveness wiring"
```

---

## Summary

| Task | System | New files | Modified files |
|------|--------|-----------|----------------|
| 1 | WorldConfig | 1 source + 1 test | — |
| 2 | Templates | 3 source + 1 test | — |
| 3 | NeedsSystem | 1 source + 1 test | — |
| 4 | DirectorSystem | 1 source + 1 test | — |
| 5 | BubbleSystem priority | 1 test | 1 modified |
| 6 | BrainSystem walkTo | 1 test | 2 modified |
| 7 | SocialSystem clusters | 1 test | 1 modified |
| 8 | SensorSystem | 2 source + 1 test | — |
| 9 | EngagementSystem | 1 source + 1 test | — |
| 10 | RitualSystem | 1 source + 1 test | — |
| 11 | ToolExecutor | 1 source + 1 test | — |
| 12 | Engine wiring | — | 1 modified |
| 13 | Ritual templates | 2 data files | — |
| 14 | Verification | — | — |
| **Total** | | **14 source + 2 data + 11 tests** | **5 modified** |
