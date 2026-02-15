import { describe, it, expect } from "vitest";
import { createDefaultCatalogState } from "./testHelpers";
import {
	checkDocCoverage,
	checkFrontmatterCompleteness,
	checkReferenceIntegrity,
	checkOrphanedFlows,
	checkEventCoverage,
	checkSubscriptionHealth,
	runHealthChecks,
} from "../../../src/ui/catalog/healthChecks";
import type { EventCatalogEntry } from "../../../src/infrastructure/events/catalog";
import type {
	DomainEntry,
	ServiceEntry,
	FlowEntry,
	SystemEntry,
	ActorEntry,
	ProductEntry,
} from "../../../src/ui/catalog/types";
import type { Subscription } from "../../../src/domain/subscription/types";
import type { EventDefinition } from "../../../src/domain/eventDefinition/types";

// ── Helpers ──────────────────────────────────────────────────

function makeDomain(name: string, filePath: string | null = "docs/Domains/d.md", overrides?: Partial<DomainEntry>): DomainEntry {
	return {
		name,
		description: "",
		services: [],
		categories: [],
		events: [],
		filePath,
		configuredCount: 0,
		visibleCount: 0,
		visible: true,
		isSystem: false,
		isArea: false,
		...overrides,
	};
}

function makeService(name: string, filePath: string | null = "docs/Services/s.md", overrides?: Partial<ServiceEntry>): ServiceEntry {
	return {
		name,
		description: "",
		domains: [],
		events: [],
		filePath,
		configuredCount: 0,
		visible: true,
		isSystem: false,
		...overrides,
	};
}

function makeFlow(name: string, overrides?: Partial<FlowEntry>): FlowEntry {
	return {
		name,
		description: "",
		events: ["file.created"],
		domains: ["Core"],
		services: ["FileService"],
		filePath: "docs/Flows/f.md",
		resolvedEvents: [],
		...overrides,
	};
}

function makeSystem(name: string, overrides?: Partial<SystemEntry>): SystemEntry {
	return {
		name,
		description: "",
		domains: ["Core"],
		services: ["FileService"],
		filePath: "docs/Systems/s.md",
		events: [],
		...overrides,
	};
}

function makeActor(name: string, overrides?: Partial<ActorEntry>): ActorEntry {
	return {
		name,
		description: "",
		events: ["file.created"],
		domains: [],
		services: [],
		filePath: "docs/Actors/a.md",
		resolvedEvents: [],
		...overrides,
	};
}

function makeProduct(name: string, overrides?: Partial<ProductEntry>): ProductEntry {
	return {
		name,
		description: "",
		events: ["file.created"],
		domains: ["Core"],
		services: [],
		filePath: "docs/Products/p.md",
		resolvedEvents: [],
		...overrides,
	};
}

function makeEvent(type: string, overrides?: Partial<EventCatalogEntry>): EventCatalogEntry {
	return {
		type,
		category: "Core",
		description: "",
		direction: "internal",
		domain: "Core",
		services: "FileService",
		stability: "stable",
		visibility: "user-facing",
		tags: [],
		...overrides,
	};
}

function makeSub(eventType: string, overrides?: Partial<Subscription>): Subscription {
	return {
		id: `sub-${eventType}`,
		eventType,
		filters: {},
		enabled: true,
		createdAt: new Date().toISOString(),
		...overrides,
	};
}

function makeDef(sourceEventType: string, overrides?: Partial<EventDefinition>): EventDefinition {
	return {
		id: `def-${sourceEventType}`,
		sourceEventType,
		domainEventName: `domain.${sourceEventType}`,
		payloadMappings: [],
		emissionPolicy: "always",
		enabled: true,
		createdAt: new Date().toISOString(),
		...overrides,
	};
}

// ── Tests ────────────────────────────────────────────────────

