import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

import { fixFrontmatter } from "../../../src/domain/devtools/fix-frontmatter.js";
import type { FrontmatterFixOpts } from "../../../src/domain/devtools/fix-frontmatter.js";

// ── Helpers ──────────────────────────────────────────────────────────

const DOCS_ROOT = "/vault/docs";

/**
 * A stub file that already has all fields that any fix category could add or
 * replace. When a test only cares about one specific path, all the other
 * hard-coded single-path targets (Automation PRD, PBI-003, PBI-004) will read
 * this content and be silently skipped rather than throwing ENOENT.
 */
const STUB_COMPLETE = "---\ntype: TechDebt\nstage: planned\ntitle: stub\n---\n\nStub body.";

/**
 * Build a mock deps object.
 *
 * @param files  Map of absolute path → file content.
 *               Any path NOT in this map falls back to STUB_COMPLETE so that
 *               unrelated fix categories don't pollute counts with errors.
 */
function makeDeps(files: Record<string, string> = {}) {
	const written: Record<string, string> = {};

	const disk = {
		readFileSync: vi.fn((filePath: string, _enc: string): string => {
			if (filePath in files) return files[filePath];
			// Default: a fully-populated stub so unrelated paths are skipped, not errored
			return STUB_COMPLETE;
		}),
		writeFileSync: vi.fn((filePath: string, content: string, _enc: string) => {
			written[filePath] = content;
		}),
		readdirSync: vi.fn((dir: string): string[] => {
			const prefix = dir.endsWith("/") ? dir : dir + "/";
			return Object.keys(files)
				.filter((f) => f.startsWith(prefix) && !f.slice(prefix.length).includes("/"))
				.map((f) => f.slice(prefix.length));
		}),
	};

	const paths = {
		join: (...args: string[]) => args.join("/"),
	};

	const log = vi.fn();

	return { disk, paths, log, written };
}

function makeOpts(overrides: Partial<FrontmatterFixOpts> = {}): FrontmatterFixOpts {
	return { dryRun: false, docsRoot: DOCS_ROOT, ...overrides };
}

// ── Fix 1: debt files ─────────────────────────────────────────────────

describe("fixFrontmatter — Fix 1: debt files", () => {
	beforeEach(() => { vi.clearAllMocks(); });

	it("adds type: TechDebt to a debt file that is missing the type field", () => {
		const debtFile = `${DOCS_ROOT}/debt/TD-001 Refactor auth.md`;
		const { disk, paths, log, written } = makeDeps({
			[debtFile]: "---\ntitle: Refactor auth\n---\n\nBody text.",
		});

		const result = fixFrontmatter(makeOpts(), { disk, paths, log });

		// The 3 single-path files for fixes 2/3 read STUB_COMPLETE → skipped
		expect(result.fixed).toBe(1);
		expect(result.skipped).toBe(3);
		expect(result.errors).toBe(0);
		expect(written[debtFile]).toContain("type: TechDebt");
	});

	it("skips a debt file that already has a type field", () => {
		const debtFile = `${DOCS_ROOT}/debt/TD-002 Already typed.md`;
		const { disk, paths, log } = makeDeps({
			[debtFile]: "---\ntype: TechDebt\ntitle: Already typed\n---\n\nBody.",
		});

		const result = fixFrontmatter(makeOpts(), { disk, paths, log });

		// action:"add" only fires when field is absent — unchanged → skipped
		// Plus the 3 stub single-path files = 4 total skipped
		expect(result.fixed).toBe(0);
		expect(result.skipped).toBe(4);
		expect(result.errors).toBe(0);
	});

	it("skips a debt file that has no frontmatter", () => {
		const debtFile = `${DOCS_ROOT}/debt/TD-003 No frontmatter.md`;
		const { disk, paths, log } = makeDeps({
			[debtFile]: "Just plain content, no YAML block.",
		});

		const result = fixFrontmatter(makeOpts(), { disk, paths, log });

		// The no-frontmatter debt file + 3 stub single-path files = 4 skipped
		expect(result.skipped).toBe(4);
		expect(result.fixed).toBe(0);
		expect(result.errors).toBe(0);
		const allLogs = log.mock.calls.map((c: string[]) => c[0]).join("\n");
		expect(allLogs).toContain("SKIP (no frontmatter)");
	});

	it("does not write to disk in dryRun mode but still counts as fixed", () => {
		const debtFile = `${DOCS_ROOT}/debt/TD-004 DryRun.md`;
		const { disk, paths, log, written } = makeDeps({
			[debtFile]: "---\ntitle: DryRun\n---\n\nBody.",
		});

		const result = fixFrontmatter(makeOpts({ dryRun: true }), { disk, paths, log });

		expect(result.fixed).toBe(1);
		expect(result.errors).toBe(0);
		expect(written[debtFile]).toBeUndefined();
		expect(disk.writeFileSync).not.toHaveBeenCalled();
	});

	it("counts errors when readFileSync throws for a debt file", () => {
		const debtFile = `${DOCS_ROOT}/debt/TD-005 Unreadable.md`;
		const deps = makeDeps({});

		// Pretend the debt dir has one file
		deps.disk.readdirSync.mockImplementation((dir: string) => {
			if (dir === `${DOCS_ROOT}/debt`) return ["TD-005 Unreadable.md"];
			return [];
		});
		// readFileSync always throws for that specific path; fall back to stub for others
		deps.disk.readFileSync.mockImplementation((filePath: string) => {
			if (filePath === debtFile) throw new Error("Permission denied");
			return STUB_COMPLETE;
		});

		const result = fixFrontmatter(makeOpts(), deps);

		expect(result.errors).toBe(1);
		expect(result.fixed).toBe(0);
		const allLogs = deps.log.mock.calls.map((c: string[]) => c[0]).join("\n");
		expect(allLogs).toContain("ERROR");
		expect(allLogs).toContain("Permission denied");
	});

	it("returns zero counts when all directories do not exist (readdirSync always throws)", () => {
		const deps = makeDeps({});
		// All readdirSync calls throw — listMdFiles silently returns []
		deps.disk.readdirSync.mockImplementation(() => {
			throw new Error("ENOENT: no such directory");
		});
		// Single-path processFile calls will use the stub (skipped, not errored),
		// so we need readFileSync to return the stub to keep errors at 0
		deps.disk.readFileSync.mockReturnValue(STUB_COMPLETE);

		const result = fixFrontmatter(makeOpts(), deps);

		expect(result.fixed).toBe(0);
		// 3 single-path stubs (PRD + PBI-003 + PBI-004) are skipped
		expect(result.skipped).toBe(3);
		expect(result.errors).toBe(0);
	});
});

