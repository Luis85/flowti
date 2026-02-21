/**
 * Pure health-check functions that derive diagnostics from CatalogState.
 *
 * Every function is side-effect-free and operates on plain data —
 * no DOM, no Obsidian imports — making them trivially unit-testable.
 */

import type { EventCatalogEntry } from "../../infrastructure/events/catalog";
import type { CatalogState } from "./types";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type HealthSeverity = "pass" | "warn" | "fail";

export type HealthCheckCategory =
	| "documentation"
	| "consistency"
	| "references"
	| "coverage";

export interface HealthCheckItem {
	/** Entity name (domain name, flow name, event type, etc.) */
	name: string;
	/** Reason this item appears in the check results */
	reason: string;
	/** Entity type for navigation ("domain" | "service" | "flow" | etc.) */
	entityType: string;
}

export interface HealthCheckResult {
	/** Unique identifier for this check */
	id: string;
	/** Human-readable check title */
	title: string;
	/** Category grouping */
	category: HealthCheckCategory;
	/** pass / warn / fail based on thresholds */
	severity: HealthSeverity;
	/** Score as fraction 0..1 (1 = perfect) */
	score: number;
	/** Human-readable summary (e.g. "5 / 8 documented") */
	summary: string;
	/** Affected items (shown in detail panel) */
	items: HealthCheckItem[];
}

export interface HealthReport {
	/** Aggregate score 0..100 */
	overallScore: number;
	/** Individual check results */
	checks: HealthCheckResult[];
}

// ─────────────────────────────────────────────────────────────
// 1. Documentation Coverage
// ─────────────────────────────────────────────────────────────

export function checkDocCoverage(state: CatalogState): HealthCheckResult {
	const items: HealthCheckItem[] = [];

	const domains = state.domainEntries.filter(
		(d) => d.visible && (state.showSystemEvents || !d.isSystem),
	);
	for (const d of domains) {
		if (d.filePath === null) {
			items.push({ name: d.name, reason: "No domain doc file", entityType: "domain" });
		}
	}

	const services = state.serviceEntries.filter(
		(s) => s.visible && (state.showSystemEvents || !s.isSystem),
	);
	for (const s of services) {
		if (s.filePath === null) {
			items.push({ name: s.name, reason: "No service doc file", entityType: "service" });
		}
	}

	const total = domains.length + services.length;
	const documented = total - items.length;
	const score = total > 0 ? documented / total : 1;

	return {
		id: "doc-coverage",
		title: "Documentation Coverage",
		category: "documentation",
		severity: score >= 0.8 ? "pass" : score >= 0.5 ? "warn" : "fail",
		score,
		summary: `${documented} / ${total} entities documented`,
		items,
	};
}

// ─────────────────────────────────────────────────────────────
// 2. Frontmatter Completeness
// ─────────────────────────────────────────────────────────────

export function checkFrontmatterCompleteness(state: CatalogState): HealthCheckResult {
	const items: HealthCheckItem[] = [];

	for (const f of state.flowEntries) {
		if (f.events.length === 0) {
			items.push({ name: f.name, reason: "Flow has no events listed", entityType: "flow" });
		}
		if (f.domains.length === 0 && f.services.length === 0) {
			items.push({ name: f.name, reason: "Flow has no domains or services", entityType: "flow" });
		}
	}

	for (const s of state.systemEntries) {
		if (s.domains.length === 0 && s.services.length === 0) {
			items.push({ name: s.name, reason: "System has no domains or services", entityType: "system" });
		}
	}

	for (const a of state.actorEntries) {
		if (a.events.length === 0) {
			items.push({ name: a.name, reason: "Actor has no events listed", entityType: "actor" });
		}
	}

	for (const p of state.productEntries) {
		if (p.events.length === 0 && p.domains.length === 0) {
			items.push({ name: p.name, reason: "Product has no events or domains", entityType: "product" });
		}
	}

	const totalEntities =
		state.flowEntries.length +
		state.systemEntries.length +
		state.actorEntries.length +
		state.productEntries.length;
	const problemEntities = new Set(items.map((i) => `${i.entityType}:${i.name}`)).size;
	const score = totalEntities > 0 ? (totalEntities - problemEntities) / totalEntities : 1;

	return {
		id: "frontmatter-completeness",
		title: "Frontmatter Completeness",
		category: "consistency",
		severity: score >= 0.9 ? "pass" : score >= 0.6 ? "warn" : "fail",
		score,
		summary:
			problemEntities === 0
				? "All entity docs have required fields"
				: `${problemEntities} of ${totalEntities} entity docs have missing fields`,
		items,
	};
}

