import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => false),
		readFileSync: vi.fn(() => ""),
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
	},
}));

vi.mock("../../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		resolve: (...args: string[]) => args.join("/"),
		dirname: (p: string) => p.split("/").slice(0, -1).join("/") || "/",
		basename: (p: string) => p.split("/").pop() ?? "",
	},
}));

vi.mock("../../../../src/infrastructure/config.js", () => ({
	PLUGIN_ROOT: "/plugin",
}));

vi.mock("../../../../src/infrastructure/clock.js", () => ({
	clock: {
		now: () => new Date("2026-03-10T12:00:00Z"),
		iso: () => "2026-03-10T12:00:00.000Z",
		safeIso: () => "2026-03-10T12-00-00",
	},
}));

beforeEach(() => {
	vi.clearAllMocks();
});

interface CommandMeta {
	id: string;
	label: string;
	description: string;
	domain: string;
	category: string;
	icon?: string;
}

// Replicate extractCommandMeta for testing
function extractCommandMeta(source: string): CommandMeta[] {
	const commands: CommandMeta[] = [];

	const defRegex = /\{\s*id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*description:\s*"([^"]+)",\s*domain:\s*"([^"]+)",\s*category:\s*"([^"]+)",\s*(?:icon:\s*"([^"]*)",\s*)?/g;
	let match: RegExpExecArray | null;
	while ((match = defRegex.exec(source)) !== null) {
		commands.push({
			id: match[1],
			label: match[2],
			description: match[3],
			domain: match[4],
			category: match[5],
			icon: match[6] || undefined,
		});
	}

	const metaRegex =
		/\{\s*id:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*description:\s*"([^"]+)",\s*domain:\s*"([^"]+)",\s*category:\s*"([^"]+)",\s*(?:icon:\s*"([^"]*)",?\s*)?/g;
	const externalStart = source.indexOf("getExternalCommandMeta");
	if (externalStart >= 0) {
		metaRegex.lastIndex = externalStart;
		while ((match = metaRegex.exec(source)) !== null) {
			if (!commands.some((c) => c.id === match![1])) {
				commands.push({
					id: match[1],
					label: match[2],
					description: match[3],
					domain: match[4],
					category: match[5],
					icon: match[6] || undefined,
				});
			}
		}
	}

	return commands;
}

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

describe("command-reference generator", () => {
	describe("extractCommandMeta", () => {
		it("extracts commands from createCommandDefinitions style", () => {
			const source = `
				{ id: "flowti:build", name: "Build Project", description: "Runs the build pipeline", domain: "build", category: "core", icon: "hammer", handler: noop }
			`;
			const commands = extractCommandMeta(source);
			expect(commands).toHaveLength(1);
			expect(commands[0].id).toBe("flowti:build");
			expect(commands[0].label).toBe("Build Project");
			expect(commands[0].description).toBe("Runs the build pipeline");
			expect(commands[0].domain).toBe("build");
			expect(commands[0].category).toBe("core");
			expect(commands[0].icon).toBe("hammer");
		});

		it("extracts commands from getExternalCommandMeta style", () => {
			const source = `
				function getExternalCommandMeta() {
					return [
						{ id: "flowti:ext-cmd", label: "External", description: "An ext command", domain: "ext", category: "addon", icon: "plug" }
					];
				}
			`;
			const commands = extractCommandMeta(source);
			expect(commands.length).toBeGreaterThanOrEqual(1);
			const ext = commands.find((c) => c.id === "flowti:ext-cmd");
			expect(ext).toBeDefined();
			expect(ext!.label).toBe("External");
		});

		it("deduplicates commands by id", () => {
			const source = `
				{ id: "flowti:dup", name: "Dup1", description: "First", domain: "d", category: "c", handler: noop }
				function getExternalCommandMeta() {
					return [
						{ id: "flowti:dup", label: "Dup2", description: "Second", domain: "d", category: "c" }
					];
				}
			`;
			const commands = extractCommandMeta(source);
			const dups = commands.filter((c) => c.id === "flowti:dup");
			expect(dups).toHaveLength(1);
			expect(dups[0].label).toBe("Dup1");
		});

		it("returns empty for no matches", () => {
			expect(extractCommandMeta("const x = 1;")).toEqual([]);
		});

		it("handles missing icon field", () => {
			const source = `
				{ id: "flowti:no-icon", name: "No Icon", description: "Missing icon", domain: "test", category: "core", handler: noop }
			`;
			const commands = extractCommandMeta(source);
			expect(commands).toHaveLength(1);
			expect(commands[0].icon).toBeUndefined();
		});
	});

	describe("capitalize", () => {
		it("capitalizes first letter", () => {
			expect(capitalize("hello")).toBe("Hello");
		});

		it("handles single character", () => {
			expect(capitalize("h")).toBe("H");
		});

		it("handles already capitalized", () => {
			expect(capitalize("Hello")).toBe("Hello");
		});
	});

	describe("domain grouping", () => {
		it("groups commands by domain and sorts alphabetically", () => {
			const commands: CommandMeta[] = [
				{ id: "c1", label: "Zebra", description: "", domain: "build", category: "" },
				{ id: "c2", label: "Alpha", description: "", domain: "build", category: "" },
				{ id: "c3", label: "Beta", description: "", domain: "analytics", category: "" },
			];

			const groups = new Map<string, CommandMeta[]>();
			for (const cmd of commands) {
				const existing = groups.get(cmd.domain) ?? [];
				existing.push(cmd);
				groups.set(cmd.domain, existing);
			}
			for (const [, cmds] of groups) {
				cmds.sort((a, b) => a.label.localeCompare(b.label));
			}
			const sortedDomains = Array.from(groups.keys()).sort();

			expect(sortedDomains).toEqual(["analytics", "build"]);
			expect(groups.get("build")![0].label).toBe("Alpha");
			expect(groups.get("build")![1].label).toBe("Zebra");
		});
	});
});