// ── Fix 2: Automation PRD ─────────────────────────────────────────────

describe("fixFrontmatter — Fix 2: Automation PRD", () => {
	beforeEach(() => { vi.clearAllMocks(); });

	it("adds stage: idea to the Automation PRD when the field is missing", () => {
		const prdFile = `${DOCS_ROOT}/features/Automation/Automation PRD.md`;
		const { disk, paths, log, written } = makeDeps({
			[prdFile]: "---\ntitle: Automation PRD\n---\n\nBody.",
		});

		const result = fixFrontmatter(makeOpts(), { disk, paths, log });

		expect(result.errors).toBe(0);
		expect(written[prdFile]).toContain("stage: idea");
	});

	it("skips Automation PRD when stage is already present", () => {
		const prdFile = `${DOCS_ROOT}/features/Automation/Automation PRD.md`;
		const { disk, paths, log, written } = makeDeps({
			[prdFile]: "---\ntitle: Automation PRD\nstage: discovery\n---\n\nBody.",
		});

		const result = fixFrontmatter(makeOpts(), { disk, paths, log });

		// action:"add" never overwrites an existing field
		expect(result.errors).toBe(0);
		expect(written[prdFile]).toBeUndefined();
	});
});

// ── Fix 3: Hubs PBIs ──────────────────────────────────────────────────

describe("fixFrontmatter — Fix 3: Hubs PBIs", () => {
	beforeEach(() => { vi.clearAllMocks(); });

	it("adds stage: idea to PBI-003 when the field is missing", () => {
		const pbi003 = `${DOCS_ROOT}/features/Hubs/backlog/PBI-003 Product Hub.md`;
		const { disk, paths, log, written } = makeDeps({
			[pbi003]: "---\ntitle: Product Hub\n---\n\nBody.",
		});

		const result = fixFrontmatter(makeOpts(), { disk, paths, log });

		expect(result.errors).toBe(0);
		expect(written[pbi003]).toContain("stage: idea");
	});

	it("adds stage: idea to PBI-004 when the field is missing", () => {
		const pbi004 = `${DOCS_ROOT}/features/Hubs/backlog/PBI-004 Project Hub.md`;
		const { disk, paths, log, written } = makeDeps({
			[pbi004]: "---\ntitle: Project Hub\n---\n\nBody.",
		});

		const result = fixFrontmatter(makeOpts(), { disk, paths, log });

		expect(result.errors).toBe(0);
		expect(written[pbi004]).toContain("stage: idea");
	});

	it("skips PBI-003 that already has a stage field", () => {
		const pbi003 = `${DOCS_ROOT}/features/Hubs/backlog/PBI-003 Product Hub.md`;
		const { disk, paths, log, written } = makeDeps({
			[pbi003]: "---\ntitle: Product Hub\nstage: planned\n---\n\nBody.",
		});

		const result = fixFrontmatter(makeOpts(), { disk, paths, log });

		// action:"add" leaves the field alone → file unchanged → not written
		expect(result.errors).toBe(0);
		expect(written[pbi003]).toBeUndefined();
		const allLogs = log.mock.calls.map((c: string[]) => c[0]).join("\n");
		expect(allLogs).not.toContain("ADD stage");
	});
});

