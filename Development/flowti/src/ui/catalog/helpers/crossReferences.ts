/**
 * Cross-reference helpers for finding related entities
 * across flows, systems, actors, and products.
 */

import type {
	FlowEntry,
	SystemEntry,
	ActorEntry,
	ProductEntry,
} from "../types";

export interface RelatedCriteria {
	events?: string[];
	domains?: string[];
	services?: string[];
}

export function findRelatedFlows(flowEntries: FlowEntry[], criteria: RelatedCriteria): FlowEntry[] {
	return flowEntries.filter((f) => {
		if (criteria.events?.length && f.events.some((e) => criteria.events!.includes(e))) return true;
		if (criteria.domains?.length && f.domains.some((d) => criteria.domains!.includes(d))) return true;
		if (criteria.services?.length && f.services.some((s) => criteria.services!.includes(s))) return true;
		return false;
	});
}

export function findRelatedSystems(systemEntries: SystemEntry[], criteria: RelatedCriteria): SystemEntry[] {
	return systemEntries.filter((s) => {
		if (criteria.events?.length && s.events.some((e) => criteria.events!.includes(e.type))) return true;
		if (criteria.domains?.length && s.domains.some((d) => criteria.domains!.includes(d))) return true;
		if (criteria.services?.length && s.services.some((sv) => criteria.services!.includes(sv))) return true;
		return false;
	});
}

export function findRelatedActors(actorEntries: ActorEntry[], criteria: RelatedCriteria): ActorEntry[] {
	return actorEntries.filter((a) => {
		if (criteria.events?.length && a.events.some((e) => criteria.events!.includes(e))) return true;
		if (criteria.domains?.length && a.domains.some((d) => criteria.domains!.includes(d))) return true;
		if (criteria.services?.length && a.services.some((s) => criteria.services!.includes(s))) return true;
		return false;
	});
}

export function findRelatedProducts(productEntries: ProductEntry[], criteria: RelatedCriteria): ProductEntry[] {
	return productEntries.filter((p) => {
		if (criteria.events?.length && p.events.some((e) => criteria.events!.includes(e))) return true;
		if (criteria.domains?.length && p.domains.some((d) => criteria.domains!.includes(d))) return true;
		if (criteria.services?.length && p.services.some((s) => criteria.services!.includes(s))) return true;
		return false;
	});
}
