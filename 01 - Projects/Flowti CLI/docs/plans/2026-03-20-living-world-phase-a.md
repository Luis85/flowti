# Living World Phase A — Foundation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundational systems that all Living World features depend on — compressed day cycle, ambient visuals (lighting + weather), and cross-session agent memory.

**Architecture:** Three new systems (`DayClock`, `WorldAmbience`, `MemorySystem`) wired into the existing engine preframe loop. DayClock drives phase multipliers into NeedsSystem and provides time context to TalkEngine. WorldAmbience renders a lighting overlay and weather particles. MemorySystem persists agent state to `.flowti/var/` and loads it on start. All three are pure TypeScript classes with no ExcaliburJS imports except WorldAmbience (which owns a Canvas actor).

**Tech Stack:** TypeScript, ExcaliburJS (ex.*), vitest

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-20-living-world-design.md`

---

## File Structure

### New Files

| File | Purpose |
|------|---------|
| `src/game/data/day-phase-config.ts` | DayPhase type, DayPhaseConfig, DayCycleConfig, phase definitions with need multipliers |
| `src/game/data/weather-config.ts` | WeatherState type, WeatherConfig, particle preset configs per weather |
| `src/game/systems/day-clock.ts` | DayClock class — phase progression, multiplier lookup, persistence, callbacks |
| `src/game/systems/world-ambience.ts` | WorldAmbience class — lighting overlay canvas, weather state machine, ambient particles |
| `src/game/systems/memory-system.ts` | MemorySystem class — per-agent persistent memory, streaks, milestones, flush-on-dispose |
| `src/game/data/milestone-definitions.ts` | Milestone trigger definitions and reaction template strings |
| `tests/game/data/day-phase-config.test.ts` | Phase config validation tests |
| `tests/game/systems/day-clock.test.ts` | DayClock phase progression, multipliers, persistence, resume tests |
| `tests/game/systems/world-ambience.test.ts` | Lighting computation, weather transitions, particle preset tests |
| `tests/game/systems/memory-system.test.ts` | Memory CRUD, streak logic, milestone triggers, flush tests |

### Modified Files

| File | Changes |
|------|---------|
| `src/game/data/world-config.ts` | Add DayCycleConfig, WeatherConfig to WorldConfig interface + defaults |
| `src/game/systems/needs-system.ts` | Add optional 4th param `phaseMultipliers` to `update()` |
| `src/game/systems/particle-system.ts` | Add `ParticlePreset` enum and `spawnPreset()` method, pool increase 200→400 |
| `src/game/systems/talk/talk-engine.ts` | Accept phase and weather context for template selection |
| `src/game/engine.ts` | Wire DayClock, WorldAmbience, MemorySystem into preframe + lifecycle |
| `src/game/store/dashboard-store.ts` | Expose dayPhase, weather state to UI |
| `tests/game/engine.test.ts` | Add mocks for new systems |
| `tests/game/systems/needs-system.test.ts` | Test phase multiplier application |

---

## Chunk 1: Day Phase Config + DayClock System

### Task 1: Day phase config data types

**Files:**
- Create: `src/game/data/day-phase-config.ts`
- Create: `tests/game/data/day-phase-config.test.ts`

- [ ] **Step 1: Write tests for phase config**

```typescript
import { describe, it, expect } from "vitest";
import { DAY_PHASES, PHASE_MULTIPLIERS, type DayPhase } from "../../../src/game/data/day-phase-config.js";

