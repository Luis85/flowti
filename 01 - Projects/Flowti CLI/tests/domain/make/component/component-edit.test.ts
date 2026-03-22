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

import { disk } from "../../../../src/infrastructure/filesystem.js";
import { paths } from "../../../../src/infrastructure/paths.js";
import { splitFrontmatter, joinFrontmatter } from "../../../../src/infrastructure/frontmatter.js";
import { extractPropFlags, editComponent } from "../../../../src/domain/make/component/component-edit.js";

function editDeps() { return { disk, paths } as const; }

beforeEach(() => {
	vi.clearAllMocks();
});

// ── Pure helpers ─────────────────────────────────────────────────────

describe("splitFrontmatter", () => {
	it("parses valid frontmatter", () => {
		const content = "---\ntype: component\nstatus: draft\n---\n# Heading\n";
		const result = splitFrontmatter(content);
		expect(result).not.toBeNull();
		expect(result!.frontmatter).toEqual({ type: "component", status: "draft" });
		expect(result!.body).toBe("\n# Heading\n");
	});

	it("returns null when no frontmatter", () => {
		const content = "# Just a heading\nNo frontmatter.";
		expect(splitFrontmatter(content)).toBeNull();
	});

	it("returns null for unclosed frontmatter", () => {
		const content = "---\nkey: value\nno closing";
		expect(splitFrontmatter(content)).toBeNull();
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

// ── editComponent pure function ─────────────────────────────────────

describe("editComponent", () => {
	it("returns error when name is missing", () => {
		const result = editComponent(undefined, {}, "/project", editDeps());
		expect(result.success).toBe(false);
		if (!result.success) expect(result.error).toContain("--name is required");
	});

	it("returns error when component file does not exist", () => {
		vi.mocked(disk.existsSync).mockReturnValue(false);
		const result = editComponent("Missing", {}, "/project", editDeps());
		expect(result.success).toBe(false);
		if (!result.success) expect(result.error).toContain("Component not found");
	});

	it("returns error when no prop flags specified", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		const result = editComponent("Test", { name: "Test" }, "/project", editDeps());
		expect(result.success).toBe(false);
		if (!result.success) expect(result.error).toContain("No properties specified");
	});

	it("returns error when file has no frontmatter", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue("# No frontmatter" as never);
		const result = editComponent("Test", { "prop.status": "active" }, "/project", editDeps());
		expect(result.success).toBe(false);
		if (!result.success) expect(result.error).toContain("No frontmatter");
	});

	it("updates frontmatter properties and preserves existing ones", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(
			"---\ntype: component\nstatus: draft\ncreated: 2026-01-01\n---\n\n# Auth Service\n" as never,
		);

		const result = editComponent(
			"Auth Service",
			{ "prop.status": "active", "prop.technology": "React" },
			"/project",
			editDeps(),
		);

		expect(result.success).toBe(true);
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
		vi.mocked(disk.readFileSync).mockReturnValue("---\ntype: component\n---\n\n# Test\n" as never);

		editComponent("My Component", { "prop.status": "active" }, "/project", editDeps());

		expect(disk.existsSync).toHaveBeenCalledWith("/project/components/my-component/my-component.md");
	});

	it("returns kebab and propList on success", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue("---\ntype: component\n---\n\n# Test\n" as never);

		const result = editComponent("Test", { "prop.status": "active" }, "/project", editDeps());

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.kebab).toBe("test");
			expect(result.propList).toBe("status=active");
		}
	});
});
