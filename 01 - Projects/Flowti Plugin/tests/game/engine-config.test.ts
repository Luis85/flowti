import { describe, it, expect } from "vitest";
import {
	ENGINE_WIDTH, ENGINE_HEIGHT, DOMAIN_PARTICLE_COLORS, DEFAULT_PARTICLE_COLOR,
	LIGHT_LERP_SPEED, OBJECT_POSITIONS, BRAIN_BOUNDS, PARTICLE_POOL_SIZE,
	SOCIAL_EMOJIS, REACTION_EMOJIS, MOOD_TEXTS, FOLLOW_UP_STRINGS,
	ROOM_OFFSETS, UNKNOWN_ROOM_OFFSET, DEFAULT_PET_ROOMS,
	OBJECT_ATTRACTION_RULES, POSITION_FLUSH_INTERVAL,
	AGENT_WAKE_DELAY, SCENE_TRANSITION_DURATION, LOADING_FADE_DURATION,
	ACTION_DEDUP_TTL, TRAIL_DISTANCE_SQ, TRAIL_Y_OFFSET,
	FOLLOW_UP_CHANCE, SOCIAL_EMOJI_CHANCE, EMOJI_REACTION_CHANCE,
	WEATHER_PARTICLE_CHANCE, WEATHER_PARTICLE_LIFETIME, WEATHER_PARTICLE_OPACITY,
	DOG_FOLLOW_CHANCE, CAT_FOLLOW_STRESSED_CHANCE, CAT_STRESS_MORALE_THRESHOLD,
	OBJECT_EFFECT_DELAY, REACTIVE_THRESHOLDS, PET_SPAWN_CONFIGS,
	OBJECT_SCENE_ASSIGNMENTS,
} from "../../src/game/engine-config.js";

