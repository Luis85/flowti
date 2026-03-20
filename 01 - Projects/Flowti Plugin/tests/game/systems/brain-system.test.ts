import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrainSystem } from "../../../src/game/systems/brain-system.js";
import type { AgentAttributes } from "../../../src/game/data/types.js";

const BOUNDS = { minX: 0, maxX: 800, minY: 0, maxY: 600 };

function makeAttributes(overrides: Partial<AgentAttributes> = {}): AgentAttributes {
	return { str: 10, int: 10, wis: 10, cha: 10, dex: 10, con: 10, ...overrides };
}

describe("BrainSystem", () => {
	let system: BrainSystem;

	beforeEach(() => {
		system = new BrainSystem({ bounds: BOUNDS });
	});

	describe("register()", () => {
		it("adds an agent entry so getState() returns it", () => {
			system.register("Alice", makeAttributes());
			expect(system.getState("Alice")).toBeDefined();
		});

		it("registers agent with idle initial state", () => {
			system.register("Alice", makeAttributes());
			expect(system.getState("Alice")?.state).toBe("idle");
		});

		it("is idempotent — second call does not overwrite", () => {
			system.register("Alice", makeAttributes());
			// Calling again should not throw and state should still exist
			system.register("Alice", makeAttributes({ int: 20 }));
			expect(system.getState("Alice")).toBeDefined();
		});
	});

	describe("getState()", () => {
		it("returns undefined for an unknown agent", () => {
			expect(system.getState("nobody")).toBeUndefined();
		});

		it("returns state, params, and target for a registered agent", () => {
			system.register("Bob", makeAttributes());
			const result = system.getState("Bob");
			expect(result).toHaveProperty("state");
			expect(result).toHaveProperty("params");
			expect(result).toHaveProperty("target");
		});
	});

	describe("applyEvent()", () => {
		it("transitions state on a known event type", () => {
			system.register("Alice", makeAttributes());
			system.applyEvent("Alice", "thinking");
			expect(system.getState("Alice")?.state).toBe("working");
		});

		it("transitions to idle on task-completed", () => {
			system.register("Alice", makeAttributes());
			system.applyEvent("Alice", "task-completed");
			expect(system.getState("Alice")?.state).toBe("idle");
		});

		it("does nothing for an unknown agent (no throw)", () => {
			expect(() => system.applyEvent("nobody", "thinking")).not.toThrow();
		});
	});

	describe("freeze()", () => {
		it("stops agent by setting state to idle", () => {
			system.register("Alice", makeAttributes());
			system.applyEvent("Alice", "thinking"); // → working
			system.freeze("Alice");
			expect(system.getState("Alice")?.state).toBe("idle");
		});

		it("clears the movement target", () => {
			system.register("Alice", makeAttributes());
			system.applyEvent("Alice", "task-started"); // → walking-to
			system.freeze("Alice");
			expect(system.getState("Alice")?.target.kind).toBe("none");
		});

		it("calls onWorkstationChange vacate when freezing a working agent", () => {
			const onWorkstationChange = vi.fn();
			const sys = new BrainSystem({ bounds: BOUNDS, onWorkstationChange });
			sys.register("Alice", makeAttributes());
			sys.applyEvent("Alice", "thinking"); // → working
			sys.freeze("Alice");
			expect(onWorkstationChange).toHaveBeenCalledWith("Alice", "vacate", expect.anything());
		});

		it("does nothing for an unknown agent (no throw)", () => {
			expect(() => system.freeze("nobody")).not.toThrow();
		});
	});

	describe("unregister()", () => {
		it("removes the agent so getState() returns undefined", () => {
			system.register("Alice", makeAttributes());
			system.unregister("Alice");
			expect(system.getState("Alice")).toBeUndefined();
		});
	});

	describe("getPosition()", () => {
		it("returns initial position for a registered agent", () => {
			system.register("Alice", makeAttributes());
			const pos = system.getPosition("Alice");
			expect(pos).toBeDefined();
			expect(typeof pos?.x).toBe("number");
			expect(typeof pos?.y).toBe("number");
		});

		it("returns undefined for an unknown agent", () => {
			expect(system.getPosition("nobody")).toBeUndefined();
		});
	});

	describe("getAllEntries()", () => {
		it("returns all registered entries", () => {
			system.register("Alice", makeAttributes());
			system.register("Bob", makeAttributes());
			expect(system.getAllEntries().size).toBe(2);
		});
	});

	describe("assignWork()", () => {
		it("sets taskLocked to true", () => {
			system.register("Alice", makeAttributes());
			system.assignWork("Alice");
			const entry = system.getAllEntries().get("Alice");
			expect(entry?.taskLocked).toBe(true);
		});

		it("sets state to walking-to", () => {
			system.register("Alice", makeAttributes());
			system.assignWork("Alice");
			expect(system.getState("Alice")?.state).toBe("walking-to");
		});

		it("sets target kind to workstation", () => {
			system.register("Alice", makeAttributes());
			system.assignWork("Alice");
			expect(system.getState("Alice")?.target.kind).toBe("workstation");
		});

		it("resets stateTimer to 0", () => {
			system.register("Alice", makeAttributes());
			system.assignWork("Alice");
			const entry = system.getAllEntries().get("Alice");
			expect(entry?.stateTimer).toBe(0);
		});

		it("calls onWorkstationChange with claim when workstation resolved", () => {
			const onWorkstationChange = vi.fn();
			const onWorkstationResolve = vi.fn().mockReturnValue({ x: 100, y: 200 });
			const sys = new BrainSystem({ bounds: BOUNDS, onWorkstationChange, onWorkstationResolve });
			sys.register("Alice", makeAttributes());
			sys.assignWork("Alice");
			expect(onWorkstationChange).toHaveBeenCalledWith("Alice", "claim", { x: 100, y: 200 });
		});

		it("does not call onWorkstationChange when no workstation resolved", () => {
			const onWorkstationChange = vi.fn();
			const onWorkstationResolve = vi.fn().mockReturnValue(null);
			const sys = new BrainSystem({ bounds: BOUNDS, onWorkstationChange, onWorkstationResolve });
			sys.register("Alice", makeAttributes());
			sys.assignWork("Alice");
			expect(onWorkstationChange).not.toHaveBeenCalled();
		});

		it("does nothing for an unknown agent (no throw)", () => {
			expect(() => system.assignWork("nobody")).not.toThrow();
		});
	});

	describe("releaseWork()", () => {
		it("sets taskLocked to false", () => {
			system.register("Alice", makeAttributes());
			system.assignWork("Alice");
			system.releaseWork("Alice");
			const entry = system.getAllEntries().get("Alice");
			expect(entry?.taskLocked).toBe(false);
		});

		it("sets state to idle", () => {
			system.register("Alice", makeAttributes());
			system.assignWork("Alice");
			system.releaseWork("Alice");
			expect(system.getState("Alice")?.state).toBe("idle");
		});

		it("clears movement target", () => {
			system.register("Alice", makeAttributes());
			system.assignWork("Alice");
			system.releaseWork("Alice");
			expect(system.getState("Alice")?.target.kind).toBe("none");
		});

		it("calls onWorkstationChange vacate when releasing a working agent", () => {
			const onWorkstationChange = vi.fn();
			const sys = new BrainSystem({ bounds: BOUNDS, onWorkstationChange });
			sys.register("Alice", makeAttributes());
			sys.applyEvent("Alice", "thinking"); // → working
			// Manually set taskLocked via assignWork side-effect isn't needed,
			// we just need working state to test vacate
			sys.releaseWork("Alice");
			expect(onWorkstationChange).toHaveBeenCalledWith("Alice", "vacate", expect.anything());
		});

		it("does not call onWorkstationChange vacate when not in working state", () => {
			const onWorkstationChange = vi.fn();
			const sys = new BrainSystem({ bounds: BOUNDS, onWorkstationChange });
			sys.register("Alice", makeAttributes());
			sys.assignWork("Alice"); // state = walking-to
			onWorkstationChange.mockClear();
			sys.releaseWork("Alice");
			expect(onWorkstationChange).not.toHaveBeenCalled();
		});

		it("resets stateTimer to 0", () => {
			system.register("Alice", makeAttributes());
			system.assignWork("Alice");
			system.releaseWork("Alice");
			const entry = system.getAllEntries().get("Alice");
			expect(entry?.stateTimer).toBe(0);
		});

		it("does nothing for an unknown agent (no throw)", () => {
			expect(() => system.releaseWork("nobody")).not.toThrow();
		});
	});

	describe("walkTo()", () => {
		it("sets state to walking-to with custom target", () => {
			system.register("Alice", makeAttributes());
			system.walkTo("Alice", { x: 300, y: 200 });
			const state = system.getState("Alice");
			expect(state?.state).toBe("walking-to");
			expect(state?.target.kind).toBe("custom");
			expect(state?.target.x).toBe(300);
			expect(state?.target.y).toBe(200);
		});

		it("also sets targetPos so movement engine can read it", () => {
			system.register("Alice", makeAttributes());
			system.walkTo("Alice", { x: 150, y: 75 });
			const entry = system.getAllEntries().get("Alice");
			expect(entry?.targetPos).toEqual({ x: 150, y: 75 });
		});

		it("does nothing for an unknown agent (no throw)", () => {
			expect(() => system.walkTo("nobody", { x: 100, y: 100 })).not.toThrow();
		});
	});

	describe("taskLocked behavior", () => {
		it("register initializes taskLocked to false", () => {
			system.register("Alice", makeAttributes());
			const entry = system.getAllEntries().get("Alice");
			expect(entry?.taskLocked).toBe(false);
		});

		it("assignWork then releaseWork round-trips taskLocked correctly", () => {
			system.register("Alice", makeAttributes());
			expect(system.getAllEntries().get("Alice")?.taskLocked).toBe(false);
			system.assignWork("Alice");
			expect(system.getAllEntries().get("Alice")?.taskLocked).toBe(true);
			system.releaseWork("Alice");
			expect(system.getAllEntries().get("Alice")?.taskLocked).toBe(false);
		});
	});
});
