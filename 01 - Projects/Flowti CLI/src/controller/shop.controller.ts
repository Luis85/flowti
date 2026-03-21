/**
 * shop.controller.ts — CLI commands for the merchant shop.
 *
 * Provides shop:list, shop:buy, shop:catalog:add, and shop:catalog:edit commands.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types-config.js";
import type { CliDeps } from "../infrastructure/deps.js";
import { readCatalog, writeCatalog, getAvailableItems, purchaseItem } from "../domain/merchant/merchant-catalog.js";
import { readLedger, writeLedger, getAccount } from "../domain/economy/economy-ledger.js";
import { renderShopList, renderShopBuy, renderShopCatalogAdd, renderShopCatalogEdit } from "../ui/displays/shop-display.js";
import { VAULT_ROOT } from "../infrastructure/config.js";
import type { CatalogItem, ShopCategory } from "../domain/merchant/merchant-types.js";

// ── Helpers ────────────────────────────────────────────────────────

/** Build a CatalogDeps-compatible object from CliDeps. */
function catalogDeps(deps: CliDeps) {
	return {
		disk: {
			existsSync: (p: string) => deps.disk.existsSync(p),
			readFileSync: (p: string, enc?: string) => deps.disk.readFileSync(p, (enc ?? "utf-8") as BufferEncoding),
			writeFileSync: (p: string, c: string) => deps.disk.writeFileSync(p, c, "utf-8"),
			mkdirSync: (p: string, opts?: { recursive?: boolean }) => deps.disk.mkdirSync(p, opts),
		},
		paths: deps.paths,
	};
}

/** Build a LedgerDeps-compatible object from CliDeps. */
function ledgerDeps(deps: CliDeps) {
	return {
		disk: {
			existsSync: (p: string) => deps.disk.existsSync(p),
			readFileSync: (p: string, enc?: string) => deps.disk.readFileSync(p, (enc ?? "utf-8") as BufferEncoding),
			writeFileSync: (p: string, c: string) => deps.disk.writeFileSync(p, c, "utf-8"),
			mkdirSync: (p: string, opts?: { recursive?: boolean }) => deps.disk.mkdirSync(p, opts),
		},
		paths: deps.paths,
		clock: deps.clock,
	};
}

const VALID_CATEGORIES = new Set<ShopCategory>(["capability", "resource", "cosmetic", "pet-cosmetic", "room"]);

// ── Commands ──────────────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = {
	"shop:list": adaptDescriptor({
		handler: (ctx) => {
			const deps = catalogDeps(ctx.deps);
			const ledgerD = ledgerDeps(ctx.deps);
			const catalog = readCatalog(deps, VAULT_ROOT);
			const ledger = readLedger(ledgerD, VAULT_ROOT);
			// Show all items (use max level to show full catalog); level display is informational
			const maxLevel = Math.max(...Object.values(ledger.accounts).map((a) => a.level), 1);
			const items = getAvailableItems(catalog, maxLevel);
			return {
				items: catalog.items.map((item) => ({
					id: item.id,
					name: item.name,
					category: item.category,
					coin: item.cost.coin,
					requiresLevel: item.requiresLevel ?? 1,
					description: item.description,
					oneTime: item.oneTime ?? false,
				})),
				available: items.map((i) => i.id),
			};
		},
		renderer: renderShopList,
	}),

	"shop:buy": adaptDescriptor({
		flags: {
			agent: { type: "string", required: true, hint: "--agent=<name>" },
			item: { type: "string", required: true, hint: "--item=<id>" },
		},
		handler: (ctx) => {
			const agentName = ctx.flags.agent as string;
			const itemId = ctx.flags.item as string;
			const deps = catalogDeps(ctx.deps);
			const ledgerD = ledgerDeps(ctx.deps);
			const catalog = readCatalog(deps, VAULT_ROOT);
			const ledger = readLedger(ledgerD, VAULT_ROOT);
			const account = getAccount(ledger, agentName);

			const catalogItem = catalog.items.find((i) => i.id === itemId);
			if (!catalogItem) {
				return { agent: agentName, itemId, itemName: itemId, cost: 0, success: false, reason: `Item '${itemId}' not found in catalog` };
			}

			if ((catalogItem.requiresLevel ?? 1) > account.level) {
				return {
					agent: agentName, itemId, itemName: catalogItem.name, cost: catalogItem.cost.coin,
					success: false, reason: `Requires level ${catalogItem.requiresLevel ?? 1} (agent is level ${account.level})`,
				};
			}

			const result = purchaseItem(catalog, ledger, agentName, itemId, account.level);
			if (!result) {
				return {
					agent: agentName, itemId, itemName: catalogItem.name, cost: catalogItem.cost.coin,
					success: false, reason: `Insufficient coin (need ${catalogItem.cost.coin}, have ${account.coin})`,
				};
			}

			writeLedger(ledgerD, VAULT_ROOT, result.ledger);
			return { agent: agentName, itemId, itemName: catalogItem.name, cost: catalogItem.cost.coin, success: true };
		},
		renderer: renderShopBuy,
	}),

	"shop:catalog:add": adaptDescriptor({
		flags: {
			id: { type: "string", required: true, hint: "--id=<id>" },
			name: { type: "string", required: true, hint: "--name=<name>" },
			cost: { type: "number", required: true, hint: "--cost=<coin>" },
			category: { type: "string", required: true, hint: "--category=<category>" },
			description: { type: "string", default: "", hint: "--description=<text>" },
			level: { type: "number", default: 1, hint: "--level=<n>" },
			oneTime: { type: "boolean", default: false, hint: "--oneTime" },
		},
		handler: (ctx) => {
			const id = ctx.flags.id as string;
			const name = ctx.flags.name as string;
			const cost = ctx.flags.cost as number;
			const rawCategory = ctx.flags.category as string;
			const description = ctx.flags.description as string;
			const requiresLevel = ctx.flags.level as number;
			const oneTime = ctx.flags.oneTime as boolean;

			const category = VALID_CATEGORIES.has(rawCategory as ShopCategory)
				? (rawCategory as ShopCategory)
				: "resource" as ShopCategory;

			const deps = catalogDeps(ctx.deps);
			const catalog = readCatalog(deps, VAULT_ROOT);

			const newItem: CatalogItem = {
				id, name, category,
				cost: { coin: cost },
				requiresLevel: requiresLevel > 1 ? requiresLevel : undefined,
				description,
				oneTime: oneTime || undefined,
			};

			const updated = { ...catalog, items: [...catalog.items, newItem] };
			writeCatalog(deps, VAULT_ROOT, updated);
			return { id, name };
		},
		renderer: renderShopCatalogAdd,
	}),

	"shop:catalog:edit": adaptDescriptor({
		flags: {
			id: { type: "string", required: true, hint: "--id=<id>" },
			cost: { type: "number", required: true, hint: "--cost=<coin>" },
		},
		handler: (ctx) => {
			const id = ctx.flags.id as string;
			const cost = ctx.flags.cost as number;
			const deps = catalogDeps(ctx.deps);
			const catalog = readCatalog(deps, VAULT_ROOT);

			const updated = {
				...catalog,
				items: catalog.items.map((item) =>
					item.id === id ? { ...item, cost: { coin: cost } } : item,
				),
			};
			writeCatalog(deps, VAULT_ROOT, updated);
			return { id, cost };
		},
		renderer: renderShopCatalogEdit,
	}),
};
