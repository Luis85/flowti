import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "", BLUE: "", MAGENTA: "", WHITE: "", UNDERLINE: "",
	printHeader: vi.fn(), printSection: vi.fn(), printDivider: vi.fn(),
}));

import { log } from "../../../src/infrastructure/logger.js";
import {
	renderFreshnessCheck,
	renderBuildAuto,
	renderBuildRecorded,
	renderWorkflowPreview,
	renderCiDryRun,
	renderCiWritten,
} from "../../../src/ui/displays/build-display.js";
import type { FreshnessCheck, BuildManifest } from "../../../src/domain/build/build-freshness.js";
import type { BuildAutoModel, BuildRecordedModel } from "../../../src/ui/displays/build-display.js";

const mockLog = log as ReturnType<typeof vi.fn>;
const output = () => mockLog.mock.calls.map((c: unknown[]) => c[0] ?? "").join("\n");

beforeEach(() => { mockLog.mockClear(); });

// ── renderFreshnessCheck ─────────────────────────────────────────────

describe("renderFreshnessCheck", () => {
	it("renders up-to-date message when no rebuild needed", () => {
		const check: FreshnessCheck = {
			needsRebuild: false, reason: "Build is up to date.",
			added: [], removed: [], modified: [], currentHash: "abc", manifestHash: "abc",
		};
		renderFreshnessCheck(check, log);
		expect(output()).toContain("Build is up to date.");
		expect(output()).toContain("✓");
	});

	it("renders warning when rebuild needed with no file details", () => {
		const check: FreshnessCheck = {
			needsRebuild: true, reason: "No build manifest found.",
			added: [], removed: [], modified: [], currentHash: "abc", manifestHash: null,
		};
		renderFreshnessCheck(check, log);
		expect(output()).toContain("⚠");
		expect(output()).toContain("No build manifest found.");
	});

	it("renders added files", () => {
		const check: FreshnessCheck = {
			needsRebuild: true, reason: "Source changes detected: 1 added.",
			added: ["foo.ts"], removed: [], modified: [], currentHash: "abc", manifestHash: "def",
		};
		renderFreshnessCheck(check, log);
		expect(output()).toContain("Added:");
		expect(output()).toContain("foo.ts");
	});

	it("renders modified files", () => {
		const check: FreshnessCheck = {
			needsRebuild: true, reason: "Changes.",
			added: [], removed: [], modified: ["bar.ts"], currentHash: "a", manifestHash: "b",
		};
		renderFreshnessCheck(check, log);
		expect(output()).toContain("Modified:");
		expect(output()).toContain("bar.ts");
	});

	it("renders removed files", () => {
		const check: FreshnessCheck = {
			needsRebuild: true, reason: "Changes.",
			added: [], removed: ["old.ts"], modified: [], currentHash: "a", manifestHash: "b",
		};
		renderFreshnessCheck(check, log);
		expect(output()).toContain("Removed:");
		expect(output()).toContain("old.ts");
	});

	it("renders all three file lists together", () => {
		const check: FreshnessCheck = {
			needsRebuild: true, reason: "Changes.",
			added: ["a.ts"], removed: ["b.ts"], modified: ["c.ts"], currentHash: "a", manifestHash: "b",
		};
		renderFreshnessCheck(check, log);
		const out = output();
		expect(out).toContain("Added:");
		expect(out).toContain("Modified:");
		expect(out).toContain("Removed:");
	});

	it("joins multiple files with commas", () => {
		const check: FreshnessCheck = {
			needsRebuild: true, reason: "Changes.",
			added: ["x.ts", "y.ts"], removed: [], modified: [], currentHash: "a", manifestHash: "b",
		};
		renderFreshnessCheck(check, log);
		expect(output()).toContain("x.ts, y.ts");
	});
});

// ── renderBuildAuto ──────────────────────────────────────────────────

