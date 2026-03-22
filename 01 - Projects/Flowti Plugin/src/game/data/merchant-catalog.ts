/**
 * Default merchant stock — mirrors Flowti CLI leveling unlocks (see economy/leveling.ts).
 * Agent ownership of one-time items is inferred from dashboard `capabilities[]` when present.
 */

import type { CatalogItem } from "../systems/merchant-system.js";

export const MERCHANT_CATALOG: readonly CatalogItem[] = [
	// Capabilities (one-time; ids match leveling unlock keys)
	{ id: "vault-read", name: "Vault Reader", category: "capability", cost: 40, requiresLevel: 1, description: "Read vault notes and paths.", oneTime: true },
	{ id: "simple-tasks", name: "Task Basics", category: "capability", cost: 60, requiresLevel: 1, description: "Run simple assigned tasks.", oneTime: true },
	{ id: "standing-orders", name: "Standing Orders", category: "capability", cost: 120, requiresLevel: 2, description: "Recurring task loops.", oneTime: true },
	{ id: "vault-write", name: "Vault Scribe", category: "capability", cost: 200, requiresLevel: 3, description: "Create and edit vault files.", oneTime: true },
	{ id: "self-proposed", name: "Self-Proposed Work", category: "capability", cost: 220, requiresLevel: 3, description: "Propose your own tasks.", oneTime: true },
	{ id: "delegation", name: "Delegation", category: "capability", cost: 350, requiresLevel: 4, description: "Assign work to others.", oneTime: true },
	{ id: "journey", name: "Journey Mode", category: "capability", cost: 380, requiresLevel: 4, description: "Multi-step journeys across tools.", oneTime: true },
	{ id: "auto-trust", name: "Auto-Trust Lane", category: "capability", cost: 500, requiresLevel: 5, description: "Faster trust for routine ops.", oneTime: true },
	{ id: "higher-token-budget", name: "Token Budget+", category: "capability", cost: 520, requiresLevel: 5, description: "Larger tool budgets.", oneTime: true },
	{ id: "cross-domain", name: "Cross-Domain", category: "capability", cost: 700, requiresLevel: 6, description: "Work outside primary domain.", oneTime: true },
	{ id: "mentoring", name: "Mentoring", category: "capability", cost: 850, requiresLevel: 7, description: "Guide junior agents.", oneTime: true },
	{ id: "full-autonomy", name: "Full Autonomy", category: "capability", cost: 1200, requiresLevel: 8, description: "Minimal supervision mode.", oneTime: true },
	{ id: "economy-influence", name: "Economy Influence", category: "capability", cost: 1200, requiresLevel: 8, description: "Shape rewards and standings.", oneTime: true },
	// Resources (repeatable)
	{ id: "focus-drink", name: "Focus Tonic", category: "resource", cost: 25, requiresLevel: 1, description: "Small morale boost this cycle." },
	{ id: "lucky-charm", name: "Lucky Charm", category: "resource", cost: 45, requiresLevel: 2, description: "Slight trust bonus on next task." },
	// Cosmetics
	{ id: "aura-gold", name: "Gold Aura", category: "cosmetic", cost: 150, requiresLevel: 3, description: "Golden idle shimmer.", oneTime: true },
	{ id: "title-sage", name: "Title: Sage", category: "cosmetic", cost: 300, requiresLevel: 5, description: "Display title in roster.", oneTime: true },
];
