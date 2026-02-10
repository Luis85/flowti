import { describe, it, expect } from "vitest";
import {
	getEventDocPath,
	generateEventDocContent,
} from "../../src/ui/eventDocTemplate";
import type { EventCatalogEntry } from "../../src/infrastructure/events/catalog";

describe("eventDocTemplate", () => {
	describe("getEventDocPath", () => {
		it("should combine base path and event type", () => {
			const result = getEventDocPath("docs/events", "plugin.loading");
			expect(result).toBe("docs/events/plugin.loading.md");
		});

		it("should trim trailing slashes from base path", () => {
			const result = getEventDocPath("docs/events/", "plugin.loading");
			expect(result).toBe("docs/events/plugin.loading.md");
		});

		it("should handle the default base path", () => {
			const result = getEventDocPath(
				"03 - Resources/Documentation/Reference/Events",
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
			direction: "Plugin → Listeners",
			domain: "infrastructure",
			services: "Plugin",
		};

		it("should include YAML frontmatter with type EventDoc", () => {
			const content = generateEventDocContent(entry);
			expect(content).toContain("type: EventDoc");
		});

		it("should include the event type in frontmatter", () => {
			const content = generateEventDocContent(entry);
			expect(content).toContain('event: "plugin.loading"');
		});

		it("should include the event type as heading", () => {
			const content = generateEventDocContent(entry);
			expect(content).toContain("# plugin.loading");
		});

		it("should include the description", () => {
			const content = generateEventDocContent(entry);
			expect(content).toContain("Plugin starts loading");
		});

		it("should include category and direction in metadata table", () => {
			const content = generateEventDocContent(entry);
			expect(content).toContain("Plugin Lifecycle");
			expect(content).toContain("Plugin → Listeners");
		});

		it("should include domain and service in frontmatter", () => {
			const content = generateEventDocContent(entry);
			expect(content).toContain('domain: "infrastructure"');
			expect(content).toContain('services: "Plugin"');
		});

		it("should include domain and services in metadata table", () => {
			const content = generateEventDocContent(entry);
			expect(content).toContain("| **Domain**");
			expect(content).toContain("infrastructure");
			expect(content).toContain("| **Services**");
		});

		it("should include a Payload section", () => {
			const content = generateEventDocContent(entry);
			expect(content).toContain("## Payload");
		});

		it("should include a Notes section", () => {
			const content = generateEventDocContent(entry);
			expect(content).toContain("## Notes");
		});
	});
});