describe("checkDocCoverage", () => {
	it("returns score 1 for empty state", () => {
		const state = createDefaultCatalogState();
		const result = checkDocCoverage(state);
		expect(result.score).toBe(1);
		expect(result.severity).toBe("pass");
		expect(result.items).toHaveLength(0);
	});

	it("returns pass when all domains and services have doc files", () => {
		const state = createDefaultCatalogState({
			domainEntries: [makeDomain("Core"), makeDomain("User")],
			serviceEntries: [makeService("FileService")],
		});
		const result = checkDocCoverage(state);
		expect(result.score).toBe(1);
		expect(result.severity).toBe("pass");
		expect(result.summary).toBe("3 / 3 entities documented");
	});

	it("flags undocumented domains and services", () => {
		const state = createDefaultCatalogState({
			domainEntries: [
				makeDomain("Core"),
				makeDomain("Orphan", null),
			],
			serviceEntries: [
				makeService("FileService", null),
			],
		});
		const result = checkDocCoverage(state);
		expect(result.score).toBeCloseTo(1 / 3);
		expect(result.severity).toBe("fail");
		expect(result.items).toHaveLength(2);
		expect(result.items[0].name).toBe("Orphan");
		expect(result.items[1].name).toBe("FileService");
	});

	it("excludes system domains when showSystemEvents is false", () => {
		const state = createDefaultCatalogState({
			showSystemEvents: false,
			domainEntries: [
				makeDomain("Core"),
				makeDomain("Infrastructure", null, { isSystem: true }),
			],
		});
		const result = checkDocCoverage(state);
		expect(result.score).toBe(1);
		expect(result.items).toHaveLength(0);
		expect(result.summary).toBe("1 / 1 entities documented");
	});

	it("includes system domains when showSystemEvents is true", () => {
		const state = createDefaultCatalogState({
			showSystemEvents: true,
			domainEntries: [
				makeDomain("Core"),
				makeDomain("Infrastructure", null, { isSystem: true }),
			],
		});
		const result = checkDocCoverage(state);
		expect(result.score).toBe(0.5);
		expect(result.items).toHaveLength(1);
	});

	it("skips invisible domains", () => {
		const state = createDefaultCatalogState({
			domainEntries: [
				makeDomain("Visible"),
				makeDomain("Hidden", null, { visible: false }),
			],
		});
		const result = checkDocCoverage(state);
		expect(result.score).toBe(1);
		expect(result.items).toHaveLength(0);
	});
});

describe("checkFrontmatterCompleteness", () => {
	it("returns score 1 for empty state", () => {
		const state = createDefaultCatalogState();
		const result = checkFrontmatterCompleteness(state);
		expect(result.score).toBe(1);
		expect(result.severity).toBe("pass");
	});

	it("passes for well-formed entities", () => {
		const state = createDefaultCatalogState({
			flowEntries: [makeFlow("Flow A")],
			systemEntries: [makeSystem("System A")],
			actorEntries: [makeActor("Actor A")],
			productEntries: [makeProduct("Product A")],
		});
		const result = checkFrontmatterCompleteness(state);
		expect(result.score).toBe(1);
		expect(result.items).toHaveLength(0);
	});

	it("flags flow with no events", () => {
		const state = createDefaultCatalogState({
			flowEntries: [makeFlow("Empty Flow", { events: [] })],
		});
		const result = checkFrontmatterCompleteness(state);
		expect(result.items.some((i) => i.name === "Empty Flow" && i.reason.includes("no events"))).toBe(true);
	});

	it("flags flow with no domains or services", () => {
		const state = createDefaultCatalogState({
			flowEntries: [makeFlow("Lonely Flow", { domains: [], services: [] })],
		});
		const result = checkFrontmatterCompleteness(state);
		expect(result.items.some((i) => i.name === "Lonely Flow" && i.reason.includes("no domains or services"))).toBe(true);
	});

	it("flags system with no domains or services", () => {
		const state = createDefaultCatalogState({
			systemEntries: [makeSystem("Empty System", { domains: [], services: [] })],
		});
		const result = checkFrontmatterCompleteness(state);
		expect(result.items.some((i) => i.name === "Empty System")).toBe(true);
	});

	it("flags actor with no events", () => {
		const state = createDefaultCatalogState({
			actorEntries: [makeActor("Silent Actor", { events: [] })],
		});
		const result = checkFrontmatterCompleteness(state);
		expect(result.items.some((i) => i.name === "Silent Actor")).toBe(true);
	});

	it("flags product with no events and no domains", () => {
		const state = createDefaultCatalogState({
			productEntries: [makeProduct("Empty Product", { events: [], domains: [] })],
		});
		const result = checkFrontmatterCompleteness(state);
		expect(result.items.some((i) => i.name === "Empty Product")).toBe(true);
	});

	it("does not flag product with domains but no events", () => {
		const state = createDefaultCatalogState({
			productEntries: [makeProduct("Domain Product", { events: [], domains: ["Core"] })],
		});
		const result = checkFrontmatterCompleteness(state);
		expect(result.items.filter((i) => i.name === "Domain Product")).toHaveLength(0);
	});

	it("counts unique problem entities for score", () => {
		const state = createDefaultCatalogState({
			flowEntries: [makeFlow("Bad Flow", { events: [], domains: [], services: [] })],
		});
		const result = checkFrontmatterCompleteness(state);
		// Two items for Bad Flow but only 1 unique problem entity
		expect(result.items.length).toBe(2);
		expect(result.score).toBe(0); // 1 problem out of 1 total
	});
});

