import { describe, it, expect, vi } from "vitest";
import {
	MerchantSystem,
	type CatalogItem,
	type MerchantDeps,
} from "../../../src/game/systems/merchant-system.js";

function makeCatalog(): CatalogItem[] {
	return [
		{ id: "cap-1", name: "Fast Typing", category: "capability", cost: 50, requiresLevel: 3 },
		{ id: "cap-2", name: "Code Review", category: "capability", cost: 100, requiresLevel: 5 },
		{ id: "cap-3", name: "Auto Debug", category: "capability", cost: 30 },
		{ id: "res-1", name: "Energy Potion", category: "resource", cost: 10 },
		{ id: "cos-1", name: "Golden Hat", category: "cosmetic", cost: 200, requiresLevel: 10, oneTime: true },
		{ id: "room-1", name: "Library", category: "room", cost: 500, requiresLevel: 8, oneTime: true },
	];
}

function makeDeps(overrides: Partial<MerchantDeps> = {}): MerchantDeps {
	return {
		runCli: overrides.runCli ?? vi.fn().mockResolvedValue('{"success":true}'),
		getCatalog: overrides.getCatalog ?? (() => makeCatalog()),
		getBalance: overrides.getBalance ?? (() => ({ coin: 150, level: 5 })),
		getOwnedItems: overrides.getOwnedItems,
	};
}

