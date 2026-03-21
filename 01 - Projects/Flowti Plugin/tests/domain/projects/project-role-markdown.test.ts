import { describe, it, expect } from "vitest";
import {
	buildProjectRoleMarkdown,
	formatSkillsLineForEditor,
	parseProjectRoleMarkdown,
	parseSkillsLine,
	projectRoleNoteRelativePath,
} from "../../../src/domain/projects/project-role-markdown.js";

describe("parseSkillsLine", () => {
	it("splits on semicolons and maps trailing level to pipe form", () => {
		expect(parseSkillsLine("Requirements Engineering 5; Team Player; IREB Certified")).toEqual([
			"Requirements Engineering|5",
			"Team Player",
			"IREB Certified",
		]);
	});
});

describe("formatSkillsLineForEditor", () => {
	it("inverts pipe levels for display", () => {
		expect(formatSkillsLineForEditor(["Requirements Engineering|5", "Team Player"])).toBe(
			"Requirements Engineering 5; Team Player",
		);
	});
});

describe("projectRoleNoteRelativePath", () => {
	it("sanitizes id into a filename segment", () => {
		expect(projectRoleNoteRelativePath("My App", "Solution Manager")).toBe(
			"01 - Projects/My App/team/roles/solution-manager.md",
		);
	});
});

describe("parseProjectRoleMarkdown / buildProjectRoleMarkdown", () => {
	it("round-trips role, need, skills, summary, and body", () => {
		const md = buildProjectRoleMarkdown({
			id: "sm-1",
			role: "Solution Manager",
			need: "Owns solution shaping",
			skills: ["Requirements Engineering|5", "Team Player"],
			summary: "Leads discovery and trade-offs",
			body: "## Scope\n\nFull-time through MVP.",
		});
		const parsed = parseProjectRoleMarkdown(md);
		expect(parsed).not.toBeNull();
		expect(parsed!.id).toBe("sm-1");
		expect(parsed!.role).toBe("Solution Manager");
		expect(parsed!.need).toBe("Owns solution shaping");
		expect(parsed!.skills).toEqual(["Requirements Engineering|5", "Team Player"]);
		expect(parsed!.summary).toBe("Leads discovery and trade-offs");
		expect(parsed!.body).toContain("Full-time through MVP");
	});

	it("parses inline semicolon skills when no YAML list is present", () => {
		const md = `---
type: ProjectRole
id: x
role: Analyst
need: ""
skills: Foo 3; Bar
---
Body here.
`;
		const parsed = parseProjectRoleMarkdown(md);
		expect(parsed?.skills).toEqual(["Foo|3", "Bar"]);
	});
});