describe("checkReferenceIntegrity", () => {
	const allEvents = [makeEvent("file.created"), makeEvent("file.modified")];

	it("returns score 1 for empty state", () => {
		const state = createDefaultCatalogState();
		const result = checkReferenceIntegrity(state, allEvents);
		expect(result.score).toBe(1);
		expect(result.severity).toBe("pass");
	});

	it("passes when all references are valid", () => {
		const state = createDefaultCatalogState({
			domainEntries: [makeDomain("Core")],
			serviceEntries: [makeService("FileService")],
			flowEntries: [makeFlow("Good Flow", {
				events: ["file.created"],
				domains: ["Core"],
				services: ["FileService"],
			})],
		});
		const result = checkReferenceIntegrity(state, allEvents);
		expect(result.severity).toBe("pass");
		expect(result.items).toHaveLength(0);
	});

	it("flags flow referencing unknown event", () => {
		const state = createDefaultCatalogState({
			domainEntries: [makeDomain("Core")],
			serviceEntries: [makeService("FileService")],
			flowEntries: [makeFlow("Bad Flow", { events: ["nonexistent.event"] })],
		});
		const result = checkReferenceIntegrity(state, allEvents);
		expect(result.items).toHaveLength(1);
		expect(result.items[0].reason).toContain("nonexistent.event");
	});

	it("flags flow referencing unknown domain", () => {
		const state = createDefaultCatalogState({
			domainEntries: [makeDomain("Core")],
			flowEntries: [makeFlow("Bad Flow", { domains: ["Nonexistent"] })],
		});
		const result = checkReferenceIntegrity(state, allEvents);
		expect(result.items.some((i) => i.reason.includes("Nonexistent"))).toBe(true);
	});

	it("flags flow referencing unknown service", () => {
		const state = createDefaultCatalogState({
			serviceEntries: [makeService("FileService")],
			flowEntries: [makeFlow("Bad Flow", { services: ["GhostService"] })],
		});
		const result = checkReferenceIntegrity(state, allEvents);
		expect(result.items.some((i) => i.reason.includes("GhostService"))).toBe(true);
	});

	it("flags system referencing unknown domain", () => {
		const state = createDefaultCatalogState({
			domainEntries: [makeDomain("Core")],
			systemEntries: [makeSystem("Bad System", { domains: ["Missing"] })],
		});
		const result = checkReferenceIntegrity(state, allEvents);
		expect(result.items.some((i) => i.name === "Bad System" && i.reason.includes("Missing"))).toBe(true);
	});

	it("flags actor referencing unknown event", () => {
		const state = createDefaultCatalogState({
			actorEntries: [makeActor("Bad Actor", { events: ["ghost.event"] })],
		});
		const result = checkReferenceIntegrity(state, allEvents);
		expect(result.items.some((i) => i.name === "Bad Actor")).toBe(true);
	});

	it("flags product referencing unknown event", () => {
		const state = createDefaultCatalogState({
			productEntries: [makeProduct("Bad Product", { events: ["ghost.event"] })],
		});
		const result = checkReferenceIntegrity(state, allEvents);
		expect(result.items.some((i) => i.name === "Bad Product")).toBe(true);
	});

	it("sets severity to warn for 1-3 broken refs", () => {
		const state = createDefaultCatalogState({
			flowEntries: [makeFlow("F", { events: ["bad1"], domains: [], services: [] })],
		});
		const result = checkReferenceIntegrity(state, allEvents);
		expect(result.severity).toBe("warn");
	});

	it("sets severity to fail for >3 broken refs", () => {
		const state = createDefaultCatalogState({
			flowEntries: [makeFlow("F", { events: ["bad1", "bad2", "bad3", "bad4"], domains: [], services: [] })],
		});
		const result = checkReferenceIntegrity(state, allEvents);
		expect(result.severity).toBe("fail");
	});
});