// ─────────────────────────────────────────────────────────────
// 3. Reference Integrity
// ─────────────────────────────────────────────────────────────

export function checkReferenceIntegrity(
	state: CatalogState,
	allEvents: EventCatalogEntry[],
): HealthCheckResult {
	const items: HealthCheckItem[] = [];
	const eventTypes = new Set(allEvents.map((e) => e.type));
	const domainNames = new Set(state.domainEntries.map((d) => d.name));
	const serviceNames = new Set(state.serviceEntries.map((s) => s.name));

	for (const f of state.flowEntries) {
		for (const evt of f.events) {
			if (!eventTypes.has(evt)) {
				items.push({ name: f.name, reason: `References unknown event: ${evt}`, entityType: "flow" });
			}
		}
		for (const d of f.domains) {
			if (!domainNames.has(d)) {
				items.push({ name: f.name, reason: `References unknown domain: ${d}`, entityType: "flow" });
			}
		}
		for (const s of f.services) {
			if (!serviceNames.has(s)) {
				items.push({ name: f.name, reason: `References unknown service: ${s}`, entityType: "flow" });
			}
		}
	}

	for (const sys of state.systemEntries) {
		for (const d of sys.domains) {
			if (!domainNames.has(d)) {
				items.push({ name: sys.name, reason: `References unknown domain: ${d}`, entityType: "system" });
			}
		}
		for (const s of sys.services) {
			if (!serviceNames.has(s)) {
				items.push({ name: sys.name, reason: `References unknown service: ${s}`, entityType: "system" });
			}
		}
	}

	for (const a of state.actorEntries) {
		for (const evt of a.events) {
			if (!eventTypes.has(evt)) {
				items.push({ name: a.name, reason: `References unknown event: ${evt}`, entityType: "actor" });
			}
		}
	}

	for (const p of state.productEntries) {
		for (const evt of p.events) {
			if (!eventTypes.has(evt)) {
				items.push({ name: p.name, reason: `References unknown event: ${evt}`, entityType: "product" });
			}
		}
	}

	const totalRefs = countTotalRefs(state);
	const score = totalRefs > 0 ? Math.max(0, (totalRefs - items.length) / totalRefs) : 1;

	return {
		id: "reference-integrity",
		title: "Reference Integrity",
		category: "references",
		severity: items.length === 0 ? "pass" : items.length <= 3 ? "warn" : "fail",
		score,
		summary:
			items.length === 0
				? "All references resolve correctly"
				: `${items.length} broken reference${items.length === 1 ? "" : "s"} found`,
		items,
	};
}

function countTotalRefs(state: CatalogState): number {
	let count = 0;
	for (const f of state.flowEntries)
		count += f.events.length + f.domains.length + f.services.length;
	for (const s of state.systemEntries) count += s.domains.length + s.services.length;
	for (const a of state.actorEntries)
		count += a.events.length + a.domains.length + a.services.length;
	for (const p of state.productEntries)
		count += p.events.length + p.domains.length + p.services.length;
	return count;
}

// ─────────────────────────────────────────────────────────────
// 4. Orphaned Flows
// ─────────────────────────────────────────────────────────────

