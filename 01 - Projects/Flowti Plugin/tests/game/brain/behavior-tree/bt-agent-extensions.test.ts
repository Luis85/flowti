import { describe, it, expect, vi } from "vitest";
import { fromNodeState } from "../../../../src/game/brain/behavior-tree/bt-service.js";
import {
	IsHungry, IsThirsty, HasJourneyTask, ExecuteJourney,
	SeekFoodStation, SeekDrinkStation, Eat, Drink,
	IsMerchantEligible, HasNotVisitedMerchantThisCycle, HasAutoPurchaseAvailable,
	SeekMerchantStall, BrowseMerchant, ExecuteMerchantPurchase,
	type BTAgentExtensionDeps,
} from "../../../../src/game/brain/behavior-tree/bt-agent-extensions.js";
import type { AgentToolDeps, BTAgentContext } from "../../../../src/game/brain/behavior-tree/bt-types.js";

function makeContext(overrides: Partial<BTAgentContext> = {}): BTAgentContext {
	return {
		name: "Atlas",
		agentType: "ai",
		goals: [{ name: "review plan", priority: 10 }],
		needs: { energy: 80, hunger: 80, thirst: 80, social: 80, focus: 80, morale: 80 },
		experience: 100,
		lastMerchantVisitCycle: 0,
		...overrides,
	} as BTAgentContext;
}

function makeDeps(overrides: Partial<AgentToolDeps> = {}): AgentToolDeps {
	return {
		disk: { readFileSync: vi.fn(), writeFileSync: vi.fn(), existsSync: vi.fn(), mkdirSync: vi.fn() },
		paths: { join: (...s: string[]) => s.join("/"), dirname: (p: string) => p, basename: (p: string) => p },
		clock: { now: () => 1000, ms: () => 1000, iso: () => "2026-03-20T10:00:00Z" },
		worldState: { emitAction: vi.fn(), updateEntity: vi.fn() },
		checkPermission: vi.fn(() => "allowed" as const),
		...overrides,
	} as AgentToolDeps;
}

function makeExtDeps(overrides: Partial<BTAgentExtensionDeps> = {}): BTAgentExtensionDeps {
	return {
		context: makeContext(),
		collectedActions: [],
		collect: vi.fn(),
		deps: makeDeps(),
		...overrides,
	};
}

describe("bt-agent-extensions — journey", () => {
	it("HasJourneyTask returns false (stub — no SSE wiring yet)", () => {
		const ctx = makeContext();
		expect(HasJourneyTask(ctx)).toBe(false);
	});

	it("ExecuteJourney returns succeeded", () => {
		expect(ExecuteJourney()).toBe(fromNodeState("succeeded"));
	});
});

describe("bt-agent-extensions — hunger/thirst conditions", () => {
	it("IsHungry returns true when hunger below 35", () => {
		expect(IsHungry(makeContext({ needs: { hunger: 20 } } as Partial<BTAgentContext>))).toBe(true);
	});

	it("IsHungry returns false when hunger at or above 35", () => {
		expect(IsHungry(makeContext({ needs: { hunger: 50 } } as Partial<BTAgentContext>))).toBe(false);
	});

	it("IsThirsty returns true when thirst below 30", () => {
		expect(IsThirsty(makeContext({ needs: { thirst: 15 } } as Partial<BTAgentContext>))).toBe(true);
	});

	it("IsThirsty returns false when thirst at or above 30", () => {
		expect(IsThirsty(makeContext({ needs: { thirst: 50 } } as Partial<BTAgentContext>))).toBe(false);
	});
});

describe("bt-agent-extensions — hunger/thirst actions", () => {
	it("SeekFoodStation collects seek-food and applies brain event", () => {
		const brain = { applyEvent: vi.fn() };
		const ext = makeExtDeps({ deps: makeDeps({ brain } as Partial<AgentToolDeps>) });
		const result = SeekFoodStation(ext);
		expect(result).toBe(fromNodeState("succeeded"));
		expect(ext.collect).toHaveBeenCalledWith("seek-food");
		expect(brain.applyEvent).toHaveBeenCalledWith("Atlas", "seek-food");
	});

	it("SeekDrinkStation collects seek-drink and applies brain event", () => {
		const brain = { applyEvent: vi.fn() };
		const ext = makeExtDeps({ deps: makeDeps({ brain } as Partial<AgentToolDeps>) });
		const result = SeekDrinkStation(ext);
		expect(result).toBe(fromNodeState("succeeded"));
		expect(ext.collect).toHaveBeenCalledWith("seek-drink");
		expect(brain.applyEvent).toHaveBeenCalledWith("Atlas", "seek-drink");
	});

	it("Eat increases hunger by 30, capped at 100", () => {
		const ctx = makeContext({ needs: { hunger: 80 } } as Partial<BTAgentContext>);
		const collect = vi.fn();
		const result = Eat(ctx, collect);
		expect(result).toBe(fromNodeState("succeeded"));
		expect(ctx.needs.hunger).toBe(100);
		expect(collect).toHaveBeenCalledWith("idle");
	});

	it("Drink increases thirst by 30, capped at 100", () => {
		const ctx = makeContext({ needs: { thirst: 80 } } as Partial<BTAgentContext>);
		const collect = vi.fn();
		const result = Drink(ctx, collect);
		expect(result).toBe(fromNodeState("succeeded"));
		expect(ctx.needs.thirst).toBe(100);
		expect(collect).toHaveBeenCalledWith("idle");
	});
});

