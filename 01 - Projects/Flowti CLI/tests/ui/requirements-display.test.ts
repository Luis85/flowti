import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "", BLUE: "", MAGENTA: "", WHITE: "",
}));

import { log } from "../../src/infrastructure/logger.js";
import {
	renderRequirementList,
	renderUseCaseList,
	renderUserStoryList,
	renderRequirementAdded,
	renderRequirementUpdated,
} from "../../src/ui/requirements-display.js";
import type { RequirementSummary, UseCaseSummary, UserStorySummary } from "../../src/domain/requirements/requirement-types.js";

const mockLog = log as ReturnType<typeof vi.fn>;
const output = () => mockLog.mock.calls.map((c: unknown[]) => c[0] ?? "").join("\n");

beforeEach(() => { mockLog.mockClear(); });

// ── renderRequirementList ───────────────────────────────────────────

describe("renderRequirementList", () => {
	it("renders empty message when no requirements", () => {
		renderRequirementList([]);
		expect(output()).toContain("No requirements defined yet");
	});

	it("renders requirement count and details", () => {
		const reqs: RequirementSummary[] = [
			{ id: "REQ-001", name: "User auth", requirementType: "functional", priority: "must", status: "approved" },
			{ id: "REQ-002", name: "Performance", requirementType: "non-functional", priority: "should", status: "draft" },
		];
		renderRequirementList(reqs);
		const out = output();
		expect(out).toContain("Requirements (2)");
		expect(out).toContain("REQ-001");
		expect(out).toContain("User auth");
		expect(out).toContain("[functional]");
		expect(out).toContain("[must]");
		expect(out).toContain("[approved]");
		expect(out).toContain("REQ-002");
		expect(out).toContain("[should]");
	});
});

// ── renderUseCaseList ───────────────────────────────────────────────

describe("renderUseCaseList", () => {
	it("renders empty message when no use cases", () => {
		renderUseCaseList([]);
		expect(output()).toContain("No use cases defined yet");
	});

	it("renders use case details", () => {
		const useCases: UseCaseSummary[] = [
			{ id: "UC-001", name: "Login", actor: "End User" },
			{ id: "UC-002", name: "Export Report", actor: "Admin" },
		];
		renderUseCaseList(useCases);
		const out = output();
		expect(out).toContain("Use Cases (2)");
		expect(out).toContain("UC-001");
		expect(out).toContain("Login");
		expect(out).toContain("actor: End User");
		expect(out).toContain("UC-002");
		expect(out).toContain("actor: Admin");
	});
});

// ── renderUserStoryList ─────────────────────────────────────────────

describe("renderUserStoryList", () => {
	it("renders empty message when no stories", () => {
		renderUserStoryList([]);
		expect(output()).toContain("No user stories defined yet");
	});

	it("renders story details with points", () => {
		const stories: UserStorySummary[] = [
			{ id: "US-001", name: "Login flow", status: "done", role: "end-user", storyPoints: 5 },
			{ id: "US-002", name: "Dashboard", status: "in-progress", role: "admin", storyPoints: 8 },
		];
		renderUserStoryList(stories);
		const out = output();
		expect(out).toContain("User Stories (2)");
		expect(out).toContain("US-001");
		expect(out).toContain("Login flow");
		expect(out).toContain("[done]");
		expect(out).toContain("role: end-user");
		expect(out).toContain("5pts");
		expect(out).toContain("US-002");
		expect(out).toContain("[in-progress]");
		expect(out).toContain("8pts");
	});

	it("omits points when zero", () => {
		const stories: UserStorySummary[] = [
			{ id: "US-003", name: "No points", status: "backlog", role: "user", storyPoints: 0 },
		];
		renderUserStoryList(stories);
		expect(output()).not.toContain("pts");
	});
});

// ── renderRequirementAdded ──────────────────────────────────────────

describe("renderRequirementAdded", () => {
	it("renders created message with path", () => {
		renderRequirementAdded(".flowti/requirements/REQ-001.md");
		expect(output()).toContain("Created: .flowti/requirements/REQ-001.md");
	});
});

// ── renderRequirementUpdated ────────────────────────────────────────

describe("renderRequirementUpdated", () => {
	it("renders updated message with name and status", () => {
		renderRequirementUpdated("User auth", "approved");
		const out = output();
		expect(out).toContain("Updated User auth");
		expect(out).toContain("approved");
	});
});
