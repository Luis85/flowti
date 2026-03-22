/**
 * merchant-system.ts — Purchase flow coordinator for the in-game shop.
 *
 * Manages catalog filtering, affordability checks, ownership validation,
 * and CLI-delegated purchases. Supports auto-purchase for level 5+ agents
 * that have affordable capability items available.
 */

// ── Public types ──────────────────────────────────────────────────────

export interface CatalogItem {
	readonly id: string;
	readonly name: string;
	readonly category: "capability" | "resource" | "cosmetic" | "pet-cosmetic" | "room";
	readonly cost: number;
	readonly requiresLevel?: number;
	readonly description?: string;
	readonly oneTime?: boolean;
}

export interface AgentBalance {
	readonly coin: number;
	readonly level: number;
}

export interface MerchantDeps {
	readonly runCli: (command: string) => Promise<string>;
	readonly getCatalog: () => readonly CatalogItem[];
	readonly getBalance: (agentName: string) => AgentBalance;
	readonly getOwnedItems?: (agentName: string) => ReadonlySet<string>;
}

// ── Auto-purchase threshold ───────────────────────────────────────────

const AUTO_PURCHASE_MIN_LEVEL = 5;

// ── System ────────────────────────────────────────────────────────────

export class MerchantSystem {
	private readonly deps: MerchantDeps;

	constructor(deps: MerchantDeps) {
		this.deps = deps;
	}

	/** Return catalog items the agent qualifies for by level. */
	getAvailableItems(agentName: string): CatalogItem[] {
		const { level } = this.deps.getBalance(agentName);
		return this.deps.getCatalog().filter(
			(item) => item.requiresLevel === undefined || item.requiresLevel <= level,
		);
	}

	/** Check whether the agent can afford a specific item. */
	canAfford(agentName: string, itemId: string): boolean {
		const item = this.findItem(itemId);
		if (!item) return false;
		const { coin } = this.deps.getBalance(agentName);
		return coin >= item.cost;
	}

	/** Check whether a oneTime item is already owned. */
	isOwned(agentName: string, itemId: string): boolean {
		const item = this.findItem(itemId);
		if (!item || !item.oneTime) return false;
		if (!this.deps.getOwnedItems) return false;
		return this.deps.getOwnedItems(agentName).has(itemId);
	}

	/** Combined validation: level + affordability + ownership. */
	canPurchase(agentName: string, itemId: string): { ok: boolean; reason?: string } {
		const item = this.findItem(itemId);
		if (!item) return { ok: false, reason: "Item not found" };

		const balance = this.deps.getBalance(agentName);

		if (item.requiresLevel !== undefined && balance.level < item.requiresLevel) {
			return { ok: false, reason: `Requires level ${item.requiresLevel}` };
		}

		if (balance.coin < item.cost) {
			return { ok: false, reason: `Not enough coin (need ${item.cost}, have ${balance.coin})` };
		}

		if (this.isOwned(agentName, itemId)) {
			return { ok: false, reason: "Item already owned" };
		}

		return { ok: true };
	}

	/** Validate and execute a purchase via CLI. */
	async purchase(agentName: string, itemId: string): Promise<{ success: boolean; message: string }> {
		const check = this.canPurchase(agentName, itemId);
		if (!check.ok) {
			return { success: false, message: check.reason ?? "Purchase not allowed" };
		}

		try {
			await this.deps.runCli(`shop:buy --agent=${agentName} --item=${itemId} --format=json`);
			const item = this.findItem(itemId);
			return { success: true, message: `Purchased ${item?.name ?? itemId}` };
		} catch {
			return { success: false, message: "CLI purchase command failed" };
		}
	}

	/** Whether an agent qualifies for auto-purchase (level 5+, has affordable unpurchased capability). */
	shouldAutoPurchase(agentName: string): boolean {
		const balance = this.deps.getBalance(agentName);
		if (balance.level < AUTO_PURCHASE_MIN_LEVEL) return false;
		return this.getAutoPurchaseItem(agentName) !== undefined;
	}

	/** Return the cheapest affordable unpurchased capability item, or undefined. */
	getAutoPurchaseItem(agentName: string): CatalogItem | undefined {
		const available = this.getAvailableItems(agentName);
		const balance = this.deps.getBalance(agentName);

		const candidates = available
			.filter((item) => item.category === "capability")
			.filter((item) => balance.coin >= item.cost)
			.filter((item) => !this.isOwned(agentName, item.id));

		if (candidates.length === 0) return undefined;

		return candidates.reduce((cheapest, item) =>
			item.cost < cheapest.cost ? item : cheapest,
		);
	}

	// ── Private helpers ───────────────────────────────────────────────

	private findItem(itemId: string): CatalogItem | undefined {
		return this.deps.getCatalog().find((item) => item.id === itemId);
	}
}