describe("renderBuildAuto", () => {
	it("renders skip message when up to date", () => {
		const data: BuildAutoModel = {
			check: { needsRebuild: false, reason: "Up to date.", added: [], removed: [], modified: [], currentHash: "a", manifestHash: "a" },
			buildRan: false,
			manifest: null,
		};
		renderBuildAuto(data, log);
		expect(output()).toContain("Build is up to date — skipping.");
	});

	it("renders reason when rebuild needed", () => {
		const data: BuildAutoModel = {
			check: { needsRebuild: true, reason: "Source changes detected.", added: [], removed: [], modified: [], currentHash: "a", manifestHash: "b" },
			buildRan: false,
			manifest: null,
		};
		renderBuildAuto(data, log);
		expect(output()).toContain("Source changes detected.");
	});

	it("renders manifest saved when build ran with manifest", () => {
		const manifest: BuildManifest = { builtAt: "2026-01-01", sourceHash: "abc", fileCount: 42, files: {} };
		const data: BuildAutoModel = {
			check: { needsRebuild: true, reason: "Rebuild.", added: [], removed: [], modified: [], currentHash: "a", manifestHash: "b" },
			buildRan: true,
			manifest,
		};
		renderBuildAuto(data, log);
		expect(output()).toContain("42 files hashed");
		expect(output()).toContain("Build manifest saved");
	});

	it("does not render manifest line when buildRan is false", () => {
		const data: BuildAutoModel = {
			check: { needsRebuild: true, reason: "Rebuild.", added: [], removed: [], modified: [], currentHash: "a", manifestHash: "b" },
			buildRan: false,
			manifest: null,
		};
		renderBuildAuto(data, log);
		expect(output()).not.toContain("Build manifest saved");
	});

	it("does not render manifest line when manifest is null", () => {
		const data: BuildAutoModel = {
			check: { needsRebuild: true, reason: "Rebuild.", added: [], removed: [], modified: [], currentHash: "a", manifestHash: "b" },
			buildRan: true,
			manifest: null,
		};
		renderBuildAuto(data, log);
		expect(output()).not.toContain("Build manifest saved");
	});
});

// ── renderBuildRecorded ──────────────────────────────────────────────

describe("renderBuildRecorded", () => {
	it("renders file count and hash prefix", () => {
		const data: BuildRecordedModel = { fileCount: 10, hashPrefix: "abc123" };
		renderBuildRecorded(data, log);
		expect(output()).toContain("10 files");
		expect(output()).toContain("abc123");
		expect(output()).toContain("Build manifest recorded");
	});
});

// ── renderWorkflowPreview ────────────────────────────────────────────

describe("renderWorkflowPreview", () => {
	it("renders yaml lines with pipe prefix", () => {
		renderWorkflowPreview("name: ci\nsteps:\n  - run: test", log);
		const out = output();
		expect(out).toContain("Generated CI workflow:");
		expect(out).toContain("│");
		expect(out).toContain("name: ci");
		expect(out).toContain("steps:");
	});

	it("handles single-line yaml", () => {
		renderWorkflowPreview("on: push", log);
		expect(output()).toContain("on: push");
	});
});

// ── renderCiDryRun ───────────────────────────────────────────────────

describe("renderCiDryRun", () => {
	it("renders preview and dry-run notice", () => {
		renderCiDryRun("name: ci", log);
		const out = output();
		expect(out).toContain("Generated CI workflow:");
		expect(out).toContain("Dry run");
		expect(out).toContain("no files written");
	});
});

// ── renderCiWritten ──────────────────────────────────────────────────

describe("renderCiWritten", () => {
	it("renders preview and output path", () => {
		renderCiWritten("name: ci", ".github/workflows/ci.yml", log);
		const out = output();
		expect(out).toContain("Generated CI workflow:");
		expect(out).toContain("Wrote");
		expect(out).toContain(".github/workflows/ci.yml");
	});
});
