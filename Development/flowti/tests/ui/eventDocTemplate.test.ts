import { describe, it, expect } from "vitest";
import {
	getEventDocPath,
	generateEventDocContent,
	getDomainsFolderPath,
	getServicesFolderPath,
	getCategoriesFolderPath,
	getSystemDocPath,
	getSystemsFolderPath,
	generateSystemDocContent,
	getFlowDocPath,
	getFlowsFolderPath,
	generateFlowDocContent,
	getActorDocPath,
	getActorsFolderPath,
	generateActorDocContent,
	resolveEntityPath,
	getEventDocPathResolved,
	getDomainDocPathResolved,
	getArchitectureDocPathResolved,
	getServiceDocPathResolved,
	getServiceBlueprintPathResolved,
	getCategoryDocPathResolved,
	getFlowDocPathResolved,
	getSystemDocPathResolved,
	getActorDocPathResolved,
} from "../../src/ui/eventDocTemplate";
import type { EventCatalogEntry } from "../../src/infrastructure/events/catalog";

describe("eventDocTemplate", () => {
	describe("getEventDocPath", () => {
		it("should combine root path with Events subfolder and event type", () => {
			const result = getEventDocPath("docs", "plugin.loading");
			expect(result).toBe("docs/Events/plugin.loading.md");
		});

		it("should trim trailing slashes from base path", () => {
			const result = getEventDocPath("docs/", "plugin.loading");
			expect(result).toBe("docs/Events/plugin.loading.md");
		});

		it("should handle the default base path", () => {
			const result = getEventDocPath(
				"03 - Resources/Documentation/Reference",
				"file.create.request"
			);
			expect(result).toBe(
				"03 - Resources/Documentation/Reference/Events/file.create.request.md"
			);
		});
	});

	describe("generateEventDocContent", () => {
		const entry: EventCatalogEntry = {
			type: "plugin.loading",
			category: "Plugin Lifecycle",
			description: "Plugin starts loading",
			direction: "Plugin \u2192 Listeners",
			domain: "infrastructure",
			services: "Plugin",
			stability: "stable",
			visibility: "system-internal",
			tags: ["system"],
		};

		it("should include YAML frontmatter with type EventDoc", () => {
			const content = generateEventDocContent(entry);
			expect(content).toContain("type: EventDoc");
		});

		it("should include the event type in frontmatter", () => {
			const content = generateEventDocContent(entry);
			expect(content).toContain('event: "plugin.loading"');
		});

		it("should include stability and visibility in frontmatter", () => {
			const content = generateEventDocContent(entry);
			expect(content).toContain('stability: "stable"');
			expect(content).toContain('visibility: "system-internal"');
		});

		it("should include the event type as heading", () => {
			const content = generateEventDocContent(entry);
			expect(content).toContain("# plugin.loading");
		});

		it("should include the description in the Description section", () => {
			const content = generateEventDocContent(entry);
			expect(content).toContain("## Description");
			expect(content).toContain("Plugin starts loading");
		});

		it("should include category and direction in header table", () => {
			const content = generateEventDocContent(entry);
			expect(content).toContain("Plugin Lifecycle");
			expect(content).toContain("Plugin \u2192 Listeners");
		});

		it("should include domain and service in frontmatter", () => {
			const content = generateEventDocContent(entry);
			expect(content).toContain('domain: "infrastructure"');
			expect(content).toContain('services: "Plugin"');
		});

		it("should include stability and visibility in header table", () => {
			const content = generateEventDocContent(entry);
			expect(content).toContain("| **Stability**");
			expect(content).toContain("| **Visibility**");
		});

		it("should include all 9 body sections", () => {
			const content = generateEventDocContent(entry);
			const expectedSections = [
				"## Description",
				"## When This Event Occurs",
				"## Why This Event Matters",
				"## Typical Use Cases",
				"## Payload Overview",
				"## Subscription Guidance",
				"## Related Events",
				"## Related Domains & Services",
				"## Operational Notes",
			];
			for (const section of expectedSections) {
				expect(content).toContain(section);
			}
		});

		it("should include a payload field table scaffold", () => {
			const content = generateEventDocContent(entry);
			expect(content).toContain("| Field | Type | Description |");
		});

		it("should include domain and services in Related Domains table", () => {
			const content = generateEventDocContent(entry);
			expect(content).toContain("| **Domain**");
			expect(content).toContain("infrastructure");
			expect(content).toContain("| **Services**");
		});

		it("should include placeholder prompts as blockquotes", () => {
			const content = generateEventDocContent(entry);
			expect(content).toContain("> Describe the situations");
			expect(content).toContain("> Explain what decision");
			expect(content).toContain("> List concrete");
		});

		it("should use experimental stability for custom events", () => {
			const custom: EventCatalogEntry = {
				...entry,
				type: "custom.test",
				stability: "experimental",
				visibility: "user-facing",
			};
			const content = generateEventDocContent(custom);
			expect(content).toContain('stability: "experimental"');
			expect(content).toContain('visibility: "user-facing"');
		});
	});

	describe("getDomainsFolderPath", () => {
		it("should return Domains subfolder path", () => {
			const result = getDomainsFolderPath("docs");
			expect(result).toBe("docs/Domains");
		});

		it("should trim trailing slashes", () => {
			const result = getDomainsFolderPath("docs/");
			expect(result).toBe("docs/Domains");
		});
	});

	describe("getServicesFolderPath", () => {
		it("should return Services subfolder path", () => {
			const result = getServicesFolderPath("docs");
			expect(result).toBe("docs/Services");
		});

		it("should trim trailing slashes", () => {
			const result = getServicesFolderPath("docs/");
			expect(result).toBe("docs/Services");
		});
	});

	describe("getCategoriesFolderPath", () => {
		it("should return Categories subfolder path", () => {
			const result = getCategoriesFolderPath("docs");
			expect(result).toBe("docs/Categories");
		});

		it("should trim trailing slashes", () => {
			const result = getCategoriesFolderPath("docs/");
			expect(result).toBe("docs/Categories");
		});
	});

	describe("getSystemDocPath", () => {
		it("should combine root path with Systems subfolder", () => {
			const result = getSystemDocPath("docs", "Billing");
			expect(result).toBe("docs/Systems/Billing.md");
		});

		it("should trim trailing slashes", () => {
			const result = getSystemDocPath("docs/", "CRM");
			expect(result).toBe("docs/Systems/CRM.md");
		});
	});

	describe("getSystemsFolderPath", () => {
		it("should return Systems subfolder path", () => {
			const result = getSystemsFolderPath("docs");
			expect(result).toBe("docs/Systems");
		});

		it("should trim trailing slashes", () => {
			const result = getSystemsFolderPath("docs/");
			expect(result).toBe("docs/Systems");
		});
	});

	describe("generateSystemDocContent", () => {
		it("should include SystemDoc type in frontmatter", () => {
			const content = generateSystemDocContent("Billing");
			expect(content).toContain("type: SystemDoc");
		});

		it("should include system name in frontmatter", () => {
			const content = generateSystemDocContent("Billing");
			expect(content).toContain('system: "Billing"');
		});

		it("should include heading with system name", () => {
			const content = generateSystemDocContent("Billing");
			expect(content).toContain("# Billing");
		});

		it("should include overview section", () => {
			const content = generateSystemDocContent("Billing");
			expect(content).toContain("## Overview");
		});

		it("should include empty domains and services arrays", () => {
			const content = generateSystemDocContent("Billing");
			expect(content).toContain("domains: []");
			expect(content).toContain("services: []");
		});
	});

	describe("getFlowDocPath", () => {
		it("should combine root path with Flows subfolder", () => {
			const result = getFlowDocPath("docs", "Order Processing");
			expect(result).toBe("docs/Flows/Order Processing.md");
		});

		it("should trim trailing slashes", () => {
			const result = getFlowDocPath("docs/", "Checkout");
			expect(result).toBe("docs/Flows/Checkout.md");
		});
	});

	describe("getFlowsFolderPath", () => {
		it("should return Flows subfolder path", () => {
			const result = getFlowsFolderPath("docs");
			expect(result).toBe("docs/Flows");
		});

		it("should trim trailing slashes", () => {
			const result = getFlowsFolderPath("docs/");
			expect(result).toBe("docs/Flows");
		});
	});

	describe("generateFlowDocContent", () => {
		it("should include FlowDoc type in frontmatter", () => {
			const content = generateFlowDocContent("Checkout");
			expect(content).toContain("type: FlowDoc");
		});

		it("should include flow name in frontmatter", () => {
			const content = generateFlowDocContent("Checkout");
			expect(content).toContain('flow: "Checkout"');
		});

		it("should include heading with flow name", () => {
			const content = generateFlowDocContent("Checkout");
			expect(content).toContain("# Checkout");
		});

		it("should include overview section", () => {
			const content = generateFlowDocContent("Checkout");
			expect(content).toContain("## Overview");
		});

		it("should include empty events, domains and services arrays", () => {
			const content = generateFlowDocContent("Checkout");
			expect(content).toContain("events: []");
			expect(content).toContain("domains: []");
			expect(content).toContain("services: []");
		});
	});

	describe("getActorDocPath", () => {
		it("should combine root path with Actors subfolder", () => {
			const result = getActorDocPath("docs", "Admin");
			expect(result).toBe("docs/Actors/Admin.md");
		});

		it("should trim trailing slashes", () => {
			const result = getActorDocPath("docs/", "Developer");
			expect(result).toBe("docs/Actors/Developer.md");
		});
	});

	describe("getActorsFolderPath", () => {
		it("should return Actors subfolder path", () => {
			const result = getActorsFolderPath("docs");
			expect(result).toBe("docs/Actors");
		});

		it("should trim trailing slashes", () => {
			const result = getActorsFolderPath("docs/");
			expect(result).toBe("docs/Actors");
		});
	});

	describe("generateActorDocContent", () => {
		it("should include ActorDoc type in frontmatter", () => {
			const content = generateActorDocContent("Admin");
			expect(content).toContain("type: ActorDoc");
		});

		it("should include actor name in frontmatter", () => {
			const content = generateActorDocContent("Admin");
			expect(content).toContain('actor: "Admin"');
		});

		it("should include heading with actor name", () => {
			const content = generateActorDocContent("Admin");
			expect(content).toContain("# Admin");
		});

		it("should include overview section", () => {
			const content = generateActorDocContent("Admin");
			expect(content).toContain("## Overview");
		});

		it("should include empty events, domains and services arrays", () => {
			const content = generateActorDocContent("Admin");
			expect(content).toContain("events: []");
			expect(content).toContain("domains: []");
			expect(content).toContain("services: []");
		});
	});

	describe("resolveEntityPath", () => {
		it("should use docsRootPath + subfolder when overridePath is empty", () => {
			expect(resolveEntityPath("docs/root", { subfolder: "Events", overridePath: "" }))
				.toBe("docs/root/Events");
		});

		it("should use overridePath when set", () => {
			expect(resolveEntityPath("docs/root", { subfolder: "Events", overridePath: "my/custom/events" }))
				.toBe("my/custom/events");
		});

		it("should trim trailing slashes from override", () => {
			expect(resolveEntityPath("docs/root", { subfolder: "Events", overridePath: "my/path/" }))
				.toBe("my/path");
		});

		it("should trim trailing slashes from root path", () => {
			expect(resolveEntityPath("docs/root/", { subfolder: "Events", overridePath: "" }))
				.toBe("docs/root/Events");
		});

		it("should ignore whitespace-only overridePath", () => {
			expect(resolveEntityPath("docs/root", { subfolder: "Events", overridePath: "   " }))
				.toBe("docs/root/Events");
		});
	});

	describe("resolved path functions", () => {
		it("getEventDocPathResolved", () => {
			expect(getEventDocPathResolved("my/events", "plugin.loading")).toBe("my/events/plugin.loading.md");
		});

		it("getDomainDocPathResolved", () => {
			expect(getDomainDocPathResolved("my/domains", "Core")).toBe("my/domains/Core.md");
		});

		it("getArchitectureDocPathResolved", () => {
			expect(getArchitectureDocPathResolved("my/domains", "Core")).toBe("my/domains/Core.architecture.md");
		});

		it("getServiceDocPathResolved", () => {
			expect(getServiceDocPathResolved("my/services", "Auth")).toBe("my/services/Auth.md");
		});

		it("getServiceBlueprintPathResolved", () => {
			expect(getServiceBlueprintPathResolved("my/services", "Auth")).toBe("my/services/Auth.blueprint.md");
		});

		it("getCategoryDocPathResolved", () => {
			expect(getCategoryDocPathResolved("my/categories", "Core")).toBe("my/categories/Core.md");
		});

		it("getFlowDocPathResolved", () => {
			expect(getFlowDocPathResolved("my/flows", "Checkout")).toBe("my/flows/Checkout.md");
		});

		it("getSystemDocPathResolved", () => {
			expect(getSystemDocPathResolved("my/systems", "Billing")).toBe("my/systems/Billing.md");
		});

		it("getActorDocPathResolved", () => {
			expect(getActorDocPathResolved("my/actors", "Admin")).toBe("my/actors/Admin.md");
		});

		it("should trim trailing slashes from folder", () => {
			expect(getEventDocPathResolved("my/events/", "test")).toBe("my/events/test.md");
		});
	});
});