describe("bt-agent-extensions — merchant conditions", () => {
	it("IsMerchantEligible returns false when level below 5", () => {
		const ctx = makeContext({ level: 3 });
		expect(IsMerchantEligible(ctx, "trusted")).toBe(false);
	});

	it("IsMerchantEligible returns true when level >= 5 and trust is trusted", () => {
		const ctx = makeContext({ level: 10 });
		expect(IsMerchantEligible(ctx, "trusted")).toBe(true);
	});

	it("IsMerchantEligible returns true for autonomous trust tier", () => {
		const ctx = makeContext({ level: 10 });
		expect(IsMerchantEligible(ctx, "autonomous")).toBe(true);
	});

	it("IsMerchantEligible returns false for supervised trust tier", () => {
		const ctx = makeContext({ level: 10 });
		expect(IsMerchantEligible(ctx, "supervised")).toBe(false);
	});

	it("IsMerchantEligible defaults to supervised when trust is undefined", () => {
		const ctx = makeContext({ level: 10 });
		expect(IsMerchantEligible(ctx, undefined)).toBe(false);
	});

	it("HasNotVisitedMerchantThisCycle returns true when cycle count is ahead", () => {
		const ctx = makeContext({ lastMerchantVisitCycle: 2 });
		expect(HasNotVisitedMerchantThisCycle(ctx, () => 3)).toBe(true);
	});

	it("HasNotVisitedMerchantThisCycle returns false when already visited this cycle", () => {
		const ctx = makeContext({ lastMerchantVisitCycle: 3 });
		expect(HasNotVisitedMerchantThisCycle(ctx, () => 3)).toBe(false);
	});

	it("HasAutoPurchaseAvailable returns false when no merchant dep", () => {
		const ext = makeExtDeps({ deps: makeDeps({ merchant: undefined }) });
		expect(HasAutoPurchaseAvailable(ext)).toBe(false);
	});

	it("HasAutoPurchaseAvailable delegates to merchant.shouldAutoPurchase", () => {
		const merchant = {
			shouldAutoPurchase: vi.fn(() => true),
			getAutoPurchaseItemId: vi.fn(),
			purchase: vi.fn(),
			getCycleCount: vi.fn(() => 1),
		};
		const ext = makeExtDeps({ deps: makeDeps({ merchant } as Partial<AgentToolDeps>) });
		expect(HasAutoPurchaseAvailable(ext)).toBe(true);
		expect(merchant.shouldAutoPurchase).toHaveBeenCalledWith("Atlas");
	});
});

describe("bt-agent-extensions — merchant actions", () => {
	it("SeekMerchantStall collects seek-merchant", () => {
		const brain = { applyEvent: vi.fn() };
		const ext = makeExtDeps({ deps: makeDeps({ brain } as Partial<AgentToolDeps>) });
		const result = SeekMerchantStall(ext);
		expect(result).toBe(fromNodeState("succeeded"));
		expect(ext.collect).toHaveBeenCalledWith("seek-merchant");
	});

	it("BrowseMerchant collects idle with browsing-merchant activity", () => {
		const ext = makeExtDeps();
		const result = BrowseMerchant(ext);
		expect(result).toBe(fromNodeState("succeeded"));
		expect(ext.collect).toHaveBeenCalledWith("idle", { activity: "browsing-merchant" });
	});

	it("ExecuteMerchantPurchase returns failed when no merchant dep", () => {
		const ext = makeExtDeps({ deps: makeDeps({ merchant: undefined }) });
		expect(ExecuteMerchantPurchase(ext)).toBe(fromNodeState("failed"));
	});

	it("ExecuteMerchantPurchase returns failed when no item to purchase", () => {
		const merchant = {
			shouldAutoPurchase: vi.fn(),
			getAutoPurchaseItemId: vi.fn(() => null),
			purchase: vi.fn(),
			getCycleCount: vi.fn(() => 1),
		};
		const ext = makeExtDeps({ deps: makeDeps({ merchant } as Partial<AgentToolDeps>) });
		expect(ExecuteMerchantPurchase(ext)).toBe(fromNodeState("failed"));
	});

	it("ExecuteMerchantPurchase fires purchase and updates cycle", () => {
		const merchant = {
			shouldAutoPurchase: vi.fn(),
			getAutoPurchaseItemId: vi.fn(() => "potion-01"),
			purchase: vi.fn(() => Promise.resolve()),
			getCycleCount: vi.fn(() => 5),
		};
		const ext = makeExtDeps({ deps: makeDeps({ merchant } as Partial<AgentToolDeps>) });
		const result = ExecuteMerchantPurchase(ext);
		expect(result).toBe(fromNodeState("succeeded"));
		expect(merchant.purchase).toHaveBeenCalledWith("Atlas", "potion-01");
		expect(ext.collect).toHaveBeenCalledWith("merchant-purchase", { itemId: "potion-01" });
		expect(ext.context.lastMerchantVisitCycle).toBe(5);
	});
});
