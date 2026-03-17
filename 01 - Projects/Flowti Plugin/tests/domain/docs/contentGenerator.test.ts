import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { EventCatalogEntry } from "../../../src/infrastructure/events/catalog";
import {
	generateEventDocContent,
	generateDomainDocContent,
	generateArchitectureDocContent,
	generateServiceDocContent,
	generateServiceBlueprintContent,
	generateCategoryDocContent,
	generateSystemDocContent,
	generateFlowDocContent,
	generateActorDocContent,
	generateProductDocContent,
} from "../../../src/domain/docs/contentGenerator";

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<EventCatalogEntry> = {}): EventCatalogEntry {
	return {
		type: "test.event",
		category: "Test",
		description: "Test event description",
		direction: "outbound",
		domain: "testing",
		services: "TestService",
		stability: "stable",
		visibility: "user-facing",
		tags: [],
		...overrides,
	};
}

/** Freeze Date.now so `created` timestamps are deterministic. */
const FIXED_ISO = "2026-02-15T12:00:00.000Z";

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date(FIXED_ISO));
});

afterEach(() => {
	vi.useRealTimers();
});

// ─────────────────────────────────────────────────────────────
// generateEventDocContent
// ─────────────────────────────────────────────────────────────

describe("generateEventDocContent", () => {
	it("contains EventDoc type in frontmatter", () => {
		const content = generateEventDocContent(makeEntry());
		expect(content).toContain('type: EventDoc');
	});

	it("contains the event type in frontmatter and H1", () => {
		const content = generateEventDocContent(makeEntry({ type: "user.created" }));
		expect(content).toContain('event: "user.created"');
		expect(content).toContain("# user.created");
	});

	it("contains created timestamp in ISO format", () => {
		const content = generateEventDocContent(makeEntry());
		expect(content).toContain(`created: "${FIXED_ISO}"`);
	});

	it("contains all metadata fields in frontmatter", () => {
		const entry = makeEntry({
			category: "Lifecycle",
			direction: "inbound",
			domain: "core",
			services: "CoreService",
			stability: "experimental",
			visibility: "system-internal",
		});
		const content = generateEventDocContent(entry);
		expect(content).toContain('category: "Lifecycle"');
		expect(content).toContain('direction: "inbound"');
		expect(content).toContain('domain: "core"');
		expect(content).toContain('services: "CoreService"');
		expect(content).toContain('stability: "experimental"');
		expect(content).toContain('visibility: "system-internal"');
	});

	it("contains property table with correct values", () => {
		const content = generateEventDocContent(makeEntry({ category: "Settings", stability: "stable" }));
		expect(content).toContain("| **Category**   | Settings");
		expect(content).toContain("| **Stability**  | stable");
	});

	it("contains all body sections", () => {
		const content = generateEventDocContent(makeEntry());
		expect(content).toContain("## Description");
		expect(content).toContain("## When This Event Occurs");
		expect(content).toContain("## Why This Event Matters");
		expect(content).toContain("## Typical Use Cases");
		expect(content).toContain("## Payload Overview");
		expect(content).toContain("## Subscription Guidance");
		expect(content).toContain("## Related Events");
		expect(content).toContain("## Related Domains & Services");
		expect(content).toContain("## Operational Notes");
	});

	it("includes description text in body", () => {
		const content = generateEventDocContent(makeEntry({ description: "Fires when a user logs in" }));
		expect(content).toContain("Fires when a user logs in");
	});
});

// ─────────────────────────────────────────────────────────────
// generateDomainDocContent
// ─────────────────────────────────────────────────────────────

