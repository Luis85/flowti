/**
 * shop-display.ts — Renderers for shop CLI commands.
 */

import { BOLD, RESET, DIM, GREEN, RED, YELLOW, CYAN } from "../../infrastructure/ui.js";
import type { LogFn } from "../../infrastructure/command-engine.js";
import type { ShopCategory } from "../../domain/merchant/merchant-types.js";

// ── Data models ───────────────────────────────────────────────────────

interface ShopItemModel {
	readonly id: string;
	readonly name: string;
	readonly category: ShopCategory;
	readonly coin: number;
	readonly requiresLevel: number;
	readonly description: string;
	readonly oneTime: boolean;
}

export interface ShopListModel {
	readonly items: readonly ShopItemModel[];
}

export interface ShopBuyModel {
	readonly agent: string;
	readonly itemId: string;
	readonly itemName: string;
	readonly cost: number;
	readonly success: boolean;
	readonly reason?: string;
}

export interface ShopCatalogAddModel {
	readonly id: string;
	readonly name: string;
}

export interface ShopCatalogEditModel {
	readonly id: string;
	readonly cost: number;
}

// ── Helpers ───────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<ShopCategory, string> = {
	capability: CYAN,
	resource: GREEN,
	cosmetic: YELLOW,
	"pet-cosmetic": YELLOW,
	room: DIM,
};

// ── Renderers ─────────────────────────────────────────────────────────

export function renderShopList(data: ShopListModel, log: LogFn): void {
	if (data.items.length === 0) {
		log(`${DIM}No items in catalog.${RESET}`);
		return;
	}
	log(`${BOLD}Merchant Catalog${RESET} (${data.items.length} items)\n`);
	for (const item of data.items) {
		const color = CATEGORY_COLOR[item.category] ?? "";
		const levelNote = item.requiresLevel > 1 ? `  ${DIM}(Lv${item.requiresLevel}+)${RESET}` : "";
		const oneTimeNote = item.oneTime ? `  ${DIM}[one-time]${RESET}` : "";
		log(`  ${BOLD}${item.id}${RESET}  ${color}${item.name}${RESET}  ${YELLOW}${item.coin}c${RESET}${levelNote}${oneTimeNote}`);
		log(`    ${DIM}${item.description}${RESET}`);
	}
}

export function renderShopBuy(data: ShopBuyModel, log: LogFn): void {
	if (data.success) {
		log(`${GREEN}Purchased${RESET} ${BOLD}${data.itemName}${RESET} for ${YELLOW}${data.cost}c${RESET} (agent: ${data.agent})`);
	} else {
		log(`${RED}Purchase failed${RESET} — ${data.reason ?? "unknown reason"}`);
	}
}

export function renderShopCatalogAdd(data: ShopCatalogAddModel, log: LogFn): void {
	log(`${GREEN}Added${RESET} item ${BOLD}${data.id}${RESET} (${data.name}) to catalog`);
}

export function renderShopCatalogEdit(data: ShopCatalogEditModel, log: LogFn): void {
	log(`${GREEN}Updated${RESET} item ${BOLD}${data.id}${RESET} — new cost: ${YELLOW}${data.cost}c${RESET}`);
}