describe("checkOrphanedFlows", () => {
	it("returns score 1 for empty state", () => {
		const state = createDefaultCatalogState();
		const result = checkOrphanedFlows(state);
		expect(result.score).toBe(1);
		expect(result.severity).toBe("pass");
	});

	it("passes when flow is referenced by a system via domain", () => {
		const state = createDefaultCatalogState({
			flowEntries: [makeFlow("Connected Flow", { domains: ["Core"] })],
			systemEntries: [makeSystem("Sys", { domains: ["Core"] })],
		});
		const result = checkOrphanedFlows(state);
		expect(result.items).toHaveLength(0);
	});

	it("passes when flow is referenced by an actor via event", () => {
		const state = createDefaultCatalogState({
			flowEntries: [makeFlow("Connected Flow", { events: ["file.created"] })],
			actorEntries: [makeActor("Actor", { events: ["file.created"] })],
		});
		const result = checkOrphanedFlows(state);
		expect(result.items).toHaveLength(0);
	});

	it("passes when flow is referenced by a product via event", () => {
		const state = createDefaultCatalogState({
			flowEntries: [makeFlow("Connected Flow", { events: ["file.created"] })],
			productEntries: [makeProduct("Product", { events: ["file.created"] })],
		});
		const result = checkOrphanedFlows(state);
		expect(result.items).toHaveLength(0);
	});

	it("flags orphaned flow", () => {
		const state = createDefaultCatalogState({
			flowEntries: [makeFlow("Orphan", { events: ["unique.event"], domains: ["Unique"] })],
		});
		const result = checkOrphanedFlows(state);
		expect(result.items).toHaveLength(1);
		expect(result.items[0].name).toBe("Orphan");
	});

	it("handles mixed connected and orphaned flows", () => {
		const state = createDefaultCatalogState({
			flowEntries: [
				makeFlow("Connected", { domains: ["Core"] }),
				makeFlow("Orphan", { domains: ["NoMatch"], services: [], events: ["no.match"] }),
			],
			systemEntries: [makeSystem("Sys", { domains: ["Core"] })],
		});
		const result = checkOrphanedFlows(state);
		expect(result.items).toHaveLength(1);
		expect(result.score).toBe(0.5);
	});
});

describe("checkEventCoverage", () => {
	it("returns score 1 for empty events", () => {
		const state = createDefaultCatalogState();
		const result = checkEventCoverage(state, []);
		expect(result.score).toBe(1);
		expect(result.severity).toBe("pass");
	});

	it("passes when all events have subscriptions", () => {
		const events = [makeEvent("file.created")];
		const state = createDefaultCatalogState({
			subscriptions: [makeSub("file.created")],
		});
		const result = checkEventCoverage(state, events);
		expect(result.score).toBe(1);
		expect(result.items).toHaveLength(0);
	});

	it("passes when event has definition instead of subscription", () => {
		const events = [makeEvent("file.created")];
		const state = createDefaultCatalogState({
			definitions: [makeDef("file.created")],
		});
		const result = checkEventCoverage(state, events);
		expect(result.score).toBe(1);
	});

	it("flags uncovered events", () => {
		const events = [makeEvent("file.created"), makeEvent("file.modified")];
		const state = createDefaultCatalogState({
			subscriptions: [makeSub("file.created")],
		});
		const result = checkEventCoverage(state, events);
		expect(result.items).toHaveLength(1);
		expect(result.items[0].name).toBe("file.modified");
	});

	it("excludes system events when showSystemEvents is false", () => {
		const events = [
			makeEvent("file.created"),
			makeEvent("log.debug", { tags: ["system"] }),
		];
		const state = createDefaultCatalogState({ showSystemEvents: false });
		const result = checkEventCoverage(state, events);
		// Only file.created counted, log.debug excluded
		expect(result.items).toHaveLength(1);
		expect(result.items[0].name).toBe("file.created");
	});

	it("includes system events when showSystemEvents is true", () => {
		const events = [
			makeEvent("file.created"),
			makeEvent("log.debug", { tags: ["system"] }),
		];
		const state = createDefaultCatalogState({ showSystemEvents: true });
		const result = checkEventCoverage(state, events);
		expect(result.items).toHaveLength(2);
	});
});

