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
		{
			id: "tool-vault-write",
			name: "Vault Write Access",
			category: "capability",
			cost: { coin: 200 },
			requiresLevel: 3,
			description: "Unlocks note creation and file editing",
			oneTime: true,
		},
		{
			id: "token-pack-5k",
			name: "Token Pack (5,000)",
			category: "resource",
			cost: { coin: 100 },
			description: "5,000 LLM tokens",
			oneTime: false,
		},
		{
			id: "title-senior",
			name: "Senior Title Badge",
			category: "cosmetic",
			cost: { coin: 150 },
			requiresLevel: 5,
			description: "Display 'Senior' title in the world",
			oneTime: true,
		},
		{
			id: "pet-hat-tophat",
			name: "Top Hat (Pet)",
			category: "pet-cosmetic",
			cost: { coin: 50 },
			description: "A dapper top hat for your companion",
			oneTime: false,
		},
		{
			id: "delegation-license",
			name: "Delegation License",
			category: "capability",
			cost: { coin: 300 },
			requiresLevel: 4,
			description: "Unlocks ability to assign tasks to other agents",
			oneTime: true,
		},
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
