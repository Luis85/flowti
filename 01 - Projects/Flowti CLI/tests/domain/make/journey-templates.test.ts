import { describe, it, expect } from "vitest";
import {
	journeyDefinitionTemplate,
	journeyTestTemplate,
	journeyCanvasTemplate,
} from "../../../src/domain/make/templates/journey.js";

describe("journeyDefinitionTemplate", () => {
	const result = journeyDefinitionTemplate("Getting Started", "getting-started", "Intro journey");

	it("returns valid JSON", () => {
		expect(() => JSON.parse(result)).not.toThrow();
	});

	it("contains journey name", () => {
		const parsed = JSON.parse(result);
		expect(parsed.journey).toBe("Getting Started");
	});

	it("contains chapter", () => {
		const parsed = JSON.parse(result);
		expect(parsed.chapter).toBe(1);
	});

	it("contains description", () => {
		const parsed = JSON.parse(result);
		expect(parsed.description).toBe("Intro journey");
	});

	it("contains lifecycle config", () => {
		const parsed = JSON.parse(result);
		expect(parsed.lifecycle.enablePlugin).toBe(true);
		expect(parsed.lifecycle.startTrace).toBe(true);
	});

	it("contains at least 2 steps", () => {
		const parsed = JSON.parse(result);
		expect(parsed.steps.length).toBeGreaterThanOrEqual(2);
	});

	it("step IDs use the kebab slug", () => {
		const parsed = JSON.parse(result);
		expect(parsed.steps[0].id).toBe("getting-started-01");
		expect(parsed.steps[1].id).toBe("getting-started-02");
	});

	it("contains tools array", () => {
		const parsed = JSON.parse(result);
		expect(parsed.tools).toContain("command");
		expect(parsed.tools).toContain("assert");
	});
});

describe("journeyTestTemplate", () => {
	const result = journeyTestTemplate("getting-started");

	it("uses describe.skip to prevent running without Obsidian", () => {
		expect(result).toContain("describe.skip");
	});

	it("contains the journey slug in the describe name", () => {
		expect(result).toContain('Journey: getting-started');
	});

	it("contains the journey slug in the journey path", () => {
		expect(result).toContain("getting-started.journey");
	});

	it("contains commented executeJourney code", () => {
		expect(result).toContain("executeJourney");
	});

	it("contains run instructions", () => {
		expect(result).toContain("npm run test:e2e");
		expect(result).toContain("--journey=getting-started");
	});
});

describe("journeyCanvasTemplate", () => {
	const result = journeyCanvasTemplate("Getting Started");

	it("returns valid JSON", () => {
		expect(() => JSON.parse(result)).not.toThrow();
	});

	it("contains a title node", () => {
		const parsed = JSON.parse(result);
		expect(parsed.nodes).toHaveLength(1);
		expect(parsed.nodes[0].text).toContain("Getting Started");
	});

	it("has empty edges array", () => {
		const parsed = JSON.parse(result);
		expect(parsed.edges).toEqual([]);
	});

	it("title node has reasonable dimensions", () => {
		const parsed = JSON.parse(result);
		expect(parsed.nodes[0].width).toBeGreaterThan(0);
		expect(parsed.nodes[0].height).toBeGreaterThan(0);
	});
});
