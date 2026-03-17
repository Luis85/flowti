// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { scanEntityFolder, type EntityScanConfig, type RawScanEntry, type ScanContext } from "../../../src/ui/catalog/entityScanner";
import { createMockCatalogDeps, createDefaultCatalogState } from "./testHelpers";
import type { CatalogComponentDeps } from "../../../src/ui/catalog/types";
import { TFile, createMockTFile, createMockTFolder } from "../../mocks/obsidian-stub";

// ── Helpers ──────────────────────────────────────────────

interface SimpleEntry {
	name: string;
	description: string;
	events: string[];
	domains: string[];
	services: string[];
	filePath: string;
}

function simpleConfig(overrides?: Partial<EntityScanConfig<SimpleEntry>>): EntityScanConfig<SimpleEntry> {
	return {
		entityType: "flows",
		nameFields: ["flow", "name"],
		docType: "FlowDoc",
		normalizeNameKey: "flow",
		mapEntry: (raw: RawScanEntry) => ({
			name: raw.name,
			description: raw.description,
			events: raw.events,
			domains: raw.domains,
			services: raw.services,
			filePath: raw.filePath,
		}),
		...overrides,
	};
}

function setupDepsWithFolder(
	folderPath: string,
	files: TFile[],
	frontmatterMap: Record<string, Record<string, unknown> | undefined>,
): CatalogComponentDeps {
	const folder = createMockTFolder(folderPath, files);

	const deps = createMockCatalogDeps({
		getEntityFolder: vi.fn(() => folderPath),
	});

	(deps.app.vault.getAbstractFileByPath as ReturnType<typeof vi.fn>)
		.mockImplementation((p: string) => (p === folderPath ? folder : null));

	(deps.vaultQuery.getFrontmatter as ReturnType<typeof vi.fn>)
		.mockImplementation((p: string) => frontmatterMap[p] ?? undefined);

	return deps;
}

// ── Tests ────────────────────────────────────────────────