describe("generateDomainDocContent", () => {
	it("contains DomainDoc type in frontmatter", () => {
		const content = generateDomainDocContent("Auth", [makeEntry()]);
		expect(content).toContain("type: DomainDoc");
	});

	it("contains domain name in frontmatter and H1", () => {
		const content = generateDomainDocContent("Auth", [makeEntry()]);
		expect(content).toContain('domain: "Auth"');
		expect(content).toContain("# Auth");
	});

	it("contains created timestamp", () => {
		const content = generateDomainDocContent("Auth", [makeEntry()]);
		expect(content).toContain(`created: "${FIXED_ISO}"`);
	});

	it("contains correct eventCount", () => {
		const events = [makeEntry({ type: "a" }), makeEntry({ type: "b" })];
		const content = generateDomainDocContent("Auth", events);
		expect(content).toContain("eventCount: 2");
	});

	it("deduplicates categories and services arrays", () => {
		const events = [
			makeEntry({ category: "Alpha", services: "SvcA" }),
			makeEntry({ category: "Alpha", services: "SvcA" }),
			makeEntry({ category: "Beta", services: "SvcB" }),
		];
		const content = generateDomainDocContent("Auth", events);
		// Should have exactly two category entries, sorted
		expect(content).toContain('  - "Alpha"');
		expect(content).toContain('  - "Beta"');
		expect(content).toContain('  - "SvcA"');
		expect(content).toContain('  - "SvcB"');
	});

	it("lists events in body", () => {
		const events = [makeEntry({ type: "auth.login", description: "User logged in" })];
		const content = generateDomainDocContent("Auth", events);
		expect(content).toContain("`auth.login` — User logged in");
	});

	it("handles empty events array", () => {
		const content = generateDomainDocContent("Empty", []);
		expect(content).toContain("eventCount: 0");
		expect(content).toContain("# Empty");
	});
});

// ─────────────────────────────────────────────────────────────
// generateArchitectureDocContent
// ─────────────────────────────────────────────────────────────

describe("generateArchitectureDocContent", () => {
	it("contains ArchitectureDoc type in frontmatter", () => {
		const content = generateArchitectureDocContent("Core", [makeEntry()]);
		expect(content).toContain("type: ArchitectureDoc");
	});

	it("contains domain name in frontmatter and H1", () => {
		const content = generateArchitectureDocContent("Core", [makeEntry()]);
		expect(content).toContain('domain: "Core"');
		expect(content).toContain("# Core — Architecture");
	});

	it("contains created timestamp", () => {
		const content = generateArchitectureDocContent("Core", [makeEntry()]);
		expect(content).toContain(`created: "${FIXED_ISO}"`);
	});

	it("contains Arc42 section headings", () => {
		const content = generateArchitectureDocContent("Core", [makeEntry()]);
		expect(content).toContain("## 1. Introduction & Goals");
		expect(content).toContain("## 2. Constraints");
		expect(content).toContain("## 3. Context & Scope (C4 — Context)");
		expect(content).toContain("## 4. Solution Strategy");
		expect(content).toContain("## 5. Building Block View (C4 — Container / Component)");
		expect(content).toContain("## 6. Runtime View");
		expect(content).toContain("## 7. Deployment View");
		expect(content).toContain("## 8. Cross-cutting Concepts");
		expect(content).toContain("## 9. Architecture Decisions");
		expect(content).toContain("## 10. Quality Requirements");
		expect(content).toContain("## 11. Risks & Technical Debt");
	});

	it("contains mermaid diagrams", () => {
		const content = generateArchitectureDocContent("Core", [makeEntry()]);
		expect(content).toContain("```mermaid");
		expect(content).toContain("sequenceDiagram");
		expect(content).toContain("graph LR");
		expect(content).toContain("graph TB");
	});

	it("uses safeId to strip non-alphanumeric characters in mermaid IDs", () => {
		const content = generateArchitectureDocContent("My Domain!", [
			makeEntry({ services: "My Service?" }),
		]);
		// safeId("My Domain!") => "MyDomain"
		// safeId("My Service?") => "MyService"
		expect(content).toContain("MyDomain[My Domain!]");
		expect(content).toContain("MyService[My Service?]");
	});

	it("deduplicates categories and services", () => {
		const events = [
			makeEntry({ category: "Cat1", services: "Svc1" }),
			makeEntry({ category: "Cat1", services: "Svc2" }),
			makeEntry({ category: "Cat2", services: "Svc1" }),
		];
		const content = generateArchitectureDocContent("Multi", events);
		expect(content).toContain("eventCount: 3");
		// Sorted unique categories
		expect(content).toContain('  - "Cat1"');
		expect(content).toContain('  - "Cat2"');
		// Sorted unique services
		expect(content).toContain('  - "Svc1"');
		expect(content).toContain('  - "Svc2"');
	});

	it("limits key event flows to first 10 events", () => {
		const events = Array.from({ length: 15 }, (_, i) =>
			makeEntry({ type: `event.${i}`, description: `Event ${i}` }),
		);
		const content = generateArchitectureDocContent("Big", events);
		// events 0-9 should be present under Key Event Flows
		expect(content).toContain("`event.9`");
		// Event 10 should still appear in the Events Reference at the bottom
		expect(content).toContain("`event.10`");
	});

	it("handles empty events array", () => {
		const content = generateArchitectureDocContent("Bare", []);
		expect(content).toContain("eventCount: 0");
		expect(content).toContain("# Bare — Architecture");
	});
});

