/**
 * Journey 1: Import External Notes into Obsidian
 *
 * Persona: The Researcher (Alex)
 * @see docs/journeys/journey-1-import-external-notes.md
 */

import { describe, it, expect, vi } from "vitest";

// Mock LogService
vi.mock("../../src/services/LogService", () => ({
	LogService: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

import {
	isTempFile,
	isAllowedByExtensions,
	matchesExcludePattern,
	createIgnoredMatcher,
	validateSourcePath,
	validateTargetPath,
} from "../../src/utils";
import { ConflictResolver } from "../../src/services/ConflictResolver";
import { SyncStateService } from "../../src/services/SyncStateService";
import {
	createMockVaultAdapter,
	createMockVault,
	createMockApp as createMockAppFactory,
	createMockMapping,
} from "../mocks/factories";

describe("Journey 1: Import External Notes into Obsidian", () => {

	it("Happy path: file passes filter pipeline → validates → resolves conflict → records state → skips on re-check", async () => {
		// --- Step 1: Set up a source-only mapping ---
		const mapping = createMockMapping({
			id: "import-notes",
			sourceFolder: "/external/notes",
			targetFolder: "vault/imported",
			syncDirection: "source-only",
			fileExtensions: [".md", ".txt"],
			excludePatterns: ["*.log", "build/**"],
			conflictResolution: "overwrite",
		});

		// --- Step 2: A new file appears ---
		const sourceFile = "/external/notes/report.md";
		const targetFile = "vault/imported/report.md";

		// --- Step 3: Filter out temp files and dotfiles ---
		const ignoredMatcher = createIgnoredMatcher(true);
		expect(ignoredMatcher("~$report.docx")).toBe(true);   // Office lock → filtered
		expect(ignoredMatcher(".DS_Store")).toBe(true);         // macOS system → filtered
		expect(ignoredMatcher("report.md")).toBe(false);        // Our file → passes

		// --- Step 4: Extension filter allows .md but blocks .exe ---
		expect(isAllowedByExtensions("report.md", mapping.fileExtensions!)).toBe(true);
		expect(isAllowedByExtensions("malware.exe", mapping.fileExtensions!)).toBe(false);

		// Exclude patterns block .log and build/ files
		expect(matchesExcludePattern("debug.log", mapping.excludePatterns!)).toBe(true);
		expect(matchesExcludePattern("build/output/bundle.js", mapping.excludePatterns!)).toBe(true);
		expect(matchesExcludePattern("report.md", mapping.excludePatterns!)).toBe(false);

		// --- Step 5: Path validation ---
		expect(() => validateSourcePath(sourceFile, mapping.sourceFolder)).not.toThrow();
		expect(() => validateTargetPath(targetFile, mapping.targetFolder)).not.toThrow();

		// --- Step 6: Conflict resolution (first sync → overwrite) ---
		const adapter = createMockVaultAdapter();
		const vault = createMockVault(adapter);
		const app = createMockAppFactory(vault);
		const resolver = new ConflictResolver(app as any);

		const decision = await resolver.resolveForward(mapping, sourceFile, targetFile);
		expect(decision.action).toBe("overwrite");
		expect(decision.targetPath).toBe(targetFile);

		// --- Step 7 & 8: Sync state records the file ---
		const syncState = new SyncStateService(
			{ vault: { adapter: { basePath: "/tmp" } } } as any,
			"test",
		);
		syncState.recordSync("import-notes", "/external/notes", "report.md", {
			mtimeMs: 1700000000000,
			size: 2048,
		});

		// --- Step 9: Subsequent re-check skips unchanged file ---
		expect(
			syncState.needsSync("import-notes", "/external/notes", "report.md", {
				mtimeMs: 1700000000000,
				size: 2048,
			}),
		).toBe(false);

		// A modified version IS detected
		expect(
			syncState.needsSync("import-notes", "/external/notes", "report.md", {
				mtimeMs: 1700000001000,
				size: 2100,
			}),
		).toBe(true);
	});

	it("Rejects files that fail the filter pipeline", () => {
		const mapping = createMockMapping({
			fileExtensions: [".md"],
			excludePatterns: ["node_modules"],
		});

		// Temp file → rejected at step 3
		expect(isTempFile("~$document.docx")).toBe(true);

		// Wrong extension → rejected at step 4
		expect(isAllowedByExtensions("image.png", mapping.fileExtensions!)).toBe(false);

		// Excluded pattern → rejected at step 4
		expect(matchesExcludePattern("node_modules/pkg/index.js", mapping.excludePatterns!)).toBe(true);
	});
});
