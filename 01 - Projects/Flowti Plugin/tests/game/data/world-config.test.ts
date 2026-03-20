import { describe, it, expect } from "vitest";
import { DEFAULT_WORLD_CONFIG, mergeWorldConfig } from "../../../src/game/data/world-config.js";

describe("DEFAULT_WORLD_CONFIG", () => {
	describe("needs.initial", () => {
		it("has energy=80", () => {
			expect(DEFAULT_WORLD_CONFIG.needs.initial.energy).toBe(80);
		});

		it("has social=60", () => {
			expect(DEFAULT_WORLD_CONFIG.needs.initial.social).toBe(60);
		});

		it("has focus=70", () => {
			expect(DEFAULT_WORLD_CONFIG.needs.initial.focus).toBe(70);
		});

		it("has morale=75", () => {
			expect(DEFAULT_WORLD_CONFIG.needs.initial.morale).toBe(75);
		});
	});

	describe("needs.decay", () => {
		it("has energy.working=3", () => {
			expect(DEFAULT_WORLD_CONFIG.needs.decay.energy.working).toBe(3);
		});

		it("has social.alone=2", () => {
			expect(DEFAULT_WORLD_CONFIG.needs.decay.social.alone).toBe(2);
		});

		it("has focus.perInterruption=4", () => {
			expect(DEFAULT_WORLD_CONFIG.needs.decay.focus.perInterruption).toBe(4);
		});

		it("has morale.perError=1", () => {
			expect(DEFAULT_WORLD_CONFIG.needs.decay.morale.perError).toBe(1);
		});
	});

	describe("director.awareness", () => {
		it("has noticeRadius=60", () => {
			expect(DEFAULT_WORLD_CONFIG.director.awareness.noticeRadius).toBe(60);
		});

		it("has greetRadius=40", () => {
			expect(DEFAULT_WORLD_CONFIG.director.awareness.greetRadius).toBe(40);
		});
	});

	describe("sensors", () => {
		it("has globalCooldown=10000", () => {
			expect(DEFAULT_WORLD_CONFIG.sensors.globalCooldown).toBe(10000);
		});

		it("has perAgentCooldown=5000", () => {
			expect(DEFAULT_WORLD_CONFIG.sensors.perAgentCooldown).toBe(5000);
		});
	});

	describe("groups", () => {
		it("has clusterMinAgents=3", () => {
			expect(DEFAULT_WORLD_CONFIG.groups.clusterMinAgents).toBe(3);
		});

		it("has clusterProximityMs=6000", () => {
			expect(DEFAULT_WORLD_CONFIG.groups.clusterProximityMs).toBe(6000);
		});

		it("has ritualsFolder='.flowti/rituals/'", () => {
			expect(DEFAULT_WORLD_CONFIG.groups.ritualsFolder).toBe(".flowti/rituals/");
		});
	});

	describe("engagement.tiers", () => {
		it("ambient has idleThresholdMs=30000", () => {
			expect(DEFAULT_WORLD_CONFIG.engagement.tiers.ambient.idleThresholdMs).toBe(30000);
		});

		it("ambient has durationMs=45000", () => {
			expect(DEFAULT_WORLD_CONFIG.engagement.tiers.ambient.durationMs).toBe(45000);
		});

		it("nudge has idleThresholdMs=90000", () => {
			expect(DEFAULT_WORLD_CONFIG.engagement.tiers.nudge.idleThresholdMs).toBe(90000);
		});

		it("nudge has durationMs=90000", () => {
			expect(DEFAULT_WORLD_CONFIG.engagement.tiers.nudge.durationMs).toBe(90000);
		});

		it("offer has idleThresholdMs=180000", () => {
			expect(DEFAULT_WORLD_CONFIG.engagement.tiers.offer.idleThresholdMs).toBe(180000);
		});

		it("offer has durationMs=180000", () => {
			expect(DEFAULT_WORLD_CONFIG.engagement.tiers.offer.durationMs).toBe(180000);
		});
	});

	describe("engagement.engagementDuration", () => {
		it("is 10000", () => {
			expect(DEFAULT_WORLD_CONFIG.engagement.engagementDuration).toBe(10000);
		});
	});

	describe("tools", () => {
		it("has defaultTimeout=30000", () => {
			expect(DEFAULT_WORLD_CONFIG.tools.defaultTimeout).toBe(30000);
		});
	});
});

describe("mergeWorldConfig()", () => {
	it("returns a full WorldConfig with no overrides", () => {
		const result = mergeWorldConfig({});
		expect(result.needs.initial.energy).toBe(80);
		expect(result.tools.defaultTimeout).toBe(30000);
	});

	it("overrides a top-level flat section", () => {
		const result = mergeWorldConfig({ tools: { defaultTimeout: 60000 } });
		expect(result.tools.defaultTimeout).toBe(60000);
	});

	it("deep-merges needs.initial, keeping unspecified values", () => {
		const result = mergeWorldConfig({ needs: { initial: { energy: 50 } } });
		expect(result.needs.initial.energy).toBe(50);
		expect(result.needs.initial.social).toBe(60);
		expect(result.needs.initial.focus).toBe(70);
		expect(result.needs.initial.morale).toBe(75);
	});

	it("deep-merges needs.decay.energy", () => {
		const result = mergeWorldConfig({ needs: { decay: { energy: { working: 5 } } } });
		expect(result.needs.decay.energy.working).toBe(5);
		expect(result.needs.decay.social.alone).toBe(2);
	});

	it("deep-merges needs.decay.focus", () => {
		const result = mergeWorldConfig({ needs: { decay: { focus: { perInterruption: 10 } } } });
		expect(result.needs.decay.focus.perInterruption).toBe(10);
	});

	it("deep-merges director.awareness", () => {
		const result = mergeWorldConfig({ director: { awareness: { noticeRadius: 100 } } });
		expect(result.director.awareness.noticeRadius).toBe(100);
		expect(result.director.awareness.greetRadius).toBe(40);
	});

	it("overrides sensors flat values", () => {
		const result = mergeWorldConfig({ sensors: { globalCooldown: 20000, perAgentCooldown: 8000 } });
		expect(result.sensors.globalCooldown).toBe(20000);
		expect(result.sensors.perAgentCooldown).toBe(8000);
	});

	it("overrides groups flat values", () => {
		const result = mergeWorldConfig({ groups: { clusterMinAgents: 5 } });
		expect(result.groups.clusterMinAgents).toBe(5);
		expect(result.groups.clusterProximityMs).toBe(6000);
		expect(result.groups.ritualsFolder).toBe(".flowti/rituals/");
	});

	it("deep-merges engagement tiers", () => {
		const result = mergeWorldConfig({
			engagement: { tiers: { ambient: { idleThresholdMs: 15000 } } },
		});
		expect(result.engagement.tiers.ambient.idleThresholdMs).toBe(15000);
		expect(result.engagement.tiers.ambient.durationMs).toBe(45000);
		expect(result.engagement.tiers.nudge.idleThresholdMs).toBe(90000);
	});

	it("overrides engagementDuration", () => {
		const result = mergeWorldConfig({ engagement: { engagementDuration: 5000 } });
		expect(result.engagement.engagementDuration).toBe(5000);
	});

	it("does not mutate DEFAULT_WORLD_CONFIG", () => {
		mergeWorldConfig({ needs: { initial: { energy: 1 } } });
		expect(DEFAULT_WORLD_CONFIG.needs.initial.energy).toBe(80);
	});
});