export function checkOrphanedFlows(state: CatalogState): HealthCheckResult {
	const items: HealthCheckItem[] = [];

	// Pre-compute lookup Sets for O(1) membership tests (TD-75)
	const systemDomains = new Set(state.systemEntries.flatMap((s) => s.domains));
	const systemServices = new Set(state.systemEntries.flatMap((s) => s.services));
	const actorEvents = new Set(state.actorEntries.flatMap((a) => a.events));
	const productEvents = new Set(state.productEntries.flatMap((p) => p.events));

	for (const f of state.flowEntries) {
		const referencedBySystem =
			f.domains.some((d) => systemDomains.has(d)) ||
			f.services.some((sv) => systemServices.has(sv));
		const referencedByActor = f.events.some((e) => actorEvents.has(e));
		const referencedByProduct = f.events.some((e) => productEvents.has(e));
		if (!referencedBySystem && !referencedByActor && !referencedByProduct) {
			items.push({
				name: f.name,
				reason: "Not referenced by any system, actor, or product",
				entityType: "flow",
			});
		}
	}

	const total = state.flowEntries.length;
	const connected = total - items.length;
	const score = total > 0 ? connected / total : 1;

	return {
		id: "orphaned-flows",
		title: "Orphaned Flows",
		category: "references",
		severity: score >= 0.8 ? "pass" : score >= 0.5 ? "warn" : "fail",
		score,
		summary:
			items.length === 0
				? "All flows are cross-referenced"
				: `${items.length} flow${items.length === 1 ? "" : "s"} not referenced by any higher-level entity`,
		items,
	};
}

// ─────────────────────────────────────────────────────────────
// 5. Event Coverage
// ─────────────────────────────────────────────────────────────

export function checkEventCoverage(
	state: CatalogState,
	allEvents: EventCatalogEntry[],
): HealthCheckResult {
	const items: HealthCheckItem[] = [];

	const events = state.showSystemEvents
		? allEvents
		: allEvents.filter((e) => !e.tags.includes("system"));

	for (const evt of events) {
		const hasSub = state.subscriptions.some((s) => s.eventType === evt.type);
		const hasDef = state.definitions.some((d) => d.sourceEventType === evt.type);
		if (!hasSub && !hasDef) {
			items.push({
				name: evt.type,
				reason: "No subscription or definition configured",
				entityType: "event",
			});
		}
	}

	const total = events.length;
	const covered = total - items.length;
	const score = total > 0 ? covered / total : 1;

	return {
		id: "event-coverage",
		title: "Event Coverage",
		category: "coverage",
		severity: score >= 0.5 ? "pass" : score >= 0.2 ? "warn" : "fail",
		score,
		summary: `${covered} / ${total} events have subscriptions or definitions`,
		items,
	};
}

// ─────────────────────────────────────────────────────────────
// 6. Subscription & Definition Health
// ─────────────────────────────────────────────────────────────

export function checkSubscriptionHealth(
	state: CatalogState,
	allEvents: EventCatalogEntry[],
): HealthCheckResult {
	const items: HealthCheckItem[] = [];
	const eventTypes = new Set(allEvents.map((e) => e.type));

	for (const sub of state.subscriptions) {
		if (!eventTypes.has(sub.eventType)) {
			items.push({
				name: sub.label || sub.eventType,
				reason: `Watches unknown event type: ${sub.eventType}`,
				entityType: "subscription",
			});
		}
	}

	for (const def of state.definitions) {
		if (!eventTypes.has(def.sourceEventType)) {
			items.push({
				name: def.domainEventName,
				reason: `Source event type not in catalog: ${def.sourceEventType}`,
				entityType: "definition",
			});
		}
	}

	const total = state.subscriptions.length + state.definitions.length;
	const healthy = total - items.length;
	const score = total > 0 ? healthy / total : 1;

	return {
		id: "subscription-health",
		title: "Subscription & Definition Health",
		category: "coverage",
		severity: items.length === 0 ? "pass" : "warn",
		score,
		summary:
			items.length === 0
				? "All subscriptions and definitions reference valid events"
				: `${items.length} orphaned subscription${items.length === 1 ? "" : "s"} or definition${items.length === 1 ? "" : "s"}`,
		items,
	};
}

// ─────────────────────────────────────────────────────────────
// Aggregate
// ─────────────────────────────────────────────────────────────

export function runHealthChecks(
	state: CatalogState,
	allEvents: EventCatalogEntry[],
): HealthReport {
	const checks = [
		checkDocCoverage(state),
		checkFrontmatterCompleteness(state),
		checkReferenceIntegrity(state, allEvents),
		checkOrphanedFlows(state),
		checkEventCoverage(state, allEvents),
		checkSubscriptionHealth(state, allEvents),
	];

	const overallScore =
		checks.length > 0
			? Math.round(
					(checks.reduce((sum, c) => sum + c.score, 0) / checks.length) * 100,
				)
			: 100;

	return { overallScore, checks };
}
