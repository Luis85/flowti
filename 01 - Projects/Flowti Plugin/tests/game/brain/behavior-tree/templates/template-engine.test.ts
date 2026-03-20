import { describe, it, expect } from "vitest";
import { generateFromTemplate, type TemplateContext } from "../../../../../src/game/brain/behavior-tree/templates/template-engine.js";

function makeCtx(overrides: Partial<TemplateContext> = {}): TemplateContext {
	return {
		goalType: "review",
		fileName: "iteration-plan.md",
		fileContent: "---\nstatus: in-progress\n---\n# Iteration Plan\n\n## Goals\n\n- Ship feature A\n- Fix bug B\n\n## Risks\n\nNone identified.",
		agentName: "Atlas",
		persona: "The Architect",
		mood: "focused",
		timestamp: "2026-03-20T10:00:00Z",
		...overrides,
	};
}

describe("generateFromTemplate", () => {
	describe("review", () => {
		it("extracts frontmatter status", () => {
			const result = generateFromTemplate(makeCtx({ goalType: "review" }));
			expect(result).toContain("in-progress");
		});

		it("counts sections", () => {
			const result = generateFromTemplate(makeCtx({ goalType: "review" }));
			expect(result).toContain("3 sections");
		});

		it("includes agent persona", () => {
			const result = generateFromTemplate(makeCtx({ goalType: "review" }));
			expect(result).toContain("The Architect");
		});
	});

	describe("summarize", () => {
		it("extracts headings as bullet points", () => {
			const result = generateFromTemplate(makeCtx({ goalType: "summarize" }));
			expect(result).toContain("- Iteration Plan");
			expect(result).toContain("- Goals");
			expect(result).toContain("- Risks");
		});

		it("includes word count", () => {
			const result = generateFromTemplate(makeCtx({ goalType: "summarize" }));
			expect(result).toMatch(/\d+ words/);
		});
	});

	describe("plan", () => {
		it("generates numbered checklist", () => {
			const result = generateFromTemplate(makeCtx({ goalType: "plan" }));
			expect(result).toMatch(/1\./);
		});
	});

	describe("implement", () => {
		it("generates scaffold stub", () => {
			const result = generateFromTemplate(makeCtx({ goalType: "implement" }));
			expect(result).toContain("Implementation");
		});
	});

	describe("monitor", () => {
		it("generates status check report", () => {
			const result = generateFromTemplate(makeCtx({ goalType: "monitor" }));
			expect(result).toContain("Status Check");
		});
	});

	describe("report", () => {
		it("generates aggregated report with metadata", () => {
			const result = generateFromTemplate(makeCtx({ goalType: "report" }));
			expect(result).toContain("Report");
		});
	});

	it("always produces non-empty output", () => {
		for (const goalType of ["review", "summarize", "plan", "implement", "monitor", "report"] as const) {
			const result = generateFromTemplate(makeCtx({ goalType }));
			expect(result.length).toBeGreaterThan(50);
		}
	});

	it("handles empty file content gracefully", () => {
		const result = generateFromTemplate(makeCtx({ fileContent: "" }));
		expect(result.length).toBeGreaterThan(0);
	});
});
