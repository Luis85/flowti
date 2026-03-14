import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	findBrief, listBriefs, saveBrief, appendTask, transitionBrief,
	generateBrief, getBriefTemplate, resolvePromptVariables, formatRosterForPrompt,
	briefFileName,
} from "../../../src/domain/agents/brief-store.js";
import type { BriefStoreDeps, RosterEntry } from "../../../src/domain/agents/brief-store.js";
import type { IterationSummary } from "../../../src/domain/iterations/iteration-types.js";

function makeDeps(): BriefStoreDeps & { files: Record<string, string>; dirs: Set<string> } {
	const files: Record<string, string> = {};
	const dirs = new Set<string>();
	return {
		files, dirs,
		disk: {
			readFileSync: vi.fn((p: string) => {
				if (files[p] === undefined) throw new Error(`File not found: ${p}`);
				return files[p];
			}),
			writeFileSync: vi.fn((p: string, c: string) => { files[p] = c; }),
			existsSync: vi.fn((p: string) => files[p] !== undefined || dirs.has(p)),
			mkdirSync: vi.fn((p: string) => { dirs.add(p); }),
			readdirSync: vi.fn((dir: string) => {
				return Object.keys(files)
					.filter((f) => f.startsWith(dir + "/"))
					.map((f) => f.slice(dir.length + 1))
					.filter((f) => !f.includes("/"));
			}),
		} as unknown as BriefStoreDeps["disk"],
		paths: {
			join: (...parts: string[]) => parts.join("/"),
			dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
			relative: (_from: string, to: string) => to,
		} as unknown as BriefStoreDeps["paths"],
	};
}

function makeIteration(overrides: Partial<IterationSummary> = {}): IterationSummary {
	return {
		name: "Sprint 3", number: 3, startDate: "2026-03-14", endDate: "2026-03-28",
		goal: "Build briefs", capacity: "", description: "", status: "new",
		file: "iteration-003-plan.md", agents: [], resources: [], capacities: [], scopeItems: [],
		...overrides,
	};
}

describe("getBriefTemplate", () => {
	it("returns brief lifecycle template with open/active/done states", () => {
		const t = getBriefTemplate();
		expect(t.entityType).toBe("brief");
		expect(t.states).toEqual(["open", "active", "done"]);
		expect(t.initialState).toBe("open");
		expect(t.terminalStates).toEqual(["done"]);
	});
});

describe("briefFileName", () => {
	it("includes iteration number, agent slug, and phase", () => {
		expect(briefFileName(4, "Product Owner", "in-progress")).toBe("iteration-004-product-owner--in-progress.md");
	});

	it("handles single-word names and phases", () => {
		expect(briefFileName(1, "Dev", "new")).toBe("iteration-001-dev--new.md");
	});
});

describe("saveBrief", () => {
	it("saves brief to the briefs subdirectory with phase in filename", () => {
		const deps = makeDeps();
		const path = saveBrief(deps, "/project/docs/iterations", 3, "Product Owner", "new", "# Brief");
		expect(path).toBe("/project/docs/iterations/briefs/iteration-003-product-owner--new.md");
		expect(deps.files[path]).toBe("# Brief");
	});
});

describe("findBrief", () => {
	it("returns null when brief does not exist", () => {
		const deps = makeDeps();
		expect(findBrief(deps, "/iter", 3, "Architect", "new")).toBeNull();
	});

	it("returns summary when brief exists", () => {
		const deps = makeDeps();
		deps.files["/iter/briefs/iteration-003-architect--new.md"] = "---\nagent: Architect\nphase: new\nstatus: active\n---\n# Brief";
		const result = findBrief(deps, "/iter", 3, "Architect", "new");
		expect(result).not.toBeNull();
		expect(result!.agentName).toBe("Architect");
		expect(result!.phase).toBe("new");
		expect(result!.status).toBe("active");
	});

	it("defaults to open status when frontmatter is missing", () => {
		const deps = makeDeps();
		deps.files["/iter/briefs/iteration-003-architect--new.md"] = "# Brief without frontmatter";
		const result = findBrief(deps, "/iter", 3, "Architect", "new");
		expect(result!.status).toBe("open");
	});
});

describe("listBriefs", () => {
	it("returns empty array when no briefs directory", () => {
		const deps = makeDeps();
		expect(listBriefs(deps, "/iter", 3)).toEqual([]);
	});

	it("lists all briefs for an iteration including phase from frontmatter", () => {
		const deps = makeDeps();
		deps.dirs.add("/iter/briefs");
		deps.files["/iter/briefs/iteration-003-product-owner--new.md"] = "---\nagent: Product Owner\nphase: new\nstatus: open\n---\n";
		deps.files["/iter/briefs/iteration-003-architect--planned.md"] = "---\nagent: Architect\nphase: planned\nstatus: active\n---\n";
		const result = listBriefs(deps, "/iter", 3);
		expect(result).toHaveLength(2);
		expect(result[0].phase).toBe("new");
		expect(result[1].phase).toBe("planned");
	});

	it("filters briefs by iteration number prefix", () => {
		const deps = makeDeps();
		deps.dirs.add("/iter/briefs");
		deps.files["/iter/briefs/iteration-003-architect--new.md"] = "---\nagent: Architect\nphase: new\n---\n";
		deps.files["/iter/briefs/iteration-004-architect--new.md"] = "---\nagent: Architect\nphase: new\n---\n";
		expect(listBriefs(deps, "/iter", 3)).toHaveLength(1);
	});
});

