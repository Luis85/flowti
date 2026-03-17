import { describe, it, expect } from "vitest";
import { SocialSystem } from "../../src/systems/social-system.js";

describe("SocialSystem", () => {
	it("triggers conversation when related agents are within range for threshold", () => {
		const system = new SocialSystem();
		const convos: Array<{ a: string; b: string }> = [];
		system.onConversation((a, b) => convos.push({ a, b }));

		system.register("Alice", { socialRadius: 100, personality: ["analytical"], relationships: [{ target: "Bob", type: "peer" }] });
		system.register("Bob", { socialRadius: 100, personality: ["friendly"], relationships: [{ target: "Alice", type: "peer" }] });

		// Place within range for > 4s
		system.update(5000, (name) => ({ x: name === "Alice" ? 50 : 100, y: 100 }), () => "idle");

		expect(convos.length).toBe(1);
		expect(convos[0].a).toBe("Alice");
		expect(convos[0].b).toBe("Bob");
	});

	it("does not trigger if agents are too far apart", () => {
		const system = new SocialSystem();
		const convos: string[] = [];
		system.onConversation((a) => convos.push(a));

		system.register("Alice", { socialRadius: 50, personality: [], relationships: [{ target: "Bob", type: "peer" }] });
		system.register("Bob", { socialRadius: 50, personality: [], relationships: [{ target: "Alice", type: "peer" }] });

		system.update(5000, (name) => ({ x: name === "Alice" ? 0 : 200, y: 100 }), () => "idle");

		expect(convos.length).toBe(0);
	});

	it("respects pair cooldown", () => {
		const system = new SocialSystem();
		let count = 0;
		system.onConversation(() => count++);

		system.register("Alice", { socialRadius: 100, personality: [], relationships: [{ target: "Bob", type: "peer" }] });
		system.register("Bob", { socialRadius: 100, personality: [], relationships: [{ target: "Alice", type: "peer" }] });

		system.update(5000, () => ({ x: 50, y: 50 }), () => "idle");
		expect(count).toBe(1);

		// Before cooldown expires (60s)
		system.update(30000, () => ({ x: 50, y: 50 }), () => "idle");
		expect(count).toBe(1);
	});

	it("allows conversation after cooldown expires", () => {
		const system = new SocialSystem();
		let count = 0;
		system.onConversation(() => count++);

		system.register("Alice", { socialRadius: 100, personality: [], relationships: [{ target: "Bob", type: "peer" }] });
		system.register("Bob", { socialRadius: 100, personality: [], relationships: [{ target: "Alice", type: "peer" }] });

		system.update(5000, () => ({ x: 50, y: 50 }), () => "idle");
		expect(count).toBe(1);

		// After cooldown expires (60s total)
		system.update(61000, () => ({ x: 50, y: 50 }), () => "idle");
		expect(count).toBe(2);
	});

	it("does not trigger during non-idle states", () => {
		const system = new SocialSystem();
		let count = 0;
		system.onConversation(() => count++);

		system.register("Alice", { socialRadius: 100, personality: [], relationships: [{ target: "Bob", type: "peer" }] });
		system.register("Bob", { socialRadius: 100, personality: [], relationships: [{ target: "Alice", type: "peer" }] });

		system.update(5000, () => ({ x: 50, y: 50 }), () => "working");
		expect(count).toBe(0);
	});

	it("does not trigger without relationships", () => {
		const system = new SocialSystem();
		let count = 0;
		system.onConversation(() => count++);

		system.register("Alice", { socialRadius: 100, personality: [], relationships: [] });
		system.register("Bob", { socialRadius: 100, personality: [], relationships: [] });

		system.update(5000, () => ({ x: 50, y: 50 }), () => "idle");
		expect(count).toBe(0);
	});

	it("unregisters agent", () => {
		const system = new SocialSystem();
		let count = 0;
		system.onConversation(() => count++);

		system.register("Alice", { socialRadius: 100, personality: [], relationships: [{ target: "Bob", type: "peer" }] });
		system.register("Bob", { socialRadius: 100, personality: [], relationships: [{ target: "Alice", type: "peer" }] });
		system.unregister("Alice");

		system.update(5000, () => ({ x: 50, y: 50 }), () => "idle");
		expect(count).toBe(0);
	});

	it("provides conversation lines in callback", () => {
		const system = new SocialSystem();
		const lines: Array<{ lineA: string; lineB: string }> = [];
		system.onConversation((_, __, lineA, lineB) => lines.push({ lineA, lineB }));

		system.register("Alice", { socialRadius: 100, personality: ["analytical"], relationships: [{ target: "Bob", type: "peer" }] });
		system.register("Bob", { socialRadius: 100, personality: ["friendly"], relationships: [{ target: "Alice", type: "peer" }] });

		system.update(5000, () => ({ x: 50, y: 50 }), () => "idle");

		expect(lines.length).toBe(1);
		expect(lines[0].lineA.length).toBeGreaterThan(0);
		expect(lines[0].lineB.length).toBeGreaterThan(0);
	});
});
