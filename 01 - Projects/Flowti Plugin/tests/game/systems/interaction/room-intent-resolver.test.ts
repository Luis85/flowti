import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RoomInteractionRule, EnvironmentCondition } from "../../../../../Flowti CLI/src/domain/interactions/intent-resolver-types.js";
import { createRoomIntentResolver } from "../../../../src/game/systems/interaction/room-intent-resolver.js";
import type { RoomResolverConfig } from "../../../../src/game/systems/interaction/room-intent-resolver.js";

// ── Helpers ─────────────────────────────────────────────────────────

function makeRule(overrides: Partial<RoomInteractionRule> = {}): RoomInteractionRule {
	return {
		roomType: "break-room",
		layer: "reactive",
		conditions: [],
		interaction: {
			category: "environmental",
			action: "ambient-chatter",
			cardinality: "one-to-many",
			effects: [{ type: "room-mood-shift", mood: "relaxed", amount: 5 }],
			cooldownMs: 15000,
		},
		cooldownMs: 15000,
		...overrides,
	};
}

function makeConfig(overrides: Partial<RoomResolverConfig> = {}): RoomResolverConfig {
	return {
		roomId: "room-break-01",
		roomType: "break-room",
		rules: [makeRule()],
		getOccupancy: () => 3,
		getOccupantIds: () => ["agent-alpha", "agent-beta", "agent-gamma"],
		getCollectiveMood: () => ({ mood: "relaxed", intensity: 60 }),
		getPhase: () => "productive-morning",
		...overrides,
	};
}

// ── Tests ───────────────────────────────────────────────────────────

describe("createRoomIntentResolver", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("reactive rule fires when occupancy > threshold and correct phase", () => {
		const conditions: readonly EnvironmentCondition[] = [
			{ type: "occupancy", op: ">", value: 2 },
			{ type: "phase", phases: ["productive-morning"] },
		];
		const resolver = createRoomIntentResolver(makeConfig({
			rules: [makeRule({ conditions })],
		}));

		const result = resolver.resolve();
		expect(result).toHaveLength(1);
		expect(result[0].action).toBe("ambient-chatter");
		expect(result[0].initiator).toEqual({ id: "room-break-01", entityType: "room" });
		expect(result[0].targets).toHaveLength(3);
	});

	it("active rule fires on phase match", () => {
		const activeRule = makeRule({
			layer: "active",
			conditions: [{ type: "phase", phases: ["lunch"] }],
			interaction: {
				category: "environmental",
				action: "lunch-bell",
				cardinality: "one-to-many",
				effects: [],
				cooldownMs: 60000,
			},
		});
		const resolver = createRoomIntentResolver(makeConfig({
			rules: [activeRule],
			getPhase: () => "lunch",
		}));

		const result = resolver.resolve();
		expect(result).toHaveLength(1);
		expect(result[0].action).toBe("lunch-bell");
	});

	it("passive layer rules are skipped", () => {
		const passiveRule = makeRule({
			layer: "passive",
			interaction: {
				category: "environmental",
				action: "stat-boost",
				cardinality: "one-to-many",
				effects: [{ type: "need-change", target: "all", need: "focus", amount: 5 }],
				cooldownMs: 0,
			},
		});
		const resolver = createRoomIntentResolver(makeConfig({
			rules: [passiveRule],
		}));

		const result = resolver.resolve();
		expect(result).toEqual([]);
	});

	it("rule with failed occupancy condition is skipped", () => {
		const conditions: readonly EnvironmentCondition[] = [
			{ type: "occupancy", op: ">", value: 10 },
		];
		const resolver = createRoomIntentResolver(makeConfig({
			rules: [makeRule({ conditions })],
			getOccupancy: () => 3,
		}));

		const result = resolver.resolve();
		expect(result).toEqual([]);
	});

	it("rule with failed collective-mood condition is skipped", () => {
		const conditions: readonly EnvironmentCondition[] = [
			{ type: "collective-mood", mood: "stressed", threshold: 80 },
		];
		const resolver = createRoomIntentResolver(makeConfig({
			rules: [makeRule({ conditions })],
			getCollectiveMood: () => ({ mood: "stressed", intensity: 40 }),
		}));

		const result = resolver.resolve();
		expect(result).toEqual([]);
	});

	it("collective-mood condition passes when intensity meets threshold", () => {
		const conditions: readonly EnvironmentCondition[] = [
			{ type: "collective-mood", mood: "stressed", threshold: 30 },
		];
		const resolver = createRoomIntentResolver(makeConfig({
			rules: [makeRule({ conditions })],
			getCollectiveMood: () => ({ mood: "stressed", intensity: 50 }),
		}));

		const result = resolver.resolve();
		expect(result).toHaveLength(1);
	});

	it("rule with failed phase condition is skipped", () => {
		const conditions: readonly EnvironmentCondition[] = [
			{ type: "phase", phases: ["evening-departure"] },
		];
		const resolver = createRoomIntentResolver(makeConfig({
			rules: [makeRule({ conditions })],
			getPhase: () => "productive-morning",
		}));

		const result = resolver.resolve();
		expect(result).toEqual([]);
	});

	it("all conditions must pass for rule to match", () => {
		const conditions: readonly EnvironmentCondition[] = [
			{ type: "occupancy", op: ">", value: 1 },
			{ type: "phase", phases: ["evening-departure"] },
		];
		const resolver = createRoomIntentResolver(makeConfig({
			rules: [makeRule({ conditions })],
			getOccupancy: () => 5,
			getPhase: () => "productive-morning",
		}));

		const result = resolver.resolve();
		expect(result).toEqual([]);
	});

	it("sets targets from all occupant ids", () => {
		const resolver = createRoomIntentResolver(makeConfig());

		const result = resolver.resolve();
		expect(result).toHaveLength(1);
		const targetIds = result[0].targets.map((t) => t.id);
		expect(targetIds).toEqual(["agent-alpha", "agent-beta", "agent-gamma"]);
	});

	it("occupancy < operator works correctly", () => {
		const conditions: readonly EnvironmentCondition[] = [
			{ type: "occupancy", op: "<", value: 5 },
		];
		const resolver = createRoomIntentResolver(makeConfig({
			rules: [makeRule({ conditions })],
			getOccupancy: () => 3,
		}));

		const result = resolver.resolve();
		expect(result).toHaveLength(1);
	});

	it("occupancy == operator works correctly", () => {
		const conditions: readonly EnvironmentCondition[] = [
			{ type: "occupancy", op: "==", value: 3 },
		];
		const resolver = createRoomIntentResolver(makeConfig({
			rules: [makeRule({ conditions })],
			getOccupancy: () => 3,
		}));

		const result = resolver.resolve();
		expect(result).toHaveLength(1);
	});

	it("event-recent and weather conditions pass through", () => {
		const conditions: readonly EnvironmentCondition[] = [
			{ type: "event-recent", eventType: "trade-complete", withinMs: 60000 },
			{ type: "weather", weather: "sunny" },
		];
		const resolver = createRoomIntentResolver(makeConfig({
			rules: [makeRule({ conditions })],
		}));

		const result = resolver.resolve();
		expect(result).toHaveLength(1);
	});

	it("sets entityType to room", () => {
		const resolver = createRoomIntentResolver(makeConfig());
		expect(resolver.entityType).toBe("room");
	});
});