describe("appendTask", () => {
	it("appends task to existing Assigned Tasks section", () => {
		const deps = makeDeps();
		deps.files["/iter/briefs/iteration-003-dev--new.md"] = "# Brief\n\n## Assigned Tasks\n\n- [ ] First task\n";
		const ok = appendTask(deps, "/iter", 3, "Dev", "new", "Second task");
		expect(ok).toBe(true);
		expect(deps.files["/iter/briefs/iteration-003-dev--new.md"]).toContain("- [ ] Second task");
		expect(deps.files["/iter/briefs/iteration-003-dev--new.md"]).toContain("- [ ] First task");
	});

	it("creates Assigned Tasks section if missing", () => {
		const deps = makeDeps();
		deps.files["/iter/briefs/iteration-003-dev--new.md"] = "# Brief\n\nSome content.";
		appendTask(deps, "/iter", 3, "Dev", "new", "New task");
		expect(deps.files["/iter/briefs/iteration-003-dev--new.md"]).toContain("## Assigned Tasks");
		expect(deps.files["/iter/briefs/iteration-003-dev--new.md"]).toContain("- [ ] New task");
	});

	it("returns false when brief does not exist", () => {
		const deps = makeDeps();
		expect(appendTask(deps, "/iter", 3, "Missing", "new", "Task")).toBe(false);
	});
});

describe("transitionBrief", () => {
	it("transitions from open to active", () => {
		const deps = makeDeps();
		deps.files["/iter/briefs/iteration-003-dev--new.md"] = "---\nstatus: open\n---\n# Brief";
		const result = transitionBrief(deps, "/iter", 3, "Dev", "new", "active");
		expect(result.success).toBe(true);
		expect(result.from).toBe("open");
		expect(result.to).toBe("active");
		expect(deps.files["/iter/briefs/iteration-003-dev--new.md"]).toContain("status: active");
	});

	it("transitions from active to done", () => {
		const deps = makeDeps();
		deps.files["/iter/briefs/iteration-003-dev--new.md"] = "---\nstatus: active\n---\n# Brief";
		const result = transitionBrief(deps, "/iter", 3, "Dev", "new", "done");
		expect(result.success).toBe(true);
	});

	it("rejects invalid transition from open to done", () => {
		const deps = makeDeps();
		deps.files["/iter/briefs/iteration-003-dev--new.md"] = "---\nstatus: open\n---\n# Brief";
		const result = transitionBrief(deps, "/iter", 3, "Dev", "new", "done");
		expect(result.success).toBe(false);
	});

	it("returns error when brief not found", () => {
		const deps = makeDeps();
		const result = transitionBrief(deps, "/iter", 3, "Missing", "new", "active");
		expect(result.success).toBe(false);
		expect(result.error).toContain("not found");
	});
});