describe("checkSubscriptionHealth", () => {
	const allEvents = [makeEvent("file.created"), makeEvent("file.modified")];

	it("returns score 1 when no subscriptions or definitions", () => {
		const state = createDefaultCatalogState();
		const result = checkSubscriptionHealth(state, allEvents);
		expect(result.score).toBe(1);
		expect(result.severity).toBe("pass");
	});

	it("passes when all subscriptions reference valid events", () => {
		const state = createDefaultCatalogState({
			subscriptions: [makeSub("file.created")],
		});
		const result = checkSubscriptionHealth(state, allEvents);
		expect(result.score).toBe(1);
		expect(result.items).toHaveLength(0);
	});

	it("flags subscription watching unknown event", () => {
		const state = createDefaultCatalogState({
			subscriptions: [makeSub("nonexistent.event")],
		});
		const result = checkSubscriptionHealth(state, allEvents);
		expect(result.items).toHaveLength(1);
		expect(result.items[0].reason).toContain("nonexistent.event");
	});

	it("flags definition with unknown source event", () => {
		const state = createDefaultCatalogState({
			definitions: [makeDef("ghost.event")],
		});
		const result = checkSubscriptionHealth(state, allEvents);
		expect(result.items).toHaveLength(1);
		expect(result.items[0].reason).toContain("ghost.event");
	});

	it("uses subscription label when available", () => {
		const state = createDefaultCatalogState({
			subscriptions: [makeSub("ghost.event", { label: "My Watcher" })],
		});
		const result = checkSubscriptionHealth(state, allEvents);
		expect(result.items[0].name).toBe("My Watcher");
	});

	it("falls back to event type when no label", () => {
		const state = createDefaultCatalogState({
			subscriptions: [makeSub("ghost.event", { label: undefined })],
		});
		const result = checkSubscriptionHealth(state, allEvents);
		expect(result.items[0].name).toBe("ghost.event");
	});
});

describe("runHealthChecks", () => {
	it("returns all 6 checks", () => {
		const state = createDefaultCatalogState();
		const report = runHealthChecks(state, []);
		expect(report.checks).toHaveLength(6);
	});

	it("returns 100 for empty state (all passing)", () => {
		const state = createDefaultCatalogState();
		const report = runHealthChecks(state, []);
		expect(report.overallScore).toBe(100);
	});

	it("computes overall score as average of check scores", () => {
		// Create state where doc coverage will fail but everything else passes
		const state = createDefaultCatalogState({
			domainEntries: [
				makeDomain("A", null),
				makeDomain("B", null),
				makeDomain("C", null),
				makeDomain("D", null),
				makeDomain("E", null),
			],
		});
		const report = runHealthChecks(state, []);
		// doc-coverage: 0/5 = 0, others: 1.0 each
		// Average: (0 + 1 + 1 + 1 + 1 + 1) / 6 ≈ 0.833
		expect(report.overallScore).toBe(83);
	});

	it("includes correct check IDs", () => {
		const state = createDefaultCatalogState();
		const report = runHealthChecks(state, []);
		const ids = report.checks.map((c) => c.id);
		expect(ids).toContain("doc-coverage");
		expect(ids).toContain("frontmatter-completeness");
		expect(ids).toContain("reference-integrity");
		expect(ids).toContain("orphaned-flows");
		expect(ids).toContain("event-coverage");
		expect(ids).toContain("subscription-health");
	});
});