describe("scanEntityFolder", () => {
	describe("folder resolution", () => {
		it("should return empty when folder does not exist", () => {
			const deps = createMockCatalogDeps({
				getEntityFolder: vi.fn(() => "docs/Flows"),
			});
			// vault returns null for missing folder
			const result = scanEntityFolder(simpleConfig(), deps);
			expect(result.entries).toEqual([]);
			expect(result.nonConforming).toEqual([]);
		});

		it("should return empty when path resolves to a file not a folder", () => {
			const file = createMockTFile("docs/Flows.md", "Flows");
			const deps = createMockCatalogDeps({
				getEntityFolder: vi.fn(() => "docs/Flows.md"),
			});
			(deps.app.vault.getAbstractFileByPath as ReturnType<typeof vi.fn>)
				.mockReturnValue(file);

			const result = scanEntityFolder(simpleConfig(), deps);
			expect(result.entries).toEqual([]);
		});
	});

	describe("file filtering", () => {
		it("should skip non-md files", () => {
			const mdFile = createMockTFile("docs/Flows/flow1.md", "flow1");
			const txtFile = createMockTFile("docs/Flows/notes.txt", "notes", "txt");

			const deps = setupDepsWithFolder("docs/Flows", [mdFile, txtFile], {
				"docs/Flows/flow1.md": { type: "FlowDoc", flow: "Flow One", description: "desc" },
			});

			const result = scanEntityFolder(simpleConfig(), deps);
			expect(result.entries).toHaveLength(1);
			expect(result.entries[0].name).toBe("Flow One");
		});

		it("should skip non-TFile children (subfolders)", () => {
			const mdFile = createMockTFile("docs/Flows/flow1.md", "flow1");
			const subfolder = createMockTFolder("docs/Flows/sub", []);

			const deps = setupDepsWithFolder("docs/Flows", [mdFile, subfolder] as TFile[], {
				"docs/Flows/flow1.md": { type: "FlowDoc", flow: "Flow One" },
			});

			const result = scanEntityFolder(simpleConfig(), deps);
			expect(result.entries).toHaveLength(1);
		});
	});

	describe("name resolution", () => {
		it("should use first matching nameField from frontmatter", () => {
			const file = createMockTFile("docs/Flows/test.md", "test");
			const deps = setupDepsWithFolder("docs/Flows", [file], {
				"docs/Flows/test.md": { type: "FlowDoc", flow: "Primary Name", name: "Fallback Name" },
			});

			const result = scanEntityFolder(simpleConfig(), deps);
			expect(result.entries[0].name).toBe("Primary Name");
		});

		it("should fall back to second nameField if first is missing", () => {
			const file = createMockTFile("docs/Flows/test.md", "test");
			const deps = setupDepsWithFolder("docs/Flows", [file], {
				"docs/Flows/test.md": { type: "FlowDoc", name: "Fallback Name" },
			});

			const result = scanEntityFolder(simpleConfig(), deps);
			expect(result.entries[0].name).toBe("Fallback Name");
		});

		it("should fall back to file basename if no nameFields match", () => {
			const file = createMockTFile("docs/Flows/my-flow.md", "my-flow");
			const deps = setupDepsWithFolder("docs/Flows", [file], {
				"docs/Flows/my-flow.md": { type: "FlowDoc", description: "no name field" },
			});

			const result = scanEntityFolder(simpleConfig(), deps);
			expect(result.entries[0].name).toBe("my-flow");
		});

		it("should fall back to basename when frontmatter is undefined", () => {
			const file = createMockTFile("docs/Flows/orphan.md", "orphan");
			const deps = setupDepsWithFolder("docs/Flows", [file], {
				"docs/Flows/orphan.md": undefined,
			});

			const result = scanEntityFolder(simpleConfig(), deps);
			expect(result.entries[0].name).toBe("orphan");
		});
	});

	describe("frontmatter extraction", () => {
		it("should extract description from frontmatter", () => {
			const file = createMockTFile("docs/Flows/f.md", "f");
			const deps = setupDepsWithFolder("docs/Flows", [file], {
				"docs/Flows/f.md": { type: "FlowDoc", flow: "F", description: "A flow" },
			});

			const result = scanEntityFolder(simpleConfig(), deps);
			expect(result.entries[0].description).toBe("A flow");
		});

		it("should default description to empty string when missing", () => {
			const file = createMockTFile("docs/Flows/f.md", "f");
			const deps = setupDepsWithFolder("docs/Flows", [file], {
				"docs/Flows/f.md": { type: "FlowDoc", flow: "F" },
			});

			const result = scanEntityFolder(simpleConfig(), deps);
			expect(result.entries[0].description).toBe("");
		});

		it("should extract events array from frontmatter", () => {
			const file = createMockTFile("docs/Flows/f.md", "f");
			const deps = setupDepsWithFolder("docs/Flows", [file], {
				"docs/Flows/f.md": { type: "FlowDoc", flow: "F", events: ["e1", "e2"] },
			});

			const result = scanEntityFolder(simpleConfig(), deps);
			expect(result.entries[0].events).toEqual(["e1", "e2"]);
		});

		it("should default events to empty array when missing", () => {
			const file = createMockTFile("docs/Flows/f.md", "f");
			const deps = setupDepsWithFolder("docs/Flows", [file], {
				"docs/Flows/f.md": { type: "FlowDoc", flow: "F" },
			});

			const result = scanEntityFolder(simpleConfig(), deps);
			expect(result.entries[0].events).toEqual([]);
		});

		it("should extract domains array from frontmatter", () => {
			const file = createMockTFile("docs/Flows/f.md", "f");
			const deps = setupDepsWithFolder("docs/Flows", [file], {
				"docs/Flows/f.md": { type: "FlowDoc", flow: "F", domains: ["d1"] },
			});

			const result = scanEntityFolder(simpleConfig(), deps);
			expect(result.entries[0].domains).toEqual(["d1"]);
		});

		it("should extract services array from frontmatter", () => {
			const file = createMockTFile("docs/Flows/f.md", "f");
			const deps = setupDepsWithFolder("docs/Flows", [file], {
				"docs/Flows/f.md": { type: "FlowDoc", flow: "F", services: ["s1", "s2"] },
			});

			const result = scanEntityFolder(simpleConfig(), deps);
			expect(result.entries[0].services).toEqual(["s1", "s2"]);
		});
	});

	describe("readEvents flag", () => {
		it("should skip events when readEvents is false", () => {
			const file = createMockTFile("docs/Systems/s.md", "s");
			const deps = setupDepsWithFolder("docs/Systems", [file], {
				"docs/Systems/s.md": { type: "SystemDoc", name: "S", events: ["should.be.ignored"] },
			});

			const config = simpleConfig({
				entityType: "systems",
				nameFields: ["name"],
				docType: "SystemDoc",
				normalizeNameKey: "system",
				readEvents: false,
			});

			const result = scanEntityFolder(config, deps);
			expect(result.entries[0].events).toEqual([]);
		});
	});

	describe("extra fields", () => {
		it("should merge extraDomainFields into domains", () => {
			const file = createMockTFile("docs/Flows/f.md", "f");
			const deps = setupDepsWithFolder("docs/Flows", [file], {
				"docs/Flows/f.md": { type: "FlowDoc", flow: "F", domains: ["d1"], linkedDomains: ["d2"] },
			});

			const config = simpleConfig({ extraDomainFields: ["linkedDomains"] });
			const result = scanEntityFolder(config, deps);
			expect(result.entries[0].domains).toEqual(["d1", "d2"]);
		});

		it("should merge extraServiceFields into services", () => {
			const file = createMockTFile("docs/Flows/f.md", "f");
			const deps = setupDepsWithFolder("docs/Flows", [file], {
				"docs/Flows/f.md": { type: "FlowDoc", flow: "F", services: ["s1"], Systems: ["sys1"] },
			});

			const config = simpleConfig({ extraServiceFields: ["Systems"] });
			const result = scanEntityFolder(config, deps);
			expect(result.entries[0].services).toEqual(["s1", "sys1"]);
		});
	});

	describe("non-conforming files", () => {
		it("should flag files without the expected docType", () => {
			const file = createMockTFile("docs/Flows/bad.md", "bad");
			const deps = setupDepsWithFolder("docs/Flows", [file], {
				"docs/Flows/bad.md": { type: "SomeOtherType", flow: "Bad" },
			});

			const result = scanEntityFolder(simpleConfig(), deps);
			expect(result.nonConforming).toHaveLength(1);
			expect(result.nonConforming[0].docType).toBe("FlowDoc");
			expect(result.nonConforming[0].name).toBe("Bad");
		});

		it("should flag files with no frontmatter", () => {
			const file = createMockTFile("docs/Flows/empty.md", "empty");
			const deps = setupDepsWithFolder("docs/Flows", [file], {
				"docs/Flows/empty.md": undefined,
			});

			const result = scanEntityFolder(simpleConfig(), deps);
			expect(result.nonConforming).toHaveLength(1);
			expect(result.nonConforming[0].name).toBe("empty");
		});

		it("should NOT flag conforming files", () => {
			const file = createMockTFile("docs/Flows/good.md", "good");
			const deps = setupDepsWithFolder("docs/Flows", [file], {
				"docs/Flows/good.md": { type: "FlowDoc", flow: "Good" },
			});

			const result = scanEntityFolder(simpleConfig(), deps);
			expect(result.nonConforming).toHaveLength(0);
		});
	});

	describe("sorting", () => {
		it("should sort entries alphabetically by name", () => {
			const fileC = createMockTFile("docs/Flows/c.md", "c");
			const fileA = createMockTFile("docs/Flows/a.md", "a");
			const fileB = createMockTFile("docs/Flows/b.md", "b");

			const deps = setupDepsWithFolder("docs/Flows", [fileC, fileA, fileB], {
				"docs/Flows/c.md": { type: "FlowDoc", flow: "Charlie" },
				"docs/Flows/a.md": { type: "FlowDoc", flow: "Alpha" },
				"docs/Flows/b.md": { type: "FlowDoc", flow: "Bravo" },
			});

			const result = scanEntityFolder(simpleConfig(), deps);
			expect(result.entries.map((e) => e.name)).toEqual(["Alpha", "Bravo", "Charlie"]);
		});
	});

	describe("mapEntry callback", () => {
		it("should receive ScanContext with entryMap and allEntries", () => {
			const file = createMockTFile("docs/Flows/f.md", "f");
			const deps = setupDepsWithFolder("docs/Flows", [file], {
				"docs/Flows/f.md": { type: "FlowDoc", flow: "F" },
			});

			let capturedContext: ScanContext | undefined;
			const config = simpleConfig({
				mapEntry: (raw, ctx) => {
					capturedContext = ctx;
					return {
						name: raw.name,
						description: raw.description,
						events: raw.events,
						domains: raw.domains,
						services: raw.services,
						filePath: raw.filePath,
					};
				},
			});

			scanEntityFolder(config, deps);
			expect(capturedContext).toBeDefined();
			expect(capturedContext!.entryMap).toBeInstanceOf(Map);
			expect(Array.isArray(capturedContext!.allEntries)).toBe(true);
		});
	});

	describe("multiple files", () => {
		it("should scan all valid md files in folder", () => {
			const f1 = createMockTFile("docs/Flows/one.md", "one");
			const f2 = createMockTFile("docs/Flows/two.md", "two");
			const f3 = createMockTFile("docs/Flows/three.md", "three");

			const deps = setupDepsWithFolder("docs/Flows", [f1, f2, f3], {
				"docs/Flows/one.md": { type: "FlowDoc", flow: "One" },
				"docs/Flows/two.md": { type: "FlowDoc", flow: "Two" },
				"docs/Flows/three.md": { type: "FlowDoc", flow: "Three" },
			});

			const result = scanEntityFolder(simpleConfig(), deps);
			expect(result.entries).toHaveLength(3);
			expect(result.entries.map((e) => e.name)).toEqual(["One", "Three", "Two"]);
		});
	});
});
