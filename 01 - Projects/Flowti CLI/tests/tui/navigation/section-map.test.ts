import { describe, it, expect } from "vitest";
import { buildSections, findSectionForPage } from "../../../src/tui/navigation/section-map.js";

describe("buildSections", () => {
	it("returns 8 sections", () => {
		const sections = buildSections();
		expect(sections).toHaveLength(8);
	});

	it("home section contains start page", () => {
		const sections = buildSections();
		const home = sections.find((s) => s.id === "home");
		expect(home).toBeDefined();
		expect(home!.pages).toContain("start");
	});

	it("agents section contains ai-tools and agents-chat", () => {
		const sections = buildSections();
		const agents = sections.find((s) => s.id === "agents");
		expect(agents!.pages).toContain("ai-tools");
		expect(agents!.pages).toContain("agents-chat");
	});

	it("project section starts with projects-list", () => {
		const sections = buildSections();
		const project = sections.find((s) => s.id === "project");
		expect(project).toBeDefined();
		expect(project!.pages[0]).toBe("projects-list");
		expect(project!.pages).toContain("project-detail");
	});

	it("every section has at least one page", () => {
		const sections = buildSections();
		for (const section of sections) {
			expect(section.pages.length).toBeGreaterThan(0);
		}
	});
});

describe("findSectionForPage", () => {
	it("returns home for start page", () => {
		const sections = buildSections();
		expect(findSectionForPage(sections, "start")).toBe("home");
	});

	it("returns agents for agents-chat", () => {
		const sections = buildSections();
		expect(findSectionForPage(sections, "agents-chat")).toBe("agents");
	});

	it("returns null for unknown page", () => {
		const sections = buildSections();
		expect(findSectionForPage(sections, "nonexistent")).toBeNull();
	});
});
