import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(),
		readFileSync: vi.fn(),
		writeFileSync: vi.fn(),
		readdirSync: vi.fn(),
		mkdirSync: vi.fn(),
	},
}));

vi.mock("../../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...parts: string[]) => parts.join("/"),
	},
}));

vi.mock("../../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/mock",
	CLI_PROJECT: "/mock/cli",
	cliConfig: {},
}));

vi.mock("../../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "",
}));

vi.mock("../../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

vi.mock("../../../../src/infrastructure/proc.js", () => ({
	proc: { exit: vi.fn() },
}));

import { disk } from "../../../../src/infrastructure/filesystem.js";
import { proc } from "../../../../src/infrastructure/proc.js";
import { commands } from "../../../../src/domain/make/component/component-edit.js";
import { splitFrontmatter, joinFrontmatter, extractPropFlags } from "../../../../src/domain/make/component/component-edit.js";
import type { ProjectContext } from "../../../../src/infrastructure/types.js";

const PROJECT: ProjectContext = {
	path: "/project",
	pkg: null,
	config: { name: "test" },
	scripts: {},
};

beforeEach(() => {
	vi.clearAllMocks();
});

// ── Pure helpers ─────────────────────────────────────────────────────

describe("splitFrontmatter", () => {
	it("parses valid frontmatter", () => {
		const content = "---\ntype: component\nstatus: draft\n---\n# Heading\n";
		const { fm, body, hasFm } = splitFrontmatter(content);
		expect(hasFm).toBe(true);
		expect(fm).toEqual({ type: "component", status: "draft" });
		expect(body).toBe("# Heading\n");
	});

	it("returns no frontmatter when missing", () => {
		const content = "# Just a heading\nNo frontmatter.";
		const { fm, body, hasFm } = splitFrontmatter(content);
		expect(hasFm).toBe(false);
		expect(fm).toEqual({});
		expect(body).toBe(content);
	});

	it("handles frontmatter without closing delimiter", () => {
		const content = "---\nkey: value\nno closing";
		const { hasFm } = splitFrontmatter(content);
		expect(hasFm).toBe(false);
	});
});

describe("joinFrontmatter", () => {
	it("serializes frontmatter and body", () => {
		const result = joinFrontmatter({ type: "component", status: "active" }, "\n# Title\n");
		expect(result).toBe("---\ntype: component\nstatus: active\n---\n# Title\n");
	});

	it("handles empty frontmatter", () => {
		const result = joinFrontmatter({}, "\n# Title\n");
		expect(result).toBe("---\n---\n# Title\n");
	});
});

describe("extractPropFlags", () => {
	it("extracts prop.* keys", () => {
		const flags = { name: "Test", "prop.status": "active", "prop.tech": "React", other: true };
		expect(extractPropFlags(flags)).toEqual({ status: "active", tech: "React" });
	});

	it("returns empty object when no prop flags", () => {
		expect(extractPropFlags({ name: "Test" })).toEqual({});
	});

	it("converts boolean values to strings", () => {
		const flags = { "prop.enabled": true };
		expect(extractPropFlags(flags)).toEqual({ enabled: "true" });
	});
});

// ── edit:component command ──────────────────────────────────────────

describe("edit:component command", () => {
	const editCmd = commands["edit:component"];

	it("exits when --name is missing", () => {
		editCmd({}, [], "edit:component", PROJECT);
		expect(proc.exit).toHaveBeenCalledWith(1);
	});

	it("exits when no project selected", () => {
		editCmd({ name: "Test" }, [], "edit:component", undefined);
		expect(proc.exit).toHaveBeenCalledWith(1);
	});

	it("exits when component file does not exist", () => {
		vi.mocked(disk.existsSync).mockReturnValue(false);
		editCmd({ name: "Missing" }, [], "edit:component", PROJECT);
		expect(proc.exit).toHaveBeenCalledWith(1);
	});

	it("exits when no prop flags specified", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		editCmd({ name: "Test" }, [], "edit:component", PROJECT);
		expect(proc.exit).toHaveBeenCalledWith(1);
	});

	it("exits when file has no frontmatter", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue("# No frontmatter");
		editCmd({ name: "Test", "prop.status": "active" }, [], "edit:component", PROJECT);
		expect(proc.exit).toHaveBeenCalledWith(1);
	});

	it("updates frontmatter properties and preserves existing ones", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(
			"---\ntype: component\nstatus: draft\ncreated: 2026-01-01\n---\n\n# Auth Service\n",
		);

		editCmd(
			{ name: "Auth Service", "prop.status": "active", "prop.technology": "React" },
			[],
			"edit:component",
			PROJECT,
		);

		expect(proc.exit).not.toHaveBeenCalled();
		expect(disk.writeFileSync).toHaveBeenCalledTimes(1);

		const written = vi.mocked(disk.writeFileSync).mock.calls[0][1] as string;
		expect(written).toContain("type: component");
		expect(written).toContain("status: active");
		expect(written).toContain("technology: React");
		expect(written).toContain("created: 2026-01-01");
		expect(written).toContain("# Auth Service");
	});

	it("uses kebab-case for file lookup", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue("---\ntype: component\n---\n\n# Test\n");

		editCmd(
			{ name: "My Component", "prop.status": "active" },
			[],
			"edit:component",
			PROJECT,
		);

		expect(disk.existsSync).toHaveBeenCalledWith("/project/docs/components/my-component.md");
	});
});
