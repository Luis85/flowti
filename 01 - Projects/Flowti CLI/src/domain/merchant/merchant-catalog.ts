/**
 * merchant-catalog.ts — CRUD operations for the merchant catalog.
 *
 * Catalog stored at .flowti/var/merchant-catalog.json.
 * Returns a default catalog when the file is missing.
 */

import type { MerchantCatalog, CatalogItem } from "./merchant-types.js";
import { debitCoin } from "../economy/economy-ledger.js";
import type { EconomyLedger } from "../economy/economy-types.js";

const CATALOG_PATH = ".flowti/var/merchant-catalog.json";

type CatalogDeps = {
	readonly disk: {
		existsSync(p: string): boolean;
		readFileSync(p: string, enc?: string): string;
		writeFileSync(p: string, c: string): void;
		mkdirSync(p: string, opts?: { recursive?: boolean }): void;
	};
	readonly paths: { join(...segs: string[]): string; dirname(p: string): string };
};

// ── Default catalog ───────────────────────────────────────────────────

const DEFAULT_CATALOG: MerchantCatalog = {
	version: 1,
	items: [
		// Capabilities — IDs match leveling.ts unlock keys
		{ id: "vault-read", name: "Vault Reader", category: "capability", cost: { coin: 40 }, requiresLevel: 1, description: "Read vault notes and paths", oneTime: true },
		{ id: "simple-tasks", name: "Task Basics", category: "capability", cost: { coin: 60 }, requiresLevel: 1, description: "Run simple assigned tasks", oneTime: true },
		{ id: "standing-orders", name: "Standing Orders", category: "capability", cost: { coin: 120 }, requiresLevel: 2, description: "Recurring task loops", oneTime: true },
		{ id: "vault-write", name: "Vault Scribe", category: "capability", cost: { coin: 200 }, requiresLevel: 3, description: "Create and edit vault files", oneTime: true },
		{ id: "self-proposed", name: "Self-Proposed Work", category: "capability", cost: { coin: 220 }, requiresLevel: 3, description: "Propose your own tasks", oneTime: true },
		{ id: "delegation", name: "Delegation", category: "capability", cost: { coin: 350 }, requiresLevel: 4, description: "Assign work to others", oneTime: true },
		{ id: "journey", name: "Journey Mode", category: "capability", cost: { coin: 380 }, requiresLevel: 4, description: "Multi-step journeys across tools", oneTime: true },
		{ id: "auto-trust", name: "Auto-Trust Lane", category: "capability", cost: { coin: 500 }, requiresLevel: 5, description: "Faster trust for routine ops", oneTime: true },
		{ id: "higher-token-budget", name: "Token Budget+", category: "capability", cost: { coin: 520 }, requiresLevel: 5, description: "Larger tool budgets", oneTime: true },
		{ id: "cross-domain", name: "Cross-Domain", category: "capability", cost: { coin: 700 }, requiresLevel: 6, description: "Work outside primary domain", oneTime: true },
		{ id: "mentoring", name: "Mentoring", category: "capability", cost: { coin: 850 }, requiresLevel: 7, description: "Guide junior agents", oneTime: true },
		{ id: "full-autonomy", name: "Full Autonomy", category: "capability", cost: { coin: 1200 }, requiresLevel: 8, description: "Minimal supervision mode", oneTime: true },
		{ id: "economy-influence", name: "Economy Influence", category: "capability", cost: { coin: 1200 }, requiresLevel: 8, description: "Shape rewards and standings", oneTime: true },
		// Resources
		{ id: "focus-drink", name: "Focus Tonic", category: "resource", cost: { coin: 25 }, description: "Small morale boost this cycle" },
		{ id: "lucky-charm", name: "Lucky Charm", category: "resource", cost: { coin: 45 }, requiresLevel: 2, description: "Slight trust bonus on next task" },
		// Cosmetics
		{ id: "aura-gold", name: "Gold Aura", category: "cosmetic", cost: { coin: 150 }, requiresLevel: 3, description: "Golden idle shimmer", oneTime: true },
		{ id: "title-sage", name: "Title: Sage", category: "cosmetic", cost: { coin: 300 }, requiresLevel: 5, description: "Display title in roster", oneTime: true },
	],
	buyback: 0.5,
	restockCycle: "daily",
};

// ── Read / Write ──────────────────────────────────────────────────────

export function readCatalog(deps: CatalogDeps, vaultRoot: string): MerchantCatalog {
	const path = deps.paths.join(vaultRoot, CATALOG_PATH);
	if (!deps.disk.existsSync(path)) return DEFAULT_CATALOG;
	try {
		const raw = deps.disk.readFileSync(path, "utf-8");
		return JSON.parse(raw) as MerchantCatalog;
	} catch {
		return DEFAULT_CATALOG;
	}
}

export function writeCatalog(deps: CatalogDeps, vaultRoot: string, catalog: MerchantCatalog): void {
	const path = deps.paths.join(vaultRoot, CATALOG_PATH);
	const dir = deps.paths.dirname(path);
	deps.disk.mkdirSync(dir, { recursive: true });
	deps.disk.writeFileSync(path, JSON.stringify(catalog, null, "\t"));
}

// ── Queries ───────────────────────────────────────────────────────────

export function getAvailableItems(catalog: MerchantCatalog, agentLevel: number): CatalogItem[] {
	return catalog.items.filter((item) => (item.requiresLevel ?? 1) <= agentLevel);
}

// ── Purchase ──────────────────────────────────────────────────────────

export interface PurchasedSet {
	readonly [agentName: string]: readonly string[];
}

export function purchaseItem(
	catalog: MerchantCatalog,
	ledger: EconomyLedger,
	agentName: string,
	itemId: string,
	agentLevel: number,
	purchased?: PurchasedSet,
): { catalog: MerchantCatalog; ledger: EconomyLedger } | null {
	const item = catalog.items.find((i) => i.id === itemId);
	if (!item) return null;

	if ((item.requiresLevel ?? 1) > agentLevel) return null;

	if (item.oneTime) {
		const agentPurchased = purchased?.[agentName] ?? [];
		if (agentPurchased.includes(itemId)) return null;
	}

	const updatedLedger = debitCoin(ledger, agentName, item.cost.coin);
	if (updatedLedger === null) return null;

	return { catalog, ledger: updatedLedger };
}
