import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/frontmatter.js", async () => {
	const actual = await vi.importActual<typeof import("../../../src/infrastructure/frontmatter.js")>("../../../src/infrastructure/frontmatter.js");
	return actual;
});

import { loadUserTemplate, mergeTemplate } from "../../../src/domain/templates/entity-template.js";

const mockDisk = {
	existsSync: vi.fn(() => false),
	readFileSync: vi.fn(() => ""),
};

const mockPaths = {
	join: (...args: string[]) => args.join("/"),
};

const deps = { disk: mockDisk as any, paths: mockPaths as any };

beforeEach(() => {
	vi.clearAllMocks();
});

describe("loadUserTemplate", () => {
	it("returns null when template file does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);

		const result = loadUserTemplate(deps, "/project", "event");

		expect(result).toBeNull();
		expect(mockDisk.existsSync).toHaveBeenCalledWith("/project/docs/templates/event.md");
	});

	it("uses custom dir from config", () => {
		mockDisk.existsSync.mockReturnValue(false);

		loadUserTemplate(deps, "/project", "event", { dir: "custom/templates" });

		expect(mockDisk.existsSync).toHaveBeenCalledWith("/project/custom/templates/event.md");
	});

	it("parses frontmatter and body from template file", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue(
			"---\nstatus: active\npriority: high\n---\nCustom body content",
		);

		const result = loadUserTemplate(deps, "/project", "resource");

		expect(result).toEqual({
			frontmatter: { status: "active", priority: "high" },
			body: "Custom body content",
		});
	});

	it("returns empty frontmatter and full body when no frontmatter block", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue("Just plain content\nwith lines");

		const result = loadUserTemplate(deps, "/project", "event");

		expect(result).toEqual({
			frontmatter: {},
			body: "Just plain content\nwith lines",
		});
	});

	it("trims whitespace from body", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue("---\ntype: Event\n---\n\n  Trimmed body  \n\n");

		const result = loadUserTemplate(deps, "/project", "event");

		expect(result!.body).toBe("Trimmed body");
	});
});

describe("mergeTemplate", () => {
	it("returns CLI properties unchanged when no user template", () => {
		const cli = { type: "Event", status: "draft" };

		const result = mergeTemplate(cli, "CLI body", null);

		expect(result.frontmatter).toEqual({ type: "Event", status: "draft" });
		expect(result.body).toBe("CLI body");
	});

	it("user properties override CLI properties", () => {
		const cli = { type: "Event", status: "draft", domain: "core" };
		const user = { frontmatter: { status: "active", priority: "high" }, body: "" };

		const result = mergeTemplate(cli, "CLI body", user);

		expect(result.frontmatter).toEqual({
			type: "Event",
			status: "active",
			domain: "core",
			priority: "high",
		});
	});

	it("user body replaces CLI body when non-empty", () => {
		const cli = { type: "Event" };
		const user = { frontmatter: {}, body: "User body content" };

		const result = mergeTemplate(cli, "CLI body", user);

		expect(result.body).toBe("User body content");
	});

	it("falls back to CLI body when user body is empty", () => {
		const cli = { type: "Event" };
		const user = { frontmatter: { status: "active" }, body: "" };

		const result = mergeTemplate(cli, "CLI body", user);

		expect(result.body).toBe("CLI body");
	});

	it("does not mutate the original CLI properties object", () => {
		const cli = { type: "Event" };
		const user = { frontmatter: { extra: "value" }, body: "" };

		mergeTemplate(cli, "body", user);

		expect(cli).toEqual({ type: "Event" });
	});
});