// ─────────────────────────────────────────────────────────────
// generateServiceDocContent
// ─────────────────────────────────────────────────────────────

describe("generateServiceDocContent", () => {
	it("contains ServiceDoc type in frontmatter", () => {
		const content = generateServiceDocContent("AuthService", [makeEntry()]);
		expect(content).toContain("type: ServiceDoc");
	});

	it("contains service name in frontmatter and H1", () => {
		const content = generateServiceDocContent("AuthService", [makeEntry()]);
		expect(content).toContain('service: "AuthService"');
		expect(content).toContain("# AuthService");
	});

	it("contains created timestamp", () => {
		const content = generateServiceDocContent("Svc", [makeEntry()]);
		expect(content).toContain(`created: "${FIXED_ISO}"`);
	});

	it("deduplicates domains from events", () => {
		const events = [
			makeEntry({ domain: "auth" }),
			makeEntry({ domain: "auth" }),
			makeEntry({ domain: "billing" }),
		];
		const content = generateServiceDocContent("BillingService", events);
		expect(content).toContain('  - "auth"');
		expect(content).toContain('  - "billing"');
	});

	it("lists events in body", () => {
		const events = [makeEntry({ type: "svc.start", description: "Service started" })];
		const content = generateServiceDocContent("MyService", events);
		expect(content).toContain("`svc.start` — Service started");
	});

	it("handles empty events array", () => {
		const content = generateServiceDocContent("EmptyService", []);
		expect(content).toContain("eventCount: 0");
	});
});

// ─────────────────────────────────────────────────────────────
// generateServiceBlueprintContent
// ─────────────────────────────────────────────────────────────