describe("MerchantSystem", () => {
	describe("getAvailableItems", () => {
		it("filters by agent level (excludes items above level)", () => {
			const deps = makeDeps({ getBalance: () => ({ coin: 999, level: 5 }) });
			const system = new MerchantSystem(deps);

			const items = system.getAvailableItems("Atlas");

			const ids = items.map((i) => i.id);
			expect(ids).toContain("cap-1"); // requiresLevel 3
			expect(ids).toContain("cap-2"); // requiresLevel 5
			expect(ids).not.toContain("cos-1"); // requiresLevel 10
			expect(ids).not.toContain("room-1"); // requiresLevel 8
		});

		it("includes items with no level requirement", () => {
			const deps = makeDeps({ getBalance: () => ({ coin: 999, level: 1 }) });
			const system = new MerchantSystem(deps);

			const items = system.getAvailableItems("Atlas");

			const ids = items.map((i) => i.id);
			expect(ids).toContain("cap-3"); // no requiresLevel
			expect(ids).toContain("res-1"); // no requiresLevel
		});
	});

	describe("canAfford", () => {
		it("true when coin >= cost", () => {
			const deps = makeDeps({ getBalance: () => ({ coin: 100, level: 5 }) });
			const system = new MerchantSystem(deps);

			expect(system.canAfford("Atlas", "cap-1")).toBe(true); // cost 50
		});

		it("false when insufficient coin", () => {
			const deps = makeDeps({ getBalance: () => ({ coin: 5, level: 5 }) });
			const system = new MerchantSystem(deps);

			expect(system.canAfford("Atlas", "cap-1")).toBe(false); // cost 50
		});
	});

	describe("canPurchase", () => {
		it("returns ok:true when all checks pass", () => {
			const deps = makeDeps({ getBalance: () => ({ coin: 200, level: 5 }) });
			const system = new MerchantSystem(deps);

			const result = system.canPurchase("Atlas", "cap-1"); // cost 50, requiresLevel 3
			expect(result).toEqual({ ok: true });
		});

		it("returns reason when level too low", () => {
			const deps = makeDeps({ getBalance: () => ({ coin: 999, level: 2 }) });
			const system = new MerchantSystem(deps);

			const result = system.canPurchase("Atlas", "cap-1"); // requiresLevel 3
			expect(result.ok).toBe(false);
			expect(result.reason).toBeDefined();
			expect(result.reason).toMatch(/level/i);
		});

		it("returns reason when insufficient coin", () => {
			const deps = makeDeps({ getBalance: () => ({ coin: 5, level: 10 }) });
			const system = new MerchantSystem(deps);

			const result = system.canPurchase("Atlas", "cap-1"); // cost 50
			expect(result.ok).toBe(false);
			expect(result.reason).toBeDefined();
			expect(result.reason).toMatch(/coin|afford/i);
		});

		it("returns reason when oneTime item already owned", () => {
			const owned = new Set(["cos-1"]);
			const deps = makeDeps({
				getBalance: () => ({ coin: 999, level: 10 }),
				getOwnedItems: () => owned,
			});
			const system = new MerchantSystem(deps);

			const result = system.canPurchase("Atlas", "cos-1"); // oneTime: true
			expect(result.ok).toBe(false);
			expect(result.reason).toBeDefined();
			expect(result.reason).toMatch(/owned|already/i);
		});
	});

	describe("purchase", () => {
		it("calls CLI shop:buy command with correct args", async () => {
			const runCli = vi.fn().mockResolvedValue('{"success":true}');
			const deps = makeDeps({
				runCli,
				getBalance: () => ({ coin: 200, level: 5 }),
			});
			const system = new MerchantSystem(deps);

			await system.purchase("Atlas", "cap-1");

			expect(runCli).toHaveBeenCalledWith(
				"shop:buy --agent=Atlas --item=cap-1 --format=json",
			);
		});

		it("returns success on CLI success", async () => {
			const runCli = vi.fn().mockResolvedValue('{"success":true}');
			const deps = makeDeps({
				runCli,
				getBalance: () => ({ coin: 200, level: 5 }),
			});
			const system = new MerchantSystem(deps);

			const result = await system.purchase("Atlas", "cap-1");
			expect(result.success).toBe(true);
		});

		it("returns failure without calling runCli when canPurchase fails", async () => {
			const runCli = vi.fn().mockResolvedValue('{"success":true}');
			const deps = makeDeps({
				runCli,
				getBalance: () => ({ coin: 10, level: 5 }), // insufficient coin for cap-1 (cost 50)
			});
			const system = new MerchantSystem(deps);

			const result = await system.purchase("Atlas", "cap-1");

			expect(result.success).toBe(false);
			expect(result.message).toMatch(/coin/i);
			expect(runCli).not.toHaveBeenCalled();
		});

		it("returns failure when runCli rejects", async () => {
			const runCli = vi.fn().mockRejectedValue(new Error("network error"));
			const deps = makeDeps({
				runCli,
				getBalance: () => ({ coin: 200, level: 5 }),
			});
			const system = new MerchantSystem(deps);

			const result = await system.purchase("Atlas", "cap-1");

			expect(result.success).toBe(false);
			expect(result.message).toBe("CLI purchase command failed");
		});
	});

	describe("shouldAutoPurchase", () => {
		it("true for level 5+ with affordable capability items", () => {
			const deps = makeDeps({ getBalance: () => ({ coin: 200, level: 5 }) });
			const system = new MerchantSystem(deps);

			expect(system.shouldAutoPurchase("Atlas")).toBe(true);
		});

		it("false for agents below level 5", () => {
			const deps = makeDeps({ getBalance: () => ({ coin: 999, level: 4 }) });
			const system = new MerchantSystem(deps);

			expect(system.shouldAutoPurchase("Atlas")).toBe(false);
		});

		it("false when no affordable capability items exist", () => {
			const deps = makeDeps({ getBalance: () => ({ coin: 0, level: 10 }) });
			const system = new MerchantSystem(deps);

			expect(system.shouldAutoPurchase("Atlas")).toBe(false);
		});
	});

	describe("getAutoPurchaseItem", () => {
		it("returns cheapest affordable capability item", () => {
			const deps = makeDeps({ getBalance: () => ({ coin: 200, level: 5 }) });
			const system = new MerchantSystem(deps);

			const item = system.getAutoPurchaseItem("Atlas");
			expect(item).toBeDefined();
			expect(item!.id).toBe("cap-3"); // cost 30, cheapest capability
		});

		it("returns undefined when nothing available", () => {
			const deps = makeDeps({ getBalance: () => ({ coin: 0, level: 1 }) });
			const system = new MerchantSystem(deps);

			const item = system.getAutoPurchaseItem("Atlas");
			expect(item).toBeUndefined();
		});
	});

	describe("isOwned", () => {
		it("returns true for owned oneTime items", () => {
			const owned = new Set(["cos-1"]);
			const deps = makeDeps({ getOwnedItems: () => owned });
			const system = new MerchantSystem(deps);

			expect(system.isOwned("Atlas", "cos-1")).toBe(true);
		});

		it("returns false when getOwnedItems is not provided", () => {
			const deps = makeDeps();
			const system = new MerchantSystem(deps);

			expect(system.isOwned("Atlas", "cos-1")).toBe(false);
		});

		it("returns false for non-oneTime items even if in owned set", () => {
			const owned = new Set(["res-1"]);
			const deps = makeDeps({ getOwnedItems: () => owned });
			const system = new MerchantSystem(deps);

			expect(system.isOwned("Atlas", "res-1")).toBe(false);
		});
	});
});