describe("day-phase-config", () => {
	it("has 7 phases", () => {
		expect(DAY_PHASES).toHaveLength(7);
	});

	it("phase percentages sum to 1.0", () => {
		const total = DAY_PHASES.reduce((sum, p) => sum + p.percent, 0);
		expect(total).toBeCloseTo(1.0, 2);
	});

	it("every phase has need multipliers", () => {
		for (const phase of DAY_PHASES) {
			expect(phase.needMultipliers).toBeDefined();
			expect(phase.needMultipliers.energy).toBeGreaterThan(0);
			expect(phase.needMultipliers.social).toBeGreaterThan(0);
			expect(phase.needMultipliers.focus).toBeGreaterThan(0);
			expect(phase.needMultipliers.morale).toBeGreaterThan(0);
		}
	});

	it("PHASE_MULTIPLIERS returns multipliers for a phase", () => {
		const m = PHASE_MULTIPLIERS("lunch");
		expect(m.energy).toBe(1.5);
		expect(m.social).toBe(2.0);
	});

	it("PHASE_MULTIPLIERS returns 1.0 defaults for unknown phase", () => {
		const m = PHASE_MULTIPLIERS("nonexistent" as DayPhase);
		expect(m.energy).toBe(1.0);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/data/day-phase-config.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement day-phase-config.ts**

```typescript
/**
 * day-phase-config.ts — Day cycle phase definitions with need rate multipliers.
 *
 * Each phase has a percentage of the total cycle duration and multipliers
 * that scale NeedsSystem decay/restore rates during that phase.
 */

export type DayPhase =
	| "morning-arrival"
	| "productive-morning"
	| "lunch"
	| "afternoon"
	| "afternoon-slump"
	| "wind-down"
	| "evening-departure";

export interface NeedMultipliers {
	readonly energy: number;
	readonly social: number;
	readonly focus: number;
	readonly morale: number;
}

export interface DayPhaseConfig {
	readonly phase: DayPhase;
	readonly percent: number;
	readonly needMultipliers: NeedMultipliers;
}

export const DAY_PHASES: readonly DayPhaseConfig[] = [
	{ phase: "morning-arrival",    percent: 0.08, needMultipliers: { energy: 1.2, social: 1.5, focus: 0.5, morale: 1.3 } },
	{ phase: "productive-morning", percent: 0.25, needMultipliers: { energy: 0.8, social: 0.7, focus: 1.3, morale: 1.2 } },
	{ phase: "lunch",              percent: 0.10, needMultipliers: { energy: 1.5, social: 2.0, focus: 0.3, morale: 1.5 } },
	{ phase: "afternoon",          percent: 0.25, needMultipliers: { energy: 1.0, social: 1.0, focus: 1.0, morale: 1.0 } },
	{ phase: "afternoon-slump",    percent: 0.12, needMultipliers: { energy: 0.6, social: 1.2, focus: 0.6, morale: 0.7 } },
	{ phase: "wind-down",          percent: 0.12, needMultipliers: { energy: 1.1, social: 1.3, focus: 0.5, morale: 1.0 } },
	{ phase: "evening-departure",  percent: 0.08, needMultipliers: { energy: 1.0, social: 1.5, focus: 0.2, morale: 1.2 } },
];

const DEFAULT_MULTIPLIERS: NeedMultipliers = { energy: 1.0, social: 1.0, focus: 1.0, morale: 1.0 };

const MULTIPLIER_MAP = new Map<string, NeedMultipliers>(
	DAY_PHASES.map((p) => [p.phase, p.needMultipliers]),
);

/** Get need multipliers for a given phase. Returns 1.0 defaults for unknown phases. */
export function PHASE_MULTIPLIERS(phase: DayPhase): NeedMultipliers {
	return MULTIPLIER_MAP.get(phase) ?? DEFAULT_MULTIPLIERS;
}
```

- [ ] **Step 4: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/data/day-phase-config.test.ts`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/data/day-phase-config.ts" \
       "01 - Projects/Flowti Plugin/tests/game/data/day-phase-config.test.ts"
git commit -m "feat(world): day phase config — 7 phases with need rate multipliers"
```

### Task 2: DayClock system tests

**Files:**
- Create: `tests/game/systems/day-clock.test.ts`

- [ ] **Step 1: Write DayClock tests**

```typescript
import { describe, it, expect, vi } from "vitest";
import { DayClock } from "../../../src/game/systems/day-clock.js";

describe("DayClock", () => {
	describe("initial state", () => {
		it("starts at morning-arrival phase", () => {
			const clock = new DayClock();
			expect(clock.getPhase()).toBe("morning-arrival");
		});

		it("starts at cycle 0", () => {
			const clock = new DayClock();
			expect(clock.getCycleCount()).toBe(0);
		});
	});

	describe("phase progression", () => {
		it("advances to productive-morning after 8% of cycle", () => {
			const clock = new DayClock(60_000); // 1 min total cycle for fast testing
			clock.update(4_800 + 1); // 8% of 60s = 4.8s
			expect(clock.getPhase()).toBe("productive-morning");
		});

		it("advances through all 7 phases in order", () => {
			const clock = new DayClock(7_000); // 7s total, ~1s per phase conceptually
			const phases: string[] = [clock.getPhase()];
			// Advance in small steps collecting phase changes
			for (let i = 0; i < 70; i++) {
				clock.update(100);
				const p = clock.getPhase();
				if (p !== phases[phases.length - 1]) phases.push(p);
			}
			expect(phases).toEqual([
				"morning-arrival",
				"productive-morning",
				"lunch",
				"afternoon",
				"afternoon-slump",
				"wind-down",
				"evening-departure",
			]);
		});

		it("increments cycle count after full cycle", () => {
			const clock = new DayClock(1_000); // 1s cycle
			clock.update(1_001);
			expect(clock.getCycleCount()).toBe(1);
			expect(clock.getPhase()).toBe("morning-arrival");
		});
	});

	describe("callbacks", () => {
		it("fires onPhaseChange when phase transitions", () => {
			const cb = vi.fn();
			const clock = new DayClock(10_000);
			clock.onPhaseChange(cb);
			clock.update(801); // past 8% of 10s = 800ms
			expect(cb).toHaveBeenCalledWith("productive-morning");
		});

		it("does not fire callback without phase change", () => {
			const cb = vi.fn();
			const clock = new DayClock(100_000);
			clock.onPhaseChange(cb);
			clock.update(100); // still in morning-arrival
			expect(cb).not.toHaveBeenCalled();
		});
	});

	describe("getProgress", () => {
		it("returns 0-1 progress within current phase", () => {
			const clock = new DayClock(100_000); // 100s
			clock.update(4_000); // 4s into morning-arrival (8% = 8s)
			expect(clock.getProgress()).toBeCloseTo(0.5, 1);
		});
	});

	describe("getCycleProgress", () => {
		it("returns 0-1 across full cycle", () => {
			const clock = new DayClock(10_000);
			clock.update(5_000);
			expect(clock.getCycleProgress()).toBeCloseTo(0.5, 1);
		});
	});

	describe("getPhaseMultipliers", () => {
		it("returns need multipliers for current phase", () => {
			const clock = new DayClock();
			const m = clock.getPhaseMultipliers();
			expect(m.energy).toBe(1.2); // morning-arrival
			expect(m.social).toBe(1.5);
		});
	});

	describe("getTimeOfDay", () => {
		it("returns morning for early phases", () => {
			const clock = new DayClock();
			expect(clock.getTimeOfDay()).toBe("morning");
		});

		it("returns evening for departure phase", () => {
			const clock = new DayClock(1_000);
			clock.update(930); // into evening-departure (92-100%)
			expect(clock.getTimeOfDay()).toBe("evening");
		});
	});

	describe("persistence", () => {
		it("serialize returns restorable state", () => {
			const clock = new DayClock(10_000);
			clock.update(3_000);
			const state = clock.serialize();
			expect(state.cycleCount).toBe(0);
			expect(state.elapsedMs).toBeCloseTo(3_000, -1);
		});

		it("restore resumes from saved state", () => {
			const clock = new DayClock(10_000);
			clock.restore({ cycleCount: 5, elapsedMs: 5_000, lastUpdated: Date.now() });
			expect(clock.getCycleCount()).toBe(5);
			expect(clock.getCycleProgress()).toBeCloseTo(0.5, 1);
		});

		it("restore with elapsed > cycle duration starts fresh cycle", () => {
			const clock = new DayClock(10_000);
			clock.restore({ cycleCount: 3, elapsedMs: 0, lastUpdated: Date.now() - 15_000 });
			// elapsed since save > 10s cycle → fresh cycle
			expect(clock.getCycleCount()).toBe(4);
			expect(clock.getPhase()).toBe("morning-arrival");
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/day-clock.test.ts`
Expected: FAIL — module not found

### Task 3: DayClock system implementation

**Files:**
- Create: `src/game/systems/day-clock.ts`

- [ ] **Step 1: Implement DayClock**

```typescript
/**
 * day-clock.ts — Compressed day cycle driving the Living World.
 *
 * Progresses through 7 phases (morning-arrival → evening-departure) over
 * a configurable duration (default 25 min). Provides phase multipliers
 * for NeedsSystem and time-of-day context for TalkEngine.
 */

import { DAY_PHASES, PHASE_MULTIPLIERS, type DayPhase, type NeedMultipliers } from "../data/day-phase-config.js";

// ── Persistence shape ────────────────────────────────────────────────

export interface DayClockState {
	readonly cycleCount: number;
	readonly elapsedMs: number;
	readonly lastUpdated: number;
}

// ── Time-of-day lookup ───────────────────────────────────────────────

const TIME_OF_DAY: Record<DayPhase, string> = {
	"morning-arrival": "morning",
	"productive-morning": "morning",
	"lunch": "midday",
	"afternoon": "afternoon",
	"afternoon-slump": "afternoon",
	"wind-down": "evening",
	"evening-departure": "evening",
};

// ── System ───────────────────────────────────────────────────────────

export class DayClock {
	private readonly durationMs: number;
	private elapsedMs = 0;
	private cycleCount = 0;
	private currentPhaseIndex = 0;
	private readonly callbacks: Array<(phase: DayPhase) => void> = [];

	constructor(durationMs = 1_500_000) {
		this.durationMs = durationMs;
	}

	// ── Public API ─────────────────────────────────────────────

	getPhase(): DayPhase {
		return DAY_PHASES[this.currentPhaseIndex].phase;
	}

	getProgress(): number {
		const start = this.phaseStartMs(this.currentPhaseIndex);
		const end = this.phaseEndMs(this.currentPhaseIndex);
		const duration = end - start;
		if (duration <= 0) return 0;
		return Math.min(1, (this.elapsedMs - start) / duration);
	}

	getCycleProgress(): number {
		return Math.min(1, this.elapsedMs / this.durationMs);
	}

	getTimeOfDay(): string {
		return TIME_OF_DAY[this.getPhase()];
	}

	getCycleCount(): number {
		return this.cycleCount;
	}

	getPhaseMultipliers(): NeedMultipliers {
		return PHASE_MULTIPLIERS(this.getPhase());
	}

	onPhaseChange(cb: (phase: DayPhase) => void): void {
		this.callbacks.push(cb);
	}

	// ── Update ─────────────────────────────────────────────────

	update(deltaMs: number): void {
		this.elapsedMs += deltaMs;

		// Check for cycle completion
		if (this.elapsedMs >= this.durationMs) {
			this.cycleCount++;
			this.elapsedMs = this.elapsedMs % this.durationMs;
			if (this.currentPhaseIndex !== 0) {
				this.currentPhaseIndex = 0;
				this.emit(DAY_PHASES[0].phase);
			}
			return;
		}

		// Check for phase transition
		const newIndex = this.computePhaseIndex();
		if (newIndex !== this.currentPhaseIndex) {
			this.currentPhaseIndex = newIndex;
			this.emit(DAY_PHASES[newIndex].phase);
		}
	}

	// ── Persistence ────────────────────────────────────────────

	serialize(): DayClockState {
		return {
			cycleCount: this.cycleCount,
			elapsedMs: this.elapsedMs,
			lastUpdated: Date.now(),
		};
	}

	restore(state: DayClockState): void {
		const elapsed = Date.now() - state.lastUpdated;
		const totalElapsed = state.elapsedMs + elapsed;

		if (totalElapsed >= this.durationMs) {
			// Elapsed exceeds cycle — start fresh
			this.cycleCount = state.cycleCount + 1;
			this.elapsedMs = 0;
			this.currentPhaseIndex = 0;
		} else {
			// Snap forward to correct position
			this.cycleCount = state.cycleCount;
			this.elapsedMs = totalElapsed;
			this.currentPhaseIndex = this.computePhaseIndex();
		}
	}

	// ── Private ────────────────────────────────────────────────

	private computePhaseIndex(): number {
		const progress = this.elapsedMs / this.durationMs;
		let cumulative = 0;
		for (let i = 0; i < DAY_PHASES.length; i++) {
			cumulative += DAY_PHASES[i].percent;
			if (progress < cumulative) return i;
		}
		return DAY_PHASES.length - 1;
	}

	private phaseStartMs(index: number): number {
		let cumulative = 0;
		for (let i = 0; i < index; i++) {
			cumulative += DAY_PHASES[i].percent;
		}
		return cumulative * this.durationMs;
	}

	private phaseEndMs(index: number): number {
		return this.phaseStartMs(index) + DAY_PHASES[index].percent * this.durationMs;
	}

	private emit(phase: DayPhase): void {
		for (const cb of this.callbacks) cb(phase);
	}
}
```

- [ ] **Step 2: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/day-clock.test.ts`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/day-clock.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/day-clock.test.ts"
git commit -m "feat(world): DayClock system — compressed day cycle with phase multipliers"
```

### Task 4: Extend NeedsSystem with phase multipliers

**Files:**
- Modify: `src/game/systems/needs-system.ts`
- Modify: `tests/game/systems/needs-system.test.ts`

- [ ] **Step 1: Add phase multiplier tests**

Append to existing `tests/game/systems/needs-system.test.ts`:

```typescript
describe("phase multipliers", () => {
	it("applies energy multiplier to decay rate", () => {
		const base = new NeedsSystem();
		base.register("Base");
		const boosted = new NeedsSystem();
		boosted.register("Boosted");

		const getState = () => "working";
		const getNearby = () => [];
		base.update(10_000, getState, getNearby);
		boosted.update(10_000, getState, getNearby, { energy: 0.5, social: 1.0, focus: 1.0, morale: 1.0 });

		// 0.5x energy multiplier → less energy drain
		expect(boosted.getNeeds("Boosted").energy).toBeGreaterThan(base.getNeeds("Base").energy);
	});

	it("defaults to 1.0 multipliers when omitted", () => {
		const a = new NeedsSystem();
		a.register("A");
		const b = new NeedsSystem();
		b.register("B");

		a.update(5_000, () => "idle", () => []);
		b.update(5_000, () => "idle", () => [], undefined);

		expect(a.getNeeds("A").energy).toBeCloseTo(b.getNeeds("B").energy, 2);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/needs-system.test.ts`
Expected: FAIL — 4th param not accepted or multiplier not applied

- [ ] **Step 3: Modify NeedsSystem.update() to accept multipliers**

In `src/game/systems/needs-system.ts`, update the `update` method signature and apply multipliers:

Change the signature from:
```typescript
update(deltaMs: number, getState: (name: string) => string, getNearby: (name: string) => string[]): void
```
To:
```typescript
update(
	deltaMs: number,
	getState: (name: string) => string,
	getNearby: (name: string) => string[],
	phaseMultipliers?: { energy: number; social: number; focus: number; morale: number },
): void
```

Inside the loop, after computing `rates` and `mods`, apply phase multipliers to the final rate before applying to the need value:

```typescript
const pm = phaseMultipliers ?? { energy: 1, social: 1, focus: 1, morale: 1 };
entry.energy = clamp(entry.energy + applyMod(rates.energy, mods.energy) * pm.energy * dt);
entry.social = clamp(entry.social + (applyMod(rates.social, mods.social) + socialBonus) * pm.social * dt);
entry.focus = clamp(entry.focus + applyMod(rates.focus, mods.focus) * pm.focus * dt);
entry.morale = clamp(entry.morale + applyMod(rates.morale, mods.morale) * pm.morale * dt);
```

- [ ] **Step 4: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/needs-system.test.ts`
Expected: All pass (existing + new)

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/needs-system.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/needs-system.test.ts"
git commit -m "feat(needs): accept optional phase multipliers in update()"
```

---

## Chunk 2: Weather Config + WorldAmbience System

### Task 5: Weather config data

**Files:**
- Create: `src/game/data/weather-config.ts`

- [ ] **Step 1: Implement weather config**

```typescript
/**
 * weather-config.ts — Weather states and visual configuration.
 */

export type WeatherState = "clear" | "rain" | "overcast" | "sunny";

export interface WeatherVisuals {
	readonly tintColor: string | null;
	readonly tintOpacity: number;
	readonly particleCount: number;
	readonly particleColor: string;
	readonly particleSpeed: number;
	readonly particleAngle: number;  // radians, 0 = down
}

export const WEATHER_VISUALS: Record<WeatherState, WeatherVisuals> = {
	clear: {
		tintColor: null, tintOpacity: 0,
		particleCount: 0, particleColor: "", particleSpeed: 0, particleAngle: 0,
	},
	rain: {
		tintColor: "rgb(100, 120, 160)", tintOpacity: 0.04,
		particleCount: 25, particleColor: "rgba(150, 170, 220, 0.4)",
		particleSpeed: 120, particleAngle: 0.3,
	},
	overcast: {
		tintColor: "rgb(140, 140, 150)", tintOpacity: 0.06,
		particleCount: 0, particleColor: "", particleSpeed: 0, particleAngle: 0,
	},
	sunny: {
		tintColor: "rgb(255, 230, 150)", tintOpacity: 0.03,
		particleCount: 10, particleColor: "rgba(255, 220, 100, 0.3)",
		particleSpeed: 15, particleAngle: -1.57,  // upward drift
	},
};

export const WEATHER_STATES: readonly WeatherState[] = ["clear", "rain", "overcast", "sunny"];
```

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/data/weather-config.ts"
git commit -m "feat(world): weather config — states and visual parameters"
```

### Task 6: WorldAmbience tests

**Files:**
- Create: `tests/game/systems/world-ambience.test.ts`

- [ ] **Step 1: Write WorldAmbience tests**

```typescript
import { describe, it, expect } from "vitest";
import { WorldAmbience } from "../../../src/game/systems/world-ambience.js";
import type { DayPhase } from "../../../src/game/data/day-phase-config.js";

describe("WorldAmbience", () => {
	describe("lighting", () => {
		it("returns warm tint for morning-arrival", () => {
			const amb = new WorldAmbience();
			const light = amb.getLighting("morning-arrival");
			expect(light.r).toBeGreaterThan(200);
			expect(light.opacity).toBeGreaterThan(0);
		});

		it("returns no tint for productive-morning", () => {
			const amb = new WorldAmbience();
			const light = amb.getLighting("productive-morning");
			expect(light.opacity).toBe(0);
		});

		it("returns cool tint for evening-departure", () => {
			const amb = new WorldAmbience();
			const light = amb.getLighting("evening-departure");
			expect(light.b).toBeGreaterThan(light.r);
			expect(light.opacity).toBeGreaterThan(0.1);
		});
	});

	describe("weather", () => {
		it("starts with clear weather", () => {
			const amb = new WorldAmbience();
			expect(amb.getWeather()).toBe("clear");
		});

		it("cycles weather after configured number of day cycles", () => {
			const amb = new WorldAmbience(2); // change every 2 cycles
			amb.onCycleComplete();
			expect(amb.getWeather()).toBe("clear"); // 1 cycle, no change yet
			amb.onCycleComplete();
			// After 2 cycles, weather should change
			expect(amb.getWeather()).not.toBe("clear");
		});
	});

	describe("persistence", () => {
		it("serialize and restore preserve weather state", () => {
			const amb = new WorldAmbience(1);
			amb.onCycleComplete(); // triggers change
			const weather = amb.getWeather();
			const state = amb.serialize();
			const amb2 = new WorldAmbience(1);
			amb2.restore(state);
			expect(amb2.getWeather()).toBe(weather);
		});
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/world-ambience.test.ts`
Expected: FAIL — module not found

### Task 7: WorldAmbience implementation

**Files:**
- Create: `src/game/systems/world-ambience.ts`

- [ ] **Step 1: Implement WorldAmbience**

```typescript
/**
 * world-ambience.ts — Ambient lighting and weather for the Living World.
 *
 * Provides phase-driven lighting tints and a cycling weather state machine.
 * The engine creates an ExcaliburJS Canvas actor from getLighting() data;
 * this system itself has no ExcaliburJS imports.
 */

import type { DayPhase } from "../data/day-phase-config.js";
import { WEATHER_STATES, WEATHER_VISUALS, type WeatherState, type WeatherVisuals } from "../data/weather-config.js";

// ── Lighting definitions per phase ───────────────────────────────────

export interface LightingState {
	readonly r: number;
	readonly g: number;
	readonly b: number;
	readonly opacity: number;
}

const PHASE_LIGHTING: Record<DayPhase, LightingState> = {
	"morning-arrival":    { r: 255, g: 200, b: 100, opacity: 0.05 },
	"productive-morning": { r: 0,   g: 0,   b: 0,   opacity: 0 },
	"lunch":              { r: 255, g: 210, b: 130, opacity: 0.03 },
	"afternoon":          { r: 0,   g: 0,   b: 0,   opacity: 0 },
	"afternoon-slump":    { r: 200, g: 150, b: 80,  opacity: 0.08 },
	"wind-down":          { r: 100, g: 120, b: 200, opacity: 0.06 },
	"evening-departure":  { r: 80,  g: 80,  b: 160, opacity: 0.12 },
};

// ── Persistence shape ────────────────────────────────────────────────

export interface AmbienceState {
	readonly weather: WeatherState;
	readonly cyclesSinceChange: number;
}

// ── System ───────────────────────────────────────────────────────────

export class WorldAmbience {
	private weather: WeatherState = "clear";
	private cyclesSinceChange = 0;
	private readonly cycleLengthInDayCycles: number;

	constructor(cycleLengthInDayCycles = 2) {
		this.cycleLengthInDayCycles = cycleLengthInDayCycles;
	}

	// ── Public API ─────────────────────────────────────────────

	getLighting(phase: DayPhase): LightingState {
		return PHASE_LIGHTING[phase] ?? PHASE_LIGHTING["afternoon"];
	}

	getWeather(): WeatherState {
		return this.weather;
	}

	getWeatherVisuals(): WeatherVisuals {
		return WEATHER_VISUALS[this.weather];
	}

	/** Called when DayClock completes a full cycle. May trigger weather change. */
	onCycleComplete(): void {
		this.cyclesSinceChange++;
		if (this.cyclesSinceChange >= this.cycleLengthInDayCycles) {
			this.cyclesSinceChange = 0;
			this.weather = this.nextWeather();
		}
	}

	// ── Persistence ────────────────────────────────────────────

	serialize(): AmbienceState {
		return { weather: this.weather, cyclesSinceChange: this.cyclesSinceChange };
	}

	restore(state: AmbienceState): void {
		this.weather = state.weather;
		this.cyclesSinceChange = state.cyclesSinceChange;
	}

	// ── Private ────────────────────────────────────────────────

	private nextWeather(): WeatherState {
		const others = WEATHER_STATES.filter((w) => w !== this.weather);
		return others[Math.floor(Math.random() * others.length)];
	}
}
```

- [ ] **Step 2: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/world-ambience.test.ts`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/world-ambience.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/world-ambience.test.ts"
git commit -m "feat(world): WorldAmbience — phase lighting and weather state machine"
```

---

## Chunk 3: Particle Presets + WorldConfig Extension

### Task 8: Extend ParticlePool with presets

**Files:**
- Modify: `src/game/systems/particle-system.ts`

- [ ] **Step 1: Add ParticlePreset enum and spawnPreset method**

Add after the existing `SpawnOpts` interface:

```typescript
export type ParticlePreset = "steam" | "confetti" | "sparkle" | "alert" | "scribble" | "hearts" | "thunder" | "rain" | "sunny";

const PRESET_CONFIGS: Record<ParticlePreset, { count: number; colorRange: string[]; lifetime: number; speed: number; radius: number; spread: number }> = {
	steam:    { count: 6,  colorRange: ["rgba(200,200,220,0.4)"], lifetime: 2000, speed: 20, radius: 1.5, spread: 0.5 },
	confetti: { count: 30, colorRange: ["#ef4444","#3b82f6","#10b981","#f59e0b","#a855f7","#ec4899"], lifetime: 3000, speed: 60, radius: 2, spread: Math.PI * 2 },
	sparkle:  { count: 8,  colorRange: ["rgba(255,220,100,0.5)"], lifetime: 1500, speed: 25, radius: 1, spread: Math.PI * 2 },
	alert:    { count: 4,  colorRange: ["rgba(239,68,68,0.6)"], lifetime: 500, speed: 80, radius: 3, spread: Math.PI * 2 },
	scribble: { count: 8,  colorRange: ["#3b82f6","#10b981","#f59e0b"], lifetime: 3000, speed: 15, radius: 1.5, spread: 1 },
	hearts:   { count: 3,  colorRange: ["rgba(244,114,182,0.6)"], lifetime: 800, speed: 20, radius: 2, spread: 0.8 },
	thunder:  { count: 5,  colorRange: ["rgba(120,120,140,0.5)"], lifetime: 2000, speed: 10, radius: 2.5, spread: 0.6 },
	rain:     { count: 1,  colorRange: ["rgba(150,170,220,0.4)"], lifetime: 1500, speed: 120, radius: 0.5, spread: 0.3 },
	sunny:    { count: 1,  colorRange: ["rgba(255,220,100,0.3)"], lifetime: 2000, speed: 15, radius: 1, spread: Math.PI * 2 },
};
```

Add `spawnPreset` method to `ParticlePool`:

```typescript
spawnPreset(preset: ParticlePreset, x: number, y: number): void {
	const cfg = PRESET_CONFIGS[preset];
	for (let i = 0; i < cfg.count; i++) {
		const angle = (Math.random() - 0.5) * cfg.spread;
		const speed = cfg.speed * (0.7 + Math.random() * 0.6);
		const color = cfg.colorRange[Math.floor(Math.random() * cfg.colorRange.length)];
		this.spawn({
			x: x + (Math.random() - 0.5) * 10,
			y: y + (Math.random() - 0.5) * 10,
			vx: Math.sin(angle) * speed,
			vy: -Math.cos(angle) * speed,
			color,
			lifetime: cfg.lifetime * (0.8 + Math.random() * 0.4),
			opacity: 0.6 + Math.random() * 0.4,
			radius: cfg.radius,
		});
	}
}
```

Also increase the pool limit from 200 to 400 in the constructor.

- [ ] **Step 2: Run game tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/particle-system.ts"
git commit -m "feat(particles): add ParticlePreset enum and spawnPreset method, increase pool to 400"
```

### Task 9: Extend WorldConfig with new sections

**Files:**
- Modify: `src/game/data/world-config.ts`

- [ ] **Step 1: Add new config interfaces and defaults**

Add new interfaces after existing ones:

```typescript
export interface DayCycleConfig {
	readonly durationMs: number;
}

export interface WeatherWorldConfig {
	readonly cycleLengthInDayCycles: number;
}
```

Add to `WorldConfig` interface:

```typescript
export interface WorldConfig {
	readonly needs: NeedsConfig;
	readonly director: DirectorConfig;
	readonly sensors: SensorsConfig;
	readonly groups: GroupsConfig;
	readonly engagement: EngagementConfig;
	readonly tools: ToolsConfig;
	readonly dayCycle: DayCycleConfig;
	readonly weather: WeatherWorldConfig;
}
```

Add defaults to `DEFAULT_WORLD_CONFIG`:

```typescript
dayCycle: {
	durationMs: 1_500_000,  // 25 minutes
},
weather: {
	cycleLengthInDayCycles: 2,
},
```

Update `mergeWorldConfig` to merge new sections.

- [ ] **Step 2: Run all game tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/data/world-config.ts"
git commit -m "feat(config): add dayCycle and weather sections to WorldConfig"
```

---

## Chunk 4: MemorySystem

### Task 10: Milestone definitions

**Files:**
- Create: `src/game/data/milestone-definitions.ts`

- [ ] **Step 1: Implement milestone definitions**

```typescript
/**
 * milestone-definitions.ts — Milestone triggers and reaction templates.
 */

export interface MilestoneDefinition {
	readonly id: string;
	readonly label: string;
	readonly reaction: string;  // bubble text, supports {name} interpolation
}

export const MILESTONES: readonly MilestoneDefinition[] = [
	{ id: "first-day",           label: "First Day",          reaction: "New here! Taking it all in" },
	{ id: "first-friend",        label: "First Friend",       reaction: "I think {name} and I really click" },
	{ id: "best-friend",         label: "Best Friend",        reaction: "{name} gets me. That's rare" },
	{ id: "first-rivalry",       label: "First Rivalry",      reaction: "{name} and I disagree on everything" },
	{ id: "coffee-regular",      label: "Coffee Regular",     reaction: "The barista knows my order. Wait, there's no barista" },
	{ id: "social-butterfly",    label: "Social Butterfly",   reaction: "I've talked to everyone about everything" },
	{ id: "work-streak-5",       label: "5-Day Streak",       reaction: "Five days strong. I'm in the zone" },
	{ id: "work-streak-10",      label: "10-Day Streak",      reaction: "Double digits. Don't jinx it" },
	{ id: "survivor",            label: "Survivor",           reaction: "I've seen things. Build things" },
	{ id: "early-adopter",       label: "Early Adopter",      reaction: "Been here since the early days" },
	{ id: "veteran",             label: "Veteran",            reaction: "I remember when this office was empty" },
	{ id: "peacemaker",          label: "Peacemaker",         reaction: "We worked it out. Growth is real" },
	{ id: "night-owl-champion",  label: "Night Owl Champion", reaction: "Someone has to close up" },
	{ id: "team-player",         label: "Team Player",        reaction: "Every standup, every retro. I show up" },
	{ id: "green-thumb",         label: "Green Thumb",        reaction: "I'm emotionally attached to this plant now" },
];

export function getMilestone(id: string): MilestoneDefinition | undefined {
	return MILESTONES.find((m) => m.id === id);
}
```

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/data/milestone-definitions.ts"
git commit -m "feat(world): milestone definitions — 15 milestones with reaction templates"
```

### Task 11: MemorySystem tests

**Files:**
- Create: `tests/game/systems/memory-system.test.ts`

- [ ] **Step 1: Write MemorySystem tests**

```typescript
import { describe, it, expect } from "vitest";
import { MemorySystem } from "../../../src/game/systems/memory-system.js";

describe("MemorySystem", () => {
	describe("registration", () => {
		it("initializes with default memory for new agent", () => {
			const sys = new MemorySystem();
			sys.register("Atlas");
			const mem = sys.getMemory("Atlas");
			expect(mem.daysActive).toBe(0);
			expect(mem.workStreak).toBe(0);
			expect(mem.quirks).toEqual([]);
			expect(mem.milestones).toContain("first-day");
		});
	});

	describe("events", () => {
		it("records a recent event", () => {
			const sys = new MemorySystem();
			sys.register("Atlas");
			sys.recordEvent("Atlas", { cycle: 1, type: "conversation", with: "Rex", summary: "Chatted with Rex" });
			expect(sys.getMemory("Atlas").recentEvents).toHaveLength(1);
		});

		it("prunes to max 20 events", () => {
			const sys = new MemorySystem();
			sys.register("Atlas");
			for (let i = 0; i < 25; i++) {
				sys.recordEvent("Atlas", { cycle: 1, type: "test", summary: `Event ${i}` });
			}
			expect(sys.getMemory("Atlas").recentEvents).toHaveLength(20);
		});
	});

	describe("visit tracking", () => {
		it("increments visit count for an object", () => {
			const sys = new MemorySystem();
			sys.register("Atlas");
			sys.recordVisit("Atlas", "coffee-machine");
			sys.recordVisit("Atlas", "coffee-machine");
			expect(sys.getMemory("Atlas").visitCounts["coffee-machine"]).toBe(2);
		});

		it("updates preferred object when visit count is highest", () => {
			const sys = new MemorySystem();
			sys.register("Atlas");
			sys.recordVisit("Atlas", "coffee-machine");
			sys.recordVisit("Atlas", "coffee-machine");
			sys.recordVisit("Atlas", "whiteboard");
			expect(sys.getMemory("Atlas").preferredObject).toBe("coffee-machine");
		});
	});

	describe("streaks", () => {
		it("increments work streak on cycle end with task", () => {
			const sys = new MemorySystem();
			sys.register("Atlas");
			sys.onCycleEnd("Atlas", { completedTask: true, conversations: 2, dominantMood: "neutral" });
			expect(sys.getMemory("Atlas").workStreak).toBe(1);
		});

		it("resets work streak when no task completed", () => {
			const sys = new MemorySystem();
			sys.register("Atlas");
			sys.onCycleEnd("Atlas", { completedTask: true, conversations: 2, dominantMood: "neutral" });
			sys.onCycleEnd("Atlas", { completedTask: false, conversations: 1, dominantMood: "neutral" });
			expect(sys.getMemory("Atlas").workStreak).toBe(0);
		});

		it("tracks longest work streak", () => {
			const sys = new MemorySystem();
			sys.register("Atlas");
			sys.onCycleEnd("Atlas", { completedTask: true, conversations: 0, dominantMood: "neutral" });
			sys.onCycleEnd("Atlas", { completedTask: true, conversations: 0, dominantMood: "neutral" });
			sys.onCycleEnd("Atlas", { completedTask: false, conversations: 0, dominantMood: "neutral" });
			expect(sys.getMemory("Atlas").longestWorkStreak).toBe(2);
		});

		it("increments social streak when 3+ conversations", () => {
			const sys = new MemorySystem();
			sys.register("Atlas");
			sys.onCycleEnd("Atlas", { completedTask: false, conversations: 3, dominantMood: "neutral" });
			expect(sys.getMemory("Atlas").socialStreak).toBe(1);
		});
	});

	describe("milestones", () => {
		it("awards work-streak-5 at 5 consecutive completions", () => {
			const sys = new MemorySystem();
			sys.register("Atlas");
			for (let i = 0; i < 5; i++) {
				sys.onCycleEnd("Atlas", { completedTask: true, conversations: 0, dominantMood: "neutral" });
			}
			expect(sys.getMemory("Atlas").milestones).toContain("work-streak-5");
		});

		it("awards early-adopter at 25 days active", () => {
			const sys = new MemorySystem();
			sys.register("Atlas");
			for (let i = 0; i < 25; i++) {
				sys.onCycleEnd("Atlas", { completedTask: false, conversations: 0, dominantMood: "neutral" });
			}
			expect(sys.getMemory("Atlas").milestones).toContain("early-adopter");
		});

		it("does not duplicate milestones", () => {
			const sys = new MemorySystem();
			sys.register("Atlas");
			for (let i = 0; i < 30; i++) {
				sys.onCycleEnd("Atlas", { completedTask: false, conversations: 0, dominantMood: "neutral" });
			}
			const count = sys.getMemory("Atlas").milestones.filter((m) => m === "early-adopter").length;
			expect(count).toBe(1);
		});
	});

	describe("mood log", () => {
		it("logs dominant mood per cycle", () => {
			const sys = new MemorySystem();
			sys.register("Atlas");
			sys.onCycleEnd("Atlas", { completedTask: false, conversations: 0, dominantMood: "frustrated" });
			expect(sys.getMemory("Atlas").moodLog[0].dominant).toBe("frustrated");
		});

		it("keeps max 10 mood entries", () => {
			const sys = new MemorySystem();
			sys.register("Atlas");
			for (let i = 0; i < 15; i++) {
				sys.onCycleEnd("Atlas", { completedTask: false, conversations: 0, dominantMood: "neutral" });
			}
			expect(sys.getMemory("Atlas").moodLog).toHaveLength(10);
		});
	});

	describe("persistence", () => {
		it("serialize returns all agent memories", () => {
			const sys = new MemorySystem();
			sys.register("Atlas");
			sys.register("Rex");
			const data = sys.serialize();
			expect(Object.keys(data)).toContain("Atlas");
			expect(Object.keys(data)).toContain("Rex");
		});

		it("restore loads saved memory", () => {
			const sys = new MemorySystem();
			sys.register("Atlas");
			sys.onCycleEnd("Atlas", { completedTask: true, conversations: 5, dominantMood: "excited" });
			const data = sys.serialize();

			const sys2 = new MemorySystem();
			sys2.restore(data);
			expect(sys2.getMemory("Atlas").workStreak).toBe(1);
			expect(sys2.getMemory("Atlas").socialStreak).toBe(1);
		});
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/memory-system.test.ts`
Expected: FAIL — module not found

### Task 12: MemorySystem implementation

**Files:**
- Create: `src/game/systems/memory-system.ts`

- [ ] **Step 1: Implement MemorySystem**

```typescript
/**
 * memory-system.ts — Cross-session agent memory persistence.
 *
 * Tracks per-agent streaks, visit counts, preferred spots/objects,
 * recent events, mood history, and milestone achievements.
 * Serializes to and restores from .flowti/var/ data files.
 */

// ── Types ────────────────────────────────────────────────────────────

export interface MemoryEvent {
	readonly cycle: number;
	readonly type: string;
	readonly with?: string;
	readonly summary: string;
}

export interface CycleEndData {
	readonly completedTask: boolean;
	readonly conversations: number;
	readonly dominantMood: string;
}

export interface AgentMemory {
	preferredSpot: { x: number; y: number; scene: string } | null;
	preferredObject: string | null;
	visitCounts: Record<string, number>;
	workStreak: number;
	socialStreak: number;
	daysActive: number;
	longestWorkStreak: number;
	milestones: string[];
	recentEvents: MemoryEvent[];
	moodLog: Array<{ cycle: number; dominant: string }>;
	opinions: Array<{ topic: string; side: "A" | "B" }>;
	quirks: string[];
}

// ── Defaults ─────────────────────────────────────────────────────────

function createDefaultMemory(): AgentMemory {
	return {
		preferredSpot: null,
		preferredObject: null,
		visitCounts: {},
		workStreak: 0,
		socialStreak: 0,
		daysActive: 0,
		longestWorkStreak: 0,
		milestones: ["first-day"],
		recentEvents: [],
		moodLog: [],
		opinions: [],
		quirks: [],
	};
}

const MAX_RECENT_EVENTS = 20;
const MAX_MOOD_LOG = 10;

// ── System ───────────────────────────────────────────────────────────

export class MemorySystem {
	private readonly agents = new Map<string, AgentMemory>();
	private readonly milestoneCallbacks: Array<(agentName: string, milestoneId: string) => void> = [];

	register(name: string): void {
		if (!this.agents.has(name)) {
			this.agents.set(name, createDefaultMemory());
		}
	}

	getMemory(name: string): AgentMemory {
		return this.agents.get(name) ?? createDefaultMemory();
	}

	onMilestone(cb: (agentName: string, milestoneId: string) => void): void {
		this.milestoneCallbacks.push(cb);
	}

	// ── Events ─────────────────────────────────────────────────

	recordEvent(name: string, event: MemoryEvent): void {
		const mem = this.agents.get(name);
		if (!mem) return;
		mem.recentEvents.push(event);
		if (mem.recentEvents.length > MAX_RECENT_EVENTS) {
			mem.recentEvents.splice(0, mem.recentEvents.length - MAX_RECENT_EVENTS);
		}
	}

	// ── Visit tracking ─────────────────────────────────────────

	recordVisit(name: string, objectId: string): void {
		const mem = this.agents.get(name);
		if (!mem) return;
		mem.visitCounts[objectId] = (mem.visitCounts[objectId] ?? 0) + 1;

		// Update preferred object
		let maxVisits = 0;
		let preferred: string | null = null;
		for (const [id, count] of Object.entries(mem.visitCounts)) {
			if (count > maxVisits) {
				maxVisits = count;
				preferred = id;
			}
		}
		mem.preferredObject = preferred;
	}

	// ── Preferred spot ─────────────────────────────────────────

	recordPosition(name: string, x: number, y: number, scene: string): void {
		const mem = this.agents.get(name);
		if (!mem) return;
		// Simple heuristic: if agent returns to similar position 3+ times, it becomes preferred
		if (mem.preferredSpot && Math.abs(mem.preferredSpot.x - x) < 30 && Math.abs(mem.preferredSpot.y - y) < 30) {
			return; // already near preferred spot
		}
		// For now, just set the latest idle position — refined in later phases
		mem.preferredSpot = { x, y, scene };
	}

	// ── Cycle end ──────────────────────────────────────────────

	onCycleEnd(name: string, data: CycleEndData): void {
		const mem = this.agents.get(name);
		if (!mem) return;

		mem.daysActive++;

		// Work streak
		if (data.completedTask) {
			mem.workStreak++;
			if (mem.workStreak > mem.longestWorkStreak) {
				mem.longestWorkStreak = mem.workStreak;
			}
		} else {
			mem.workStreak = 0;
		}

		// Social streak
		if (data.conversations >= 3) {
			mem.socialStreak++;
		} else {
			mem.socialStreak = 0;
		}

		// Mood log
		mem.moodLog.push({ cycle: mem.daysActive, dominant: data.dominantMood });
		if (mem.moodLog.length > MAX_MOOD_LOG) {
			mem.moodLog.splice(0, mem.moodLog.length - MAX_MOOD_LOG);
		}

		// Milestone checks
		this.checkMilestones(name, mem);
	}

	// ── Persistence ────────────────────────────────────────────

	serialize(): Record<string, AgentMemory> {
		const result: Record<string, AgentMemory> = {};
		for (const [name, mem] of this.agents) {
			result[name] = { ...mem };
		}
		return result;
	}

	restore(data: Record<string, AgentMemory>): void {
		for (const [name, mem] of Object.entries(data)) {
			// Merge with defaults for forward-compatibility
			this.agents.set(name, { ...createDefaultMemory(), ...mem });
		}
	}

	// ── Private ────────────────────────────────────────────────

	private checkMilestones(name: string, mem: AgentMemory): void {
		const award = (id: string) => {
			if (!mem.milestones.includes(id)) {
				mem.milestones.push(id);
				for (const cb of this.milestoneCallbacks) cb(name, id);
			}
		};

		if (mem.workStreak >= 5) award("work-streak-5");
		if (mem.workStreak >= 10) award("work-streak-10");
		if (mem.daysActive >= 25) award("early-adopter");
		if (mem.daysActive >= 100) award("veteran");
		if ((mem.visitCounts["coffee-machine"] ?? 0) >= 20) award("coffee-regular");
	}
}
```

- [ ] **Step 2: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/memory-system.test.ts`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/memory-system.ts" \
       "01 - Projects/Flowti Plugin/src/game/data/milestone-definitions.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/memory-system.test.ts"
git commit -m "feat(world): MemorySystem — streaks, visits, milestones, persistence"
```

---

## Chunk 5: Engine Wiring + Store + TalkEngine Integration

### Task 13: Wire DayClock, WorldAmbience, MemorySystem into engine

**Files:**
- Modify: `src/game/engine.ts`
- Modify: `src/game/store/dashboard-store.ts`
- Modify: `tests/game/engine.test.ts`

- [ ] **Step 1: Add imports in engine.ts**

After existing system imports, add:

```typescript
import { DayClock } from "./systems/day-clock.js";
import { WorldAmbience } from "./systems/world-ambience.js";
import { MemorySystem } from "./systems/memory-system.js";
import { DEFAULT_WORLD_CONFIG } from "./data/world-config.js";
```

- [ ] **Step 2: Instantiate new systems**

After `const toolExecutor = new ToolExecutor();`, add:

```typescript
const dayClock = new DayClock(DEFAULT_WORLD_CONFIG.dayCycle.durationMs);
const worldAmbience = new WorldAmbience(DEFAULT_WORLD_CONFIG.weather.cycleLengthInDayCycles);
const memorySystem = new MemorySystem();
```

- [ ] **Step 3: Wire DayClock into preframe loop**

In the preframe handler, add after sensor system update (step 1) and before needs system update (step 2):

```typescript
// 1b. Day clock — advance phase
dayClock.update(deltaMs);
```

Update the needs system call to pass phase multipliers:

```typescript
needsSystem.update(
	deltaMs,
	(name) => brainSystem.getState(name)?.state ?? "idle",
	getNearbyAgents,
	dayClock.getPhaseMultipliers(),
);
```

- [ ] **Step 4: Wire DayClock cycle-end to memory + ambience**

After system instantiation, add:

```typescript
dayClock.onPhaseChange((phase) => {
	store.setDayPhase(phase);
});

// Track conversations per cycle for memory streaks
const cycleConversationCounts = new Map<string, number>();
```

Wire cycle completion (detect when DayClock wraps):

```typescript
let prevCycleCount = dayClock.getCycleCount();
// In preframe, after dayClock.update:
if (dayClock.getCycleCount() > prevCycleCount) {
	prevCycleCount = dayClock.getCycleCount();
	worldAmbience.onCycleComplete();
	// End-of-cycle memory flush for all agents
	for (const agentName of needsSystem.getAgentNames()) {
		memorySystem.onCycleEnd(agentName, {
			completedTask: store.taskLockedAgents.has(agentName) || false,
			conversations: cycleConversationCounts.get(agentName) ?? 0,
			dominantMood: needsSystem.getMood(agentName),
		});
		cycleConversationCounts.set(agentName, 0);
	}
}
```

- [ ] **Step 5: Register agents with MemorySystem in registerAgents()**

In the `registerAgents` function, add:

```typescript
memorySystem.register(agent.name);
```

- [ ] **Step 6: Wire conversation counting for memory streaks**

Inside the existing `socialSystem.onConversation` callback, add:

```typescript
cycleConversationCounts.set(nameA, (cycleConversationCounts.get(nameA) ?? 0) + 1);
cycleConversationCounts.set(nameB, (cycleConversationCounts.get(nameB) ?? 0) + 1);
```

- [ ] **Step 7: Add flush-on-dispose**

In the `dispose()` method, before `engine.dispose()`, add:

```typescript
// Flush persistent state
if (deps.vaultBasePath) {
	try {
		const varDir = join(deps.vaultBasePath, ".flowti", "var");
		if (!existsSync(varDir)) mkdirSync(varDir, { recursive: true });
		writeFileSync(join(varDir, "world-clock.json"), JSON.stringify(dayClock.serialize(), null, "\t"), "utf-8");
		writeFileSync(join(varDir, "world-weather.json"), JSON.stringify(worldAmbience.serialize(), null, "\t"), "utf-8");
		writeFileSync(join(varDir, "world-memory.json"), JSON.stringify(memorySystem.serialize(), null, "\t"), "utf-8");
	} catch { /* non-critical */ }
}
```

- [ ] **Step 8: Add DayPhase to DashboardStore**

In `dashboard-store.ts`, add a public field:

```typescript
dayPhase: string = "morning-arrival";
weatherState: string = "clear";
```

Add setter methods:

```typescript
setDayPhase(phase: string): void {
	this.dayPhase = phase;
	this.notify();
}

setWeatherState(weather: string): void {
	this.weatherState = weather;
	this.notify();
}
```

- [ ] **Step 9: Update engine test mocks**

In `tests/game/engine.test.ts`, add mocks for the new systems:

```typescript
vi.mock("../../src/game/systems/day-clock.js", () => {
	function MockDayClock() {
		const self = this as Record<string, unknown>;
		self.update = vi.fn();
		self.getPhase = vi.fn(() => "morning-arrival");
		self.getPhaseMultipliers = vi.fn(() => ({ energy: 1, social: 1, focus: 1, morale: 1 }));
		self.getCycleCount = vi.fn(() => 0);
		self.getCycleProgress = vi.fn(() => 0);
		self.getTimeOfDay = vi.fn(() => "morning");
		self.onPhaseChange = vi.fn();
		self.serialize = vi.fn(() => ({}));
	}
	return { DayClock: MockDayClock };
});

vi.mock("../../src/game/systems/world-ambience.js", () => {
	function MockWorldAmbience() {
		const self = this as Record<string, unknown>;
		self.getLighting = vi.fn(() => ({ r: 0, g: 0, b: 0, opacity: 0 }));
		self.getWeather = vi.fn(() => "clear");
		self.getWeatherVisuals = vi.fn(() => ({ particleCount: 0 }));
		self.onCycleComplete = vi.fn();
		self.serialize = vi.fn(() => ({}));
	}
	return { WorldAmbience: MockWorldAmbience };
});

vi.mock("../../src/game/systems/memory-system.js", () => {
	function MockMemorySystem() {
		const self = this as Record<string, unknown>;
		self.register = vi.fn();
		self.getMemory = vi.fn(() => ({ milestones: [], recentEvents: [], moodLog: [] }));
		self.recordEvent = vi.fn();
		self.recordVisit = vi.fn();
		self.onCycleEnd = vi.fn();
		self.onMilestone = vi.fn();
		self.serialize = vi.fn(() => ({}));
	}
	return { MemorySystem: MockMemorySystem };
});

vi.mock("../../src/game/data/world-config.js", () => ({
	DEFAULT_WORLD_CONFIG: {
		engagement: { tiers: { ambient: { idleThresholdMs: 30000, durationMs: 45000 }, nudge: { idleThresholdMs: 90000, durationMs: 90000 }, offer: { idleThresholdMs: 180000, durationMs: 180000 } }, engagementDuration: 10000 },
		dayCycle: { durationMs: 1500000 },
		weather: { cycleLengthInDayCycles: 2 },
	},
}));
```

- [ ] **Step 10: Run all game tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/`
Expected: All pass

- [ ] **Step 11: Run tsc + lint**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep "^src/"`
Expected: No errors

- [ ] **Step 12: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine.ts" \
       "01 - Projects/Flowti Plugin/src/game/store/dashboard-store.ts" \
       "01 - Projects/Flowti Plugin/tests/game/engine.test.ts"
git commit -m "feat(engine): wire DayClock, WorldAmbience, MemorySystem into game loop"
```

---

## Chunk 6: Final Verification

### Task 14: Full verification

- [ ] **Step 1: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep "^src/"`
Expected: No errors

- [ ] **Step 2: Lint**

Run: `cd "01 - Projects/Flowti Plugin" && npx eslint src/game/systems/day-clock.ts src/game/systems/world-ambience.ts src/game/systems/memory-system.ts src/game/data/day-phase-config.ts src/game/data/weather-config.ts src/game/data/milestone-definitions.ts 2>&1`
Expected: No errors (warnings acceptable for pre-existing issues)

- [ ] **Step 3: All game tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/`
Expected: All tests pass (existing 331 + ~40 new)

- [ ] **Step 4: Full test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`
Expected: All tests pass (8600+)

- [ ] **Step 5: Build**

Run: `cd "01 - Projects/Flowti Plugin" && npm run build`
Expected: Build passes