// ── Fix 4: Feature Lifecycle backlog ─────────────────────────────────

describe("fixFrontmatter — Fix 4: Feature Lifecycle backlog", () => {
	beforeEach(() => { vi.clearAllMocks(); });

	it("replaces the stage field value to planned in an FL backlog file", () => {
		const flFile = `${DOCS_ROOT}/features/Feature Lifecycle/backlog/PBI-001 Something.md`;
		const { disk, paths, log, written } = makeDeps({
			[flFile]: "---\ntitle: Something\nstage: draft\n---\n\nBody.",
		});

		const result = fixFrontmatter(makeOpts(), { disk, paths, log });

		expect(result.errors).toBe(0);
		expect(written[flFile]).toContain("stage: planned");
	});

	it("skips FL backlog files that are already at planned", () => {
		const flFile = `${DOCS_ROOT}/features/Feature Lifecycle/backlog/PBI-002 Already.md`;
		const { disk, paths, log, written } = makeDeps({
			[flFile]: "---\ntitle: Already\nstage: planned\n---\n\nBody.",
		});

		const result = fixFrontmatter(makeOpts(), { disk, paths, log });

		// action:"replace" with the same value → unchanged → not written
		expect(result.errors).toBe(0);
		expect(written[flFile]).toBeUndefined();
	});

	it("processes multiple FL backlog files in one pass", () => {
		const fl1 = `${DOCS_ROOT}/features/Feature Lifecycle/backlog/PBI-010 Alpha.md`;
		const fl2 = `${DOCS_ROOT}/features/Feature Lifecycle/backlog/PBI-011 Beta.md`;
		const { disk, paths, log, written } = makeDeps({
			[fl1]: "---\ntitle: Alpha\nstage: draft\n---\n\nBody.",
			[fl2]: "---\ntitle: Beta\nstage: idea\n---\n\nBody.",
		});

		const result = fixFrontmatter(makeOpts(), { disk, paths, log });

		expect(result.errors).toBe(0);
		expect(result.fixed).toBeGreaterThanOrEqual(2);
		expect(written[fl1]).toContain("stage: planned");
		expect(written[fl2]).toContain("stage: planned");
	});
});

// ── All 4 fix categories in a single run ─────────────────────────────

describe("fixFrontmatter — processes all 4 fix categories", () => {
	it("applies fixes across debt, automation PRD, hubs PBIs, and FL backlog in one call", () => {
		const debtFile = `${DOCS_ROOT}/debt/TD-099 Multi-test.md`;
		const prdFile = `${DOCS_ROOT}/features/Automation/Automation PRD.md`;
		const pbi003 = `${DOCS_ROOT}/features/Hubs/backlog/PBI-003 Product Hub.md`;
		const pbi004 = `${DOCS_ROOT}/features/Hubs/backlog/PBI-004 Project Hub.md`;
		const flFile = `${DOCS_ROOT}/features/Feature Lifecycle/backlog/PBI-001 FL Item.md`;

		const { disk, paths, log, written } = makeDeps({
			[debtFile]: "---\ntitle: Multi-test\n---\n\nBody.",
			[prdFile]: "---\ntitle: Automation PRD\n---\n\nBody.",
			[pbi003]: "---\ntitle: Product Hub\n---\n\nBody.",
			[pbi004]: "---\ntitle: Project Hub\n---\n\nBody.",
			[flFile]: "---\ntitle: FL Item\nstage: draft\n---\n\nBody.",
		});

		const result = fixFrontmatter(makeOpts(), { disk, paths, log });

		expect(result.fixed).toBe(5);
		expect(result.skipped).toBe(0);
		expect(result.errors).toBe(0);

		expect(written[debtFile]).toContain("type: TechDebt");
		expect(written[prdFile]).toContain("stage: idea");
		expect(written[pbi003]).toContain("stage: idea");
		expect(written[pbi004]).toContain("stage: idea");
		expect(written[flFile]).toContain("stage: planned");
	});
});