describe("engine-config", () => {
	describe("engine dimensions", () => {
		it("ENGINE_WIDTH is 800", () => {
			expect(ENGINE_WIDTH).toBe(800);
		});

		it("ENGINE_HEIGHT is 500", () => {
			expect(ENGINE_HEIGHT).toBe(500);
		});
	});

	describe("domain particle colors", () => {
		it("has 6 domain entries", () => {
			expect(Object.keys(DOMAIN_PARTICLE_COLORS)).toHaveLength(6);
		});

		it("all values are hex color strings", () => {
			for (const color of Object.values(DOMAIN_PARTICLE_COLORS)) {
				expect(color).toMatch(/^#[0-9a-f]{6}$/);
			}
		});

		it("DEFAULT_PARTICLE_COLOR is a hex color string", () => {
			expect(DEFAULT_PARTICLE_COLOR).toMatch(/^#[0-9a-f]{6}$/);
		});
	});

	describe("lighting", () => {
		it("LIGHT_LERP_SPEED is a small positive number", () => {
			expect(LIGHT_LERP_SPEED).toBeGreaterThan(0);
			expect(LIGHT_LERP_SPEED).toBeLessThan(1);
		});
	});

	describe("object positions", () => {
		it("has 12 environmental objects", () => {
			expect(Object.keys(OBJECT_POSITIONS)).toHaveLength(12);
		});

		it("all positions have x and y as numbers", () => {
			for (const pos of Object.values(OBJECT_POSITIONS)) {
				expect(typeof pos.x).toBe("number");
				expect(typeof pos.y).toBe("number");
			}
		});

		it("all positions are within engine bounds", () => {
			for (const pos of Object.values(OBJECT_POSITIONS)) {
				expect(pos.x).toBeGreaterThanOrEqual(0);
				expect(pos.x).toBeLessThanOrEqual(ENGINE_WIDTH);
				expect(pos.y).toBeGreaterThanOrEqual(0);
				expect(pos.y).toBeLessThanOrEqual(ENGINE_HEIGHT);
			}
		});
	});

	describe("object scene assignments", () => {
		it("maps every object to a valid scene", () => {
			const validScenes = new Set(["hub", "office", "village", "station"]);
			for (const scene of Object.values(OBJECT_SCENE_ASSIGNMENTS)) {
				expect(validScenes.has(scene)).toBe(true);
			}
		});

		it("has same keys as OBJECT_POSITIONS", () => {
			expect(Object.keys(OBJECT_SCENE_ASSIGNMENTS).sort())
				.toEqual(Object.keys(OBJECT_POSITIONS).sort());
		});
	});

	describe("brain bounds", () => {
		it("forms valid bounds within engine dimensions", () => {
			expect(BRAIN_BOUNDS.minX).toBeLessThan(BRAIN_BOUNDS.maxX);
			expect(BRAIN_BOUNDS.minY).toBeLessThan(BRAIN_BOUNDS.maxY);
			expect(BRAIN_BOUNDS.maxX).toBeLessThanOrEqual(ENGINE_WIDTH);
			expect(BRAIN_BOUNDS.maxY).toBeLessThanOrEqual(ENGINE_HEIGHT);
		});
	});

	describe("emoji arrays", () => {
		it("SOCIAL_EMOJIS has entries", () => {
			expect(SOCIAL_EMOJIS.length).toBeGreaterThan(0);
		});

		it("REACTION_EMOJIS has entries", () => {
			expect(REACTION_EMOJIS.length).toBeGreaterThan(0);
		});

		it("REACTION_EMOJIS is a subset of SOCIAL_EMOJIS (all reaction emojis appear in social)", () => {
			// This is a design validation — not strictly required but ensures consistency
			for (const emoji of REACTION_EMOJIS) {
				expect(SOCIAL_EMOJIS).toContain(emoji);
			}
		});
	});

	describe("mood texts", () => {
		it("has at least 5 mood categories", () => {
			expect(Object.keys(MOOD_TEXTS).length).toBeGreaterThanOrEqual(5);
		});

		it("always includes neutral mood", () => {
			expect(MOOD_TEXTS["neutral"]).toBeDefined();
			expect(MOOD_TEXTS["neutral"]!.length).toBeGreaterThan(0);
		});

		it("all categories have at least 3 entries", () => {
			for (const [mood, texts] of Object.entries(MOOD_TEXTS)) {
				expect(texts.length).toBeGreaterThanOrEqual(3);
			}
		});
	});

	describe("follow-up strings", () => {
		it("has entries", () => {
			expect(FOLLOW_UP_STRINGS.length).toBeGreaterThan(0);
		});

		it("all entries are non-empty strings", () => {
			for (const s of FOLLOW_UP_STRINGS) {
				expect(s.length).toBeGreaterThan(0);
			}
		});
	});

	describe("room offsets", () => {
		it("has 4 rooms", () => {
			expect(Object.keys(ROOM_OFFSETS)).toHaveLength(4);
		});

		it("all offsets are multiples of 10000", () => {
			for (const offset of Object.values(ROOM_OFFSETS)) {
				expect(offset % 10000).toBe(0);
			}
		});

		it("UNKNOWN_ROOM_OFFSET matches station offset (both are 30000)", () => {
			expect(UNKNOWN_ROOM_OFFSET).toBe(ROOM_OFFSETS["station"]);
		});
	});

	describe("pet spawn configs", () => {
		it("has 8 pet spawn entries", () => {
			expect(PET_SPAWN_CONFIGS).toHaveLength(8);
		});

		it("all entries have required fields", () => {
			for (const config of PET_SPAWN_CONFIGS) {
				expect(typeof config.type).toBe("string");
				expect(typeof config.x).toBe("number");
				expect(typeof config.y).toBe("number");
				expect(typeof config.entityId).toBe("string");
				expect(typeof config.room).toBe("string");
			}
		});

		it("DEFAULT_PET_ROOMS matches PET_SPAWN_CONFIGS entity-room mapping", () => {
			for (const config of PET_SPAWN_CONFIGS) {
				expect(DEFAULT_PET_ROOMS[config.entityId]).toBe(config.room);
			}
		});
	});

	describe("object attraction rules", () => {
		it("has at least 4 rules", () => {
			expect(OBJECT_ATTRACTION_RULES.length).toBeGreaterThanOrEqual(4);
		});

		it("all rules have required shape", () => {
			for (const rule of OBJECT_ATTRACTION_RULES) {
				expect(typeof rule.objectKey).toBe("string");
				expect(Array.isArray(rule.phases)).toBe(true);
				expect(typeof rule.needCheck).toBe("function");
				expect(typeof rule.chance).toBe("number");
				expect(rule.chance).toBeGreaterThan(0);
				expect(rule.chance).toBeLessThan(1);
			}
		});
	});

	describe("timing constants", () => {
		it("POSITION_FLUSH_INTERVAL is 5 seconds", () => {
			expect(POSITION_FLUSH_INTERVAL).toBe(5000);
		});

		it("PARTICLE_POOL_SIZE is positive", () => {
			expect(PARTICLE_POOL_SIZE).toBeGreaterThan(0);
		});

		it("all chance values are between 0 and 1", () => {
			expect(FOLLOW_UP_CHANCE).toBeGreaterThan(0);
			expect(FOLLOW_UP_CHANCE).toBeLessThan(1);
			expect(SOCIAL_EMOJI_CHANCE).toBeGreaterThan(0);
			expect(SOCIAL_EMOJI_CHANCE).toBeLessThan(1);
			expect(EMOJI_REACTION_CHANCE).toBeGreaterThan(0);
			expect(EMOJI_REACTION_CHANCE).toBeLessThan(1);
			expect(WEATHER_PARTICLE_CHANCE).toBeGreaterThan(0);
			expect(WEATHER_PARTICLE_CHANCE).toBeLessThan(1);
			expect(DOG_FOLLOW_CHANCE).toBeGreaterThan(0);
			expect(DOG_FOLLOW_CHANCE).toBeLessThan(1);
			expect(CAT_FOLLOW_STRESSED_CHANCE).toBeGreaterThan(0);
			expect(CAT_FOLLOW_STRESSED_CHANCE).toBeLessThan(1);
		});

		it("all millisecond delays are positive integers", () => {
			expect(AGENT_WAKE_DELAY).toBeGreaterThan(0);
			expect(Number.isInteger(AGENT_WAKE_DELAY)).toBe(true);
			expect(SCENE_TRANSITION_DURATION).toBeGreaterThan(0);
			expect(Number.isInteger(SCENE_TRANSITION_DURATION)).toBe(true);
			expect(LOADING_FADE_DURATION).toBeGreaterThan(0);
			expect(Number.isInteger(LOADING_FADE_DURATION)).toBe(true);
			expect(ACTION_DEDUP_TTL).toBeGreaterThan(0);
			expect(Number.isInteger(ACTION_DEDUP_TTL)).toBe(true);

			expect(OBJECT_EFFECT_DELAY).toBeGreaterThan(0);
			expect(Number.isInteger(OBJECT_EFFECT_DELAY)).toBe(true);
			expect(WEATHER_PARTICLE_LIFETIME).toBeGreaterThan(0);
			expect(Number.isInteger(WEATHER_PARTICLE_LIFETIME)).toBe(true);
		});
	});

	describe("reactive thresholds", () => {
		it("has all expected keys", () => {
			expect(REACTIVE_THRESHOLDS.energyCritical).toBeDefined();
			expect(REACTIVE_THRESHOLDS.energyRestored).toBeDefined();
			expect(REACTIVE_THRESHOLDS.focusDeep).toBeDefined();
			expect(REACTIVE_THRESHOLDS.focusLost).toBeDefined();
			expect(REACTIVE_THRESHOLDS.moraleBoost).toBeDefined();
		});

		it("energyCritical < energyRestored (hysteresis gap)", () => {
			expect(REACTIVE_THRESHOLDS.energyCritical).toBeLessThan(REACTIVE_THRESHOLDS.energyRestored);
		});

		it("focusLost < focusDeep", () => {
			expect(REACTIVE_THRESHOLDS.focusLost).toBeLessThan(REACTIVE_THRESHOLDS.focusDeep);
		});
	});

	describe("pixel constants", () => {
		it("TRAIL_DISTANCE_SQ is positive", () => {
			expect(TRAIL_DISTANCE_SQ).toBeGreaterThan(0);
		});

		it("TRAIL_Y_OFFSET is positive", () => {
			expect(TRAIL_Y_OFFSET).toBeGreaterThan(0);
		});

		it("WEATHER_PARTICLE_OPACITY is between 0 and 1", () => {
			expect(WEATHER_PARTICLE_OPACITY).toBeGreaterThan(0);
			expect(WEATHER_PARTICLE_OPACITY).toBeLessThanOrEqual(1);
		});

		it("CAT_STRESS_MORALE_THRESHOLD is a reasonable value", () => {
			expect(CAT_STRESS_MORALE_THRESHOLD).toBeGreaterThan(0);
			expect(CAT_STRESS_MORALE_THRESHOLD).toBeLessThan(100);
		});
	});
});