describe("generateServiceBlueprintContent", () => {
	it("contains ServiceBlueprintDoc type in frontmatter", () => {
		const content = generateServiceBlueprintContent("PaymentService", [makeEntry()]);
		expect(content).toContain("type: ServiceBlueprintDoc");
	});

	it("contains service name in frontmatter and H1", () => {
		const content = generateServiceBlueprintContent("PaymentService", [makeEntry()]);
		expect(content).toContain('service: "PaymentService"');
		expect(content).toContain("# PaymentService — Service Blueprint");
	});

	it("contains created timestamp", () => {
		const content = generateServiceBlueprintContent("Svc", [makeEntry()]);
		expect(content).toContain(`created: "${FIXED_ISO}"`);
	});

	it("contains service blueprint sections", () => {
		const content = generateServiceBlueprintContent("Svc", [makeEntry()]);
		expect(content).toContain("## 1. Overview");
		expect(content).toContain("## 2. User Interactions");
		expect(content).toContain("## 3. Technical Details");
		expect(content).toContain("## 4. Operational Concerns");
		expect(content).toContain("## 5. Architecture Notes");
	});

	it("contains mermaid diagrams", () => {
		const content = generateServiceBlueprintContent("Svc", [makeEntry()]);
		expect(content).toContain("```mermaid");
		expect(content).toContain("journey");
		expect(content).toContain("graph LR");
	});

	it("uses safeId for mermaid identifiers", () => {
		const content = generateServiceBlueprintContent("My Service!", [makeEntry()]);
		// safeId("My Service!") => "MyService"
		expect(content).toContain("MyService[My Service!]");
	});

	it("includes event direction in events list", () => {
		const events = [makeEntry({ type: "pay.charge", direction: "inbound", description: "Charge card" })];
		const content = generateServiceBlueprintContent("PayService", events);
		expect(content).toContain("`pay.charge` (inbound) — Charge card");
	});

	it("deduplicates domains", () => {
		const events = [
			makeEntry({ domain: "payments" }),
			makeEntry({ domain: "payments" }),
			makeEntry({ domain: "orders" }),
		];
		const content = generateServiceBlueprintContent("OrderService", events);
		expect(content).toContain('  - "orders"');
		expect(content).toContain('  - "payments"');
	});

	it("handles empty events array", () => {
		const content = generateServiceBlueprintContent("EmptySvc", []);
		expect(content).toContain("eventCount: 0");
	});
});

// ─────────────────────────────────────────────────────────────
// generateCategoryDocContent
// ─────────────────────────────────────────────────────────────

describe("generateCategoryDocContent", () => {
	it("contains CategoryDoc type in frontmatter", () => {
		const content = generateCategoryDocContent("Lifecycle", [makeEntry()]);
		expect(content).toContain("type: CategoryDoc");
	});

	it("contains category name in frontmatter and H1", () => {
		const content = generateCategoryDocContent("Lifecycle", [makeEntry()]);
		expect(content).toContain('category: "Lifecycle"');
		expect(content).toContain("# Lifecycle");
	});

	it("contains created timestamp", () => {
		const content = generateCategoryDocContent("Cat", [makeEntry()]);
		expect(content).toContain(`created: "${FIXED_ISO}"`);
	});

	it("deduplicates domains and services", () => {
		const events = [
			makeEntry({ domain: "auth", services: "AuthSvc" }),
			makeEntry({ domain: "auth", services: "UserSvc" }),
			makeEntry({ domain: "billing", services: "AuthSvc" }),
		];
		const content = generateCategoryDocContent("Mixed", events);
		expect(content).toContain('  - "auth"');
		expect(content).toContain('  - "billing"');
		expect(content).toContain('  - "AuthSvc"');
		expect(content).toContain('  - "UserSvc"');
	});

	it("lists events in body", () => {
		const events = [makeEntry({ type: "cat.fire", description: "Category fired" })];
		const content = generateCategoryDocContent("Events", events);
		expect(content).toContain("`cat.fire` — Category fired");
	});

	it("handles empty events array", () => {
		const content = generateCategoryDocContent("EmptyCat", []);
		expect(content).toContain("eventCount: 0");
		expect(content).toContain("# EmptyCat");
	});
});

// ─────────────────────────────────────────────────────────────
// generateSystemDocContent
// ─────────────────────────────────────────────────────────────

describe("generateSystemDocContent", () => {
	it("contains SystemDoc type in frontmatter", () => {
		const content = generateSystemDocContent("Billing System");
		expect(content).toContain("type: SystemDoc");
	});

	it("contains system name in frontmatter and H1", () => {
		const content = generateSystemDocContent("Billing System");
		expect(content).toContain('system: "Billing System"');
		expect(content).toContain("# Billing System");
	});

	it("contains created timestamp", () => {
		const content = generateSystemDocContent("Sys");
		expect(content).toContain(`created: "${FIXED_ISO}"`);
	});

	it("contains empty defaults for description, domains, services", () => {
		const content = generateSystemDocContent("Sys");
		expect(content).toContain('description: ""');
		expect(content).toContain("domains: []");
		expect(content).toContain("services: []");
	});

	it("handles special characters in name", () => {
		const content = generateSystemDocContent("My System (v2) & More");
		expect(content).toContain('system: "My System (v2) & More"');
		expect(content).toContain("# My System (v2) & More");
	});
});

