import { describe, it, expect, vi } from "vitest";

vi.mock("../../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(),
		readFileSync: vi.fn(),
		readdirSync: vi.fn(),
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
	RESET: "", BOLD: "", DIM: "", GREEN: "", CYAN: "",
}));

vi.mock("../../../../src/infrastructure/menu.js", () => ({
	runMenu: vi.fn(),
}));

vi.mock("../../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

import { disk } from "../../../../src/infrastructure/filesystem.js";
import { listProjectComponents } from "../../../../src/domain/make/component/component-list.js";

describe("listProjectComponents", () => {
	it("returns empty array when components dir does not exist", () => {
		vi.mocked(disk.existsSync).mockReturnValue(false);
		expect(listProjectComponents("/project")).toEqual([]);
	});

	it("discovers components from markdown frontmatter", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readdirSync).mockReturnValue(["auth-service.md", "user-profile.md"] as never);
		vi.mocked(disk.readFileSync).mockImplementation((path: string) => {
			if (path.includes("auth-service")) {
				return "---\ntype: c4-component\nstatus: active\nname: Auth Service\n---\n# Auth Service\n";
			}
			return "---\ntype: component\nstatus: draft\n---\n# User Profile\n";
		});

		const components = listProjectComponents("/project");
		expect(components).toHaveLength(2);

		const auth = components.find((c) => c.name === "Auth Service");
		expect(auth).toBeDefined();
		expect(auth!.kind).toBe("c4-component");
		expect(auth!.status).toBe("active");

		const user = components.find((c) => c.name === "user-profile");
		expect(user).toBeDefined();
		expect(user!.kind).toBe("component");
		expect(user!.status).toBe("draft");
	});

	it("handles files without frontmatter", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readdirSync).mockReturnValue(["plain.md"] as never);
		vi.mocked(disk.readFileSync).mockReturnValue("# Just a heading\nNo frontmatter.");

		const components = listProjectComponents("/project");
		expect(components).toHaveLength(1);
		expect(components[0].kind).toBe("component");
		expect(components[0].status).toBe("unknown");
	});

	it("ignores non-markdown files", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readdirSync).mockReturnValue(["readme.txt", "data.json", "comp.md"] as never);
		vi.mocked(disk.readFileSync).mockReturnValue("---\ntype: component\nstatus: draft\n---\n");

		const components = listProjectComponents("/project");
		expect(components).toHaveLength(1);
	});

	it("sorts components alphabetically", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readdirSync).mockReturnValue(["zebra.md", "alpha.md", "middle.md"] as never);
		vi.mocked(disk.readFileSync).mockReturnValue("---\ntype: component\nstatus: draft\n---\n");

		const components = listProjectComponents("/project");
		expect(components.map((c) => c.name)).toEqual(["alpha", "middle", "zebra"]);
	});
});
