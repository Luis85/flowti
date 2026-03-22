import { describe, it, expect, vi, beforeEach } from "vitest";
import { SocialSystem } from "../../../src/game/systems/social-system.js";
import type { SocialAgent } from "../../../src/game/systems/social-system.js";
import type { BrainState } from "../../../src/game/brain/brain-types.js";

function makeSocialAgent(overrides: Partial<SocialAgent> = {}): SocialAgent {
	return {
		socialRadius: 100,
		personality: [],
		domain: "general",
		relationships: [],
		...overrides,
	};
}

function makeNeeds(overrides: Partial<{ energy: number; social: number; focus: number; morale: number; hunger: number; thirst: number }> = {}) {
	return { energy: 80, social: 60, focus: 80, morale: 70, hunger: 80, thirst: 80, ...overrides };
}

describe("SocialSystem", () => {
	let system: SocialSystem;

	beforeEach(() => {
		system = new SocialSystem();
	});

	describe("register() / unregister()", () => {
		it("registers an agent without throwing", () => {
			expect(() => system.register("Alice", makeSocialAgent())).not.toThrow();
		});

		it("unregisters an agent without throwing", () => {
			system.register("Alice", makeSocialAgent());
			expect(() => system.unregister("Alice")).not.toThrow();
		});

		it("unregistering an unknown agent does not throw", () => {
			expect(() => system.unregister("nobody")).not.toThrow();
		});
	});

	describe("onConversation()", () => {
		it("fires callback when two idle agents are proximate for 4s", () => {
			const cb = vi.fn();
			system.onConversation(cb);
			system.register("Alice", makeSocialAgent({ socialRadius: 100 }));
			system.register("Bob", makeSocialAgent({ socialRadius: 100 }));

			const getPosition = (name: string) => name === "Alice" ? { x: 0, y: 0 } : { x: 50, y: 0 };
			const getState = (_name: string): BrainState => "idle";
			const getNeeds = (_name: string) => makeNeeds();

			// Advance past 4000ms threshold
			system.update(4001, getPosition, getState, getNeeds);
			expect(cb).toHaveBeenCalledWith("Alice", "Bob", expect.any(String), expect.any(String));
		});

		it("does not fire callback when agents are out of range", () => {
			const cb = vi.fn();
			system.onConversation(cb);
			system.register("Alice", makeSocialAgent({ socialRadius: 50 }));
			system.register("Bob", makeSocialAgent({ socialRadius: 50 }));

			const getPosition = (name: string) => name === "Alice" ? { x: 0, y: 0 } : { x: 200, y: 0 };
			const getState = (_name: string): BrainState => "idle";
			const getNeeds = (_name: string) => makeNeeds();

			system.update(5000, getPosition, getState, getNeeds);
			expect(cb).not.toHaveBeenCalled();
		});
	});

	describe("onCluster()", () => {
		it("fires callback when 3+ idle agents are within socialRadius for 6s", () => {
			const cb = vi.fn();
			system.onCluster(cb);
			system.register("Alice", makeSocialAgent({ socialRadius: 200 }));
			system.register("Bob", makeSocialAgent({ socialRadius: 200 }));
			system.register("Carol", makeSocialAgent({ socialRadius: 200 }));

			// All agents clustered at origin
			const getPosition = (_name: string) => ({ x: 0, y: 0 });
			const getState = (_name: string): BrainState => "idle";
			const getNeeds = (_name: string) => makeNeeds({ focus: 50 });

			// Advance past 6000ms threshold
			system.update(6001, getPosition, getState, getNeeds);
			expect(cb).toHaveBeenCalledWith(expect.arrayContaining(["Alice", "Bob", "Carol"]));
		});

		it("does not fire cluster callback when fewer than 3 agents are proximate", () => {
			const cb = vi.fn();
			system.onCluster(cb);
			system.register("Alice", makeSocialAgent({ socialRadius: 200 }));
			system.register("Bob", makeSocialAgent({ socialRadius: 200 }));

			const getPosition = (_name: string) => ({ x: 0, y: 0 });
			const getState = (_name: string): BrainState => "idle";
			const getNeeds = (_name: string) => makeNeeds({ focus: 50 });

			system.update(7000, getPosition, getState, getNeeds);
			expect(cb).not.toHaveBeenCalled();
		});

		it("agents with focus < 20 are excluded from cluster (2 remaining = no cluster)", () => {
			const cb = vi.fn();
			system.onCluster(cb);
			system.register("Alice", makeSocialAgent({ socialRadius: 200 }));
			system.register("Bob", makeSocialAgent({ socialRadius: 200 }));
			system.register("Carol", makeSocialAgent({ socialRadius: 200 }));

			const getPosition = (_name: string) => ({ x: 0, y: 0 });
			const getState = (_name: string): BrainState => "idle";
			// Carol has focus < 20 — excluded, so only 2 agents eligible
			const getNeeds = (name: string) =>
				name === "Carol" ? makeNeeds({ focus: 10 }) : makeNeeds({ focus: 50 });

			system.update(7000, getPosition, getState, getNeeds);
			expect(cb).not.toHaveBeenCalled();
		});

		it("cluster is not re-fired within 180s cooldown for the same group", () => {
			const cb = vi.fn();
			system.onCluster(cb);
			system.register("Alice", makeSocialAgent({ socialRadius: 200 }));
			system.register("Bob", makeSocialAgent({ socialRadius: 200 }));
			system.register("Carol", makeSocialAgent({ socialRadius: 200 }));

			const getPosition = (_name: string) => ({ x: 0, y: 0 });
			const getState = (_name: string): BrainState => "idle";
			const getNeeds = (_name: string) => makeNeeds({ focus: 50 });

			// First trigger
			system.update(6001, getPosition, getState, getNeeds);
			expect(cb).toHaveBeenCalledTimes(1);

			// Attempt re-trigger immediately — cooldown should prevent it
			system.update(6001, getPosition, getState, getNeeds);
			expect(cb).toHaveBeenCalledTimes(1);
		});
	});

	describe("getNearbyEntities()", () => {
		it("returns empty array before any update", () => {
			expect(system.getNearbyEntities("Alice")).toEqual([]);
		});

		it("returns nearby agents within social radius after update", () => {
			system.register("Alice", makeSocialAgent({ socialRadius: 100 }));
			system.register("Bob", makeSocialAgent({ socialRadius: 100 }));

			const getPosition = (name: string) => name === "Alice" ? { x: 0, y: 0 } : { x: 50, y: 0 };
			const getState = (_name: string): BrainState => "idle";
			const getNeeds = (_name: string) => makeNeeds();

			system.update(16, getPosition, getState, getNeeds);

			const nearbyAlice = system.getNearbyEntities("Alice");
			expect(nearbyAlice.length).toBe(1);
			expect(nearbyAlice[0].id).toBe("Bob");
			expect(nearbyAlice[0].entityType).toBe("agent");
			expect(nearbyAlice[0].distance).toBe(50);

			const nearbyBob = system.getNearbyEntities("Bob");
			expect(nearbyBob.length).toBe(1);
			expect(nearbyBob[0].id).toBe("Alice");
		});

		it("returns empty array for agents out of range", () => {
			system.register("Alice", makeSocialAgent({ socialRadius: 50 }));
			system.register("Bob", makeSocialAgent({ socialRadius: 50 }));

			const getPosition = (name: string) => name === "Alice" ? { x: 0, y: 0 } : { x: 200, y: 0 };
			const getState = (_name: string): BrainState => "idle";
			const getNeeds = (_name: string) => makeNeeds();

			system.update(16, getPosition, getState, getNeeds);
			expect(system.getNearbyEntities("Alice")).toEqual([]);
		});

		it("returns empty for unknown entity", () => {
			expect(system.getNearbyEntities("unknown")).toEqual([]);
		});

		it("refreshes cache on each update", () => {
			system.register("Alice", makeSocialAgent({ socialRadius: 100 }));
			system.register("Bob", makeSocialAgent({ socialRadius: 100 }));

			const getState = (_name: string): BrainState => "idle";
			const getNeeds = (_name: string) => makeNeeds();

			// First update — close together
			system.update(16, (name: string) => name === "Alice" ? { x: 0, y: 0 } : { x: 50, y: 0 }, getState, getNeeds);
			expect(system.getNearbyEntities("Alice").length).toBe(1);

			// Second update — far apart
			system.update(16, (name: string) => name === "Alice" ? { x: 0, y: 0 } : { x: 500, y: 0 }, getState, getNeeds);
			expect(system.getNearbyEntities("Alice").length).toBe(0);
		});
	});

	describe("getCluster()", () => {
		it("returns empty array when not in a cluster", () => {
			system.register("Alice", makeSocialAgent({ socialRadius: 200 }));
			system.register("Bob", makeSocialAgent({ socialRadius: 200 }));

			const getPosition = (_name: string) => ({ x: 0, y: 0 });
			const getState = (_name: string): BrainState => "idle";
			const getNeeds = (_name: string) => makeNeeds({ focus: 50 });

			system.update(16, getPosition, getState, getNeeds);

			// Only 2 agents — not enough for a cluster (min 3)
			expect(system.getCluster("Alice")).toEqual([]);
		});

		it("returns cluster members when 3+ agents are proximate", () => {
			system.register("Alice", makeSocialAgent({ socialRadius: 200 }));
			system.register("Bob", makeSocialAgent({ socialRadius: 200 }));
			system.register("Carol", makeSocialAgent({ socialRadius: 200 }));

			const getPosition = (_name: string) => ({ x: 0, y: 0 });
			const getState = (_name: string): BrainState => "idle";
			const getNeeds = (_name: string) => makeNeeds({ focus: 50 });

			system.update(16, getPosition, getState, getNeeds);

			const cluster = system.getCluster("Alice");
			expect(cluster).toContain("Alice");
			expect(cluster).toContain("Bob");
			expect(cluster).toContain("Carol");
			expect(cluster.length).toBe(3);
		});

		it("returns empty for unknown entity", () => {
			expect(system.getCluster("unknown")).toEqual([]);
		});

		it("returns empty when entity is not in a qualifying cluster", () => {
			system.register("Alice", makeSocialAgent({ socialRadius: 200 }));
			system.register("Bob", makeSocialAgent({ socialRadius: 200 }));
			system.register("Carol", makeSocialAgent({ socialRadius: 200 }));

			const getPosition = (name: string) => {
				if (name === "Carol") return { x: 500, y: 500 };
				return { x: 0, y: 0 };
			};
			const getState = (_name: string): BrainState => "idle";
			const getNeeds = (_name: string) => makeNeeds({ focus: 50 });

			system.update(16, getPosition, getState, getNeeds);

			// Carol is far away, so no cluster of 3+
			expect(system.getCluster("Alice")).toEqual([]);
			expect(system.getCluster("Carol")).toEqual([]);
		});

		it("works without onCluster callback being set", () => {
			// Ensure getCluster works independently of the callback system
			system.register("Alice", makeSocialAgent({ socialRadius: 200 }));
			system.register("Bob", makeSocialAgent({ socialRadius: 200 }));
			system.register("Carol", makeSocialAgent({ socialRadius: 200 }));

			const getPosition = (_name: string) => ({ x: 0, y: 0 });
			const getState = (_name: string): BrainState => "idle";
			const getNeeds = (_name: string) => makeNeeds({ focus: 50 });

			// No onCluster callback registered
			system.update(16, getPosition, getState, getNeeds);

			const cluster = system.getCluster("Bob");
			expect(cluster.length).toBe(3);
		});
	});
});
