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
import { createDefaultBlackboard } from "../../../../src/game/systems/blackboard.js";

function makeContext(overrides: Partial<BTAgentContext> = {}): BTAgentContext {
	return {
		name: "Atlas",
		agentType: "ai",
		goals: [{ name: "review plan", priority: 10 }],
		needs: { energy: 80, hunger: 80, thirst: 80, social: 80, focus: 80, morale: 80 },
		xp: 100,
		lastMerchantVisitCycle: 0,
		...overrides,
	} as BTAgentContext;
}

function makeDeps(overrides: Partial<AgentToolDeps> = {}): AgentToolDeps {
	return {
		disk: { readFileSync: vi.fn(), writeFileSync: vi.fn(), existsSync: vi.fn(), mkdirSync: vi.fn() },
		paths: { join: (...s: string[]) => s.join("/"), dirname: (p: string) => p, basename: (p: string) => p },
		clock: { now: () => 1000, ms: () => 1000, iso: () => "2026-03-20T10:00:00Z" },
		checkPermission: vi.fn(() => "allowed" as const),
		blackboard: createDefaultBlackboard(),
		...overrides,
	} as AgentToolDeps;
}

function makeExtDeps(overrides: Partial<BTAgentExtensionDeps> = {}): BTAgentExtensionDeps {
	return {
		context: makeContext(),
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

const BASE_NEEDS = { energy: 80, hunger: 80, thirst: 80, social: 80, focus: 80, morale: 80 };

describe("bt-agent-extensions — hunger/thirst conditions", () => {
	it("IsHungry returns true when hunger below 35", () => {
		expect(IsHungry(makeContext({ needs: { ...BASE_NEEDS, hunger: 20 } }))).toBe(true);
	});

	it("IsHungry returns false when hunger at or above 35", () => {
		expect(IsHungry(makeContext({ needs: { ...BASE_NEEDS, hunger: 50 } }))).toBe(false);
	});

	it("IsThirsty returns true when thirst below 30", () => {
		expect(IsThirsty(makeContext({ needs: { ...BASE_NEEDS, thirst: 15 } }))).toBe(true);
	});

	it("IsThirsty returns false when thirst at or above 30", () => {
		expect(IsThirsty(makeContext({ needs: { ...BASE_NEEDS, thirst: 50 } }))).toBe(false);
	});
});

describe("bt-agent-extensions — hunger/thirst actions", () => {
	it("SeekFoodStation writes seeking intent to blackboard", () => {
		const bb = createDefaultBlackboard();
		const ext = makeExtDeps({ deps: makeDeps({ blackboard: bb }) });
		const result = SeekFoodStation(ext);
		expect(result).toBe(fromNodeState("succeeded"));
		expect(bb.intent).toBe("seeking");
		expect(bb.intentDetail).toBe("seek-food");
	});

	it("SeekDrinkStation writes seeking intent to blackboard", () => {
		const bb = createDefaultBlackboard();
		const ext = makeExtDeps({ deps: makeDeps({ blackboard: bb }) });
		const result = SeekDrinkStation(ext);
		expect(result).toBe(fromNodeState("succeeded"));
		expect(bb.intent).toBe("seeking");
		expect(bb.intentDetail).toBe("seek-drink");
	});

	it("Eat increases hunger by 30, capped at 100", () => {
		const ctx = makeContext({ needs: { ...BASE_NEEDS, hunger: 80 } });
		const result = Eat(ctx);
		expect(result).toBe(fromNodeState("succeeded"));
		expect(ctx.needs.hunger).toBe(100);
	});

	it("Drink increases thirst by 30, capped at 100", () => {
		const ctx = makeContext({ needs: { ...BASE_NEEDS, thirst: 80 } });
		const result = Drink(ctx);
		expect(result).toBe(fromNodeState("succeeded"));
		expect(ctx.needs.thirst).toBe(100);
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
			getAutoPurchaseItem: vi.fn(),
			purchase: vi.fn(),
			getCycleCount: vi.fn(() => 1),
		};
		const ext = makeExtDeps({ deps: makeDeps({ merchant } as Partial<AgentToolDeps>) });
		expect(HasAutoPurchaseAvailable(ext)).toBe(true);
		expect(merchant.shouldAutoPurchase).toHaveBeenCalledWith("Atlas");
	});
});

describe("bt-agent-extensions — merchant actions", () => {
	it("SeekMerchantStall writes seeking intent to blackboard", () => {
		const bb = createDefaultBlackboard();
		const ext = makeExtDeps({ deps: makeDeps({ blackboard: bb }) });
		const result = SeekMerchantStall(ext);
		expect(result).toBe(fromNodeState("succeeded"));
		expect(bb.intent).toBe("seeking");
		expect(bb.intentDetail).toBe("seek-merchant");
	});

	it("BrowseMerchant writes browsing-merchant to blackboard", () => {
		const bb = createDefaultBlackboard();
		const ext = makeExtDeps({ deps: makeDeps({ blackboard: bb }) });
		const result = BrowseMerchant(ext);
		expect(result).toBe(fromNodeState("succeeded"));
		expect(bb.intentDetail).toBe("browsing-merchant");
	});

	it("ExecuteMerchantPurchase returns failed when no merchant dep", () => {
		const ext = makeExtDeps({ deps: makeDeps({ merchant: undefined }) });
		expect(ExecuteMerchantPurchase(ext)).toBe(fromNodeState("failed"));
	});

	it("ExecuteMerchantPurchase returns failed when no item to purchase", () => {
		const merchant = {
			shouldAutoPurchase: vi.fn(),
			getAutoPurchaseItem: vi.fn(() => undefined),
			purchase: vi.fn(),
			getCycleCount: vi.fn(() => 1),
		};
		const ext = makeExtDeps({ deps: makeDeps({ merchant } as unknown as Partial<AgentToolDeps>) });
		expect(ExecuteMerchantPurchase(ext)).toBe(fromNodeState("failed"));
	});

	it("ExecuteMerchantPurchase fires purchase and updates cycle", () => {
		const merchant = {
			shouldAutoPurchase: vi.fn(),
			getAutoPurchaseItem: vi.fn(() => ({ id: "potion-01", name: "Potion", cost: 10 })),
			purchase: vi.fn(() => Promise.resolve()),
			getCycleCount: vi.fn(() => 5),
		};
		const ext = makeExtDeps({ deps: makeDeps({ merchant } as unknown as Partial<AgentToolDeps>) });
		const result = ExecuteMerchantPurchase(ext);
		expect(result).toBe(fromNodeState("succeeded"));
		expect(merchant.purchase).toHaveBeenCalledWith("Atlas", "potion-01");
		expect(ext.context.lastMerchantVisitCycle).toBe(5);
	});
});