describe("generateBrief", () => {
	it("generates a full role-aware brief with frontmatter including phase", () => {
		const brief = generateBrief({ agentName: "Architect", iteration: makeIteration() });
		expect(brief).toContain("---");
		expect(brief).toContain("agent: Architect");
		expect(brief).toContain("iteration: 3");
		expect(brief).toContain("phase: new");
		expect(brief).toContain("status: open");
		expect(brief).toContain("# Agent Brief: Architect — Iteration #3");
		expect(brief).toContain("[[architect|Architect]]");
		expect(brief).toContain("[[iteration-003-plan|Iteration #3 Plan]]");
	});

	it("includes agent description, skills, and roles", () => {
		const brief = generateBrief({
			agentName: "UX Designer",
			agentDescription: "Designs user experiences and interaction patterns",
			agentSkills: ["User Research", "Wireframing"],
			agentRoles: ["Designer", "Usability Reviewer"],
			iteration: makeIteration(),
		});
		expect(brief).toContain("## Your Role");
		expect(brief).toContain("Designs user experiences and interaction patterns");
		expect(brief).toContain("**Skills**: User Research, Wireframing");
		expect(brief).toContain("**Roles**: Designer, Usability Reviewer");
	});

	it("includes system prompt when provided", () => {
		const brief = generateBrief({
			agentName: "Dev", iteration: makeIteration(),
			systemPrompt: "You are a senior developer focused on quality.",
		});
		expect(brief).toContain("## System Prompt");
		expect(brief).toContain("You are a senior developer focused on quality.");
	});

	it("omits system prompt section when null", () => {
		const brief = generateBrief({ agentName: "Dev", iteration: makeIteration(), systemPrompt: null });
		expect(brief).not.toContain("## System Prompt");
	});

	it("includes full iteration context with dates and description", () => {
		const brief = generateBrief({
			agentName: "Dev",
			iteration: makeIteration({ description: "Build the widget", scopeItems: [{ text: "Task 1", done: true }] }),
		});
		expect(brief).toContain("**Name**: Sprint 3");
		expect(brief).toContain("**Goal**: Build briefs");
		expect(brief).toContain("**Description**: Build the widget");
		expect(brief).toContain("**Dates**: 2026-03-14 → 2026-03-28");
		expect(brief).toContain("## Scope Items (1/1 done)");
	});

	it("includes phase-aware DoD when iteration template provided", () => {
		const template = {
			entityType: "iteration", states: ["new", "done"], transitions: { new: ["done"], done: [] },
			initialState: "new", terminalStates: ["done"],
			tasks: { new: ["Refine goal", "Set dates"] },
		};
		const brief = generateBrief({ agentName: "Dev", iteration: makeIteration(), iterationTemplate: template });
		expect(brief).toContain("## Definition of Done");
		expect(brief).toContain("To advance from **new** to the next phase:");
		expect(brief).toContain("- [ ] Refine goal");
		expect(brief).toContain("- [ ] Set dates");
	});

	it("falls back to default DoD when no template tasks", () => {
		const brief = generateBrief({ agentName: "Dev", iteration: makeIteration() });
		expect(brief).toContain("## Definition of Done");
		expect(brief).toContain("- [ ] All scope items completed");
	});

	it("includes Assigned Tasks section", () => {
		const brief = generateBrief({ agentName: "Dev", iteration: makeIteration() });
		expect(brief).toContain("## Assigned Tasks");
	});

	it("includes When You Are Done section with brief update instructions", () => {
		const brief = generateBrief({ agentName: "Dev", iteration: makeIteration() });
		expect(brief).toContain("## When You Are Done");
		expect(brief).toContain("Change the `status` in frontmatter");
		expect(brief).toContain("Acceptance Criteria");
		expect(brief).toContain("Assigned Tasks");
	});

	it("resolves {{roster}} in system prompt when rosterAgents provided", () => {
		const roster: RosterEntry[] = [
			{ name: "Dev", description: "Writes code", roles: ["Implementer"], skills: ["TypeScript"] },
			{ name: "QA", description: "Tests code", roles: ["Tester"], skills: ["Vitest"] },
		];
		const brief = generateBrief({
			agentName: "Orchestrator",
			systemPrompt: "You coordinate:\n\n{{roster}}",
			iteration: makeIteration(),
			rosterAgents: roster,
		});
		expect(brief).toContain("**Dev** — Writes code");
		expect(brief).toContain("**QA** — Tests code");
		expect(brief).not.toContain("{{roster}}");
	});

	it("leaves system prompt unchanged when no {{roster}} placeholder", () => {
		const brief = generateBrief({
			agentName: "Dev",
			systemPrompt: "You are a developer.",
			iteration: makeIteration(),
			rosterAgents: [{ name: "QA", description: "Tests", roles: [], skills: [] }],
		});
		expect(brief).toContain("You are a developer.");
	});
});

describe("formatRosterForPrompt", () => {
	it("formats agents with name, description, roles, and skills", () => {
		const roster: RosterEntry[] = [
			{ name: "Architect", description: "Designs systems", roles: ["Planner"], skills: ["Architecture", "Design"] },
		];
		const result = formatRosterForPrompt(roster);
		expect(result).toContain("- **Architect** — Designs systems");
		expect(result).toContain("Roles: Planner");
		expect(result).toContain("Skills: Architecture, Design");
	});

	it("returns placeholder for empty roster", () => {
		expect(formatRosterForPrompt([])).toContain("No agents");
	});

	it("omits roles/skills lines when empty", () => {
		const roster: RosterEntry[] = [{ name: "Bob", description: "Human", roles: [], skills: [] }];
		const result = formatRosterForPrompt(roster);
		expect(result).toContain("- **Bob** — Human");
		expect(result).not.toContain("Roles:");
		expect(result).not.toContain("Skills:");
	});
});

describe("resolvePromptVariables", () => {
	it("replaces {{roster}} with formatted roster", () => {
		const roster: RosterEntry[] = [{ name: "Dev", description: "Codes", roles: ["Implementer"], skills: [] }];
		const result = resolvePromptVariables("Team:\n\n{{roster}}\n\nDone.", roster);
		expect(result).toContain("**Dev** — Codes");
		expect(result).not.toContain("{{roster}}");
		expect(result).toContain("Done.");
	});

	it("returns prompt unchanged when no placeholder", () => {
		const result = resolvePromptVariables("No variables here.", []);
		expect(result).toBe("No variables here.");
	});
});