// ─────────────────────────────────────────────────────────────
// generateFlowDocContent
// ─────────────────────────────────────────────────────────────

describe("generateFlowDocContent", () => {
	it("contains FlowDoc type in frontmatter", () => {
		const content = generateFlowDocContent("User Registration");
		expect(content).toContain("type: FlowDoc");
	});

	it("contains flow name in frontmatter and H1", () => {
		const content = generateFlowDocContent("User Registration");
		expect(content).toContain('flow: "User Registration"');
		expect(content).toContain("# User Registration");
	});

	it("contains created timestamp", () => {
		const content = generateFlowDocContent("Flow");
		expect(content).toContain(`created: "${FIXED_ISO}"`);
	});

	it("contains empty defaults for description, events, domains, services", () => {
		const content = generateFlowDocContent("Flow");
		expect(content).toContain('description: ""');
		expect(content).toContain("events: []");
		expect(content).toContain("domains: []");
		expect(content).toContain("services: []");
	});

	it("handles special characters in name", () => {
		const content = generateFlowDocContent("Checkout Flow #1");
		expect(content).toContain('flow: "Checkout Flow #1"');
		expect(content).toContain("# Checkout Flow #1");
	});
});

// ─────────────────────────────────────────────────────────────
// generateActorDocContent
// ─────────────────────────────────────────────────────────────

describe("generateActorDocContent", () => {
	it("contains ActorDoc type in frontmatter", () => {
		const content = generateActorDocContent("Admin User");
		expect(content).toContain("type: ActorDoc");
	});

	it("contains actor name in frontmatter and H1", () => {
		const content = generateActorDocContent("Admin User");
		expect(content).toContain('actor: "Admin User"');
		expect(content).toContain("# Admin User");
	});

	it("contains created timestamp", () => {
		const content = generateActorDocContent("Actor");
		expect(content).toContain(`created: "${FIXED_ISO}"`);
	});

	it("contains empty defaults for description, events, domains, services", () => {
		const content = generateActorDocContent("Actor");
		expect(content).toContain('description: ""');
		expect(content).toContain("events: []");
		expect(content).toContain("domains: []");
		expect(content).toContain("services: []");
	});

	it("contains actor-specific body sections", () => {
		const content = generateActorDocContent("Developer");
		expect(content).toContain("## Overview");
		expect(content).toContain("## Goals & Needs");
		expect(content).toContain("## Key Events");
		expect(content).toContain("## Domains");
		expect(content).toContain("## Services");
		expect(content).toContain("## Notes");
	});
});

// ─────────────────────────────────────────────────────────────
// generateProductDocContent
// ─────────────────────────────────────────────────────────────

describe("generateProductDocContent", () => {
	it("contains ProductDoc type in frontmatter", () => {
		const content = generateProductDocContent("Dashboard App");
		expect(content).toContain("type: ProductDoc");
	});

	it("contains product name in frontmatter and H1", () => {
		const content = generateProductDocContent("Dashboard App");
		expect(content).toContain('product: "Dashboard App"');
		expect(content).toContain("# Dashboard App");
	});

	it("contains created timestamp", () => {
		const content = generateProductDocContent("Prod");
		expect(content).toContain(`created: "${FIXED_ISO}"`);
	});

	it("contains empty defaults for description, events, domains, services", () => {
		const content = generateProductDocContent("Prod");
		expect(content).toContain('description: ""');
		expect(content).toContain("events: []");
		expect(content).toContain("domains: []");
		expect(content).toContain("services: []");
	});

	it("handles special characters in name", () => {
		const content = generateProductDocContent("Product <Beta> v2.0");
		expect(content).toContain('product: "Product <Beta> v2.0"');
		expect(content).toContain("# Product <Beta> v2.0");
	});
});
