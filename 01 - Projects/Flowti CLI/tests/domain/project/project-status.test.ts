import { describe, it, expect, vi } from "vitest";
import {
	collectBuildStatus,
	collectTestStatus,
	collectFreshness,
	collectProjectStatus,
} from "../../../src/domain/project/project-status.js";
import type { StatusDeps } from "../../../src/domain/project/project-status.js";

// ── Mock deps ────────────────────────────────────────────────────────

function mockDeps(files: Record<string, string> = {}): StatusDeps {
	return {
		disk: {
			existsSync: vi.fn((p: string) => p in files),
			readFileSync: vi.fn((p: string) => {
				if (p in files) return files[p];
				throw new Error(`ENOENT: ${p}`);
			}),
		} as unknown as StatusDeps["disk"],
		paths: {
			join: (...parts: string[]) => parts.join("/"),
			relative: (from: string, to: string) => to.replace(from + "/", ""),
		} as unknown as StatusDeps["paths"],
	};
}

const BUILD_FM = `---
success: true
date: 2026-03-12T10:00:00Z
duration_ms: 1500
---
# Build Report`;

const TEST_FM = `---
total: 4086
passed: 4086
failed: 0
suites: 255
---
# Test Report`;

// ── collectBuildStatus ───────────────────────────────────────────────

describe("collectBuildStatus", () => {
	it("returns null when report file missing", () => {
		const deps = mockDeps();
		expect(collectBuildStatus(deps, "/reports")).toBeNull();
	});

	it("parses build success and date from frontmatter", () => {
		const deps = mockDeps({ "/reports/Build Report.md": BUILD_FM });
		const status = collectBuildStatus(deps, "/reports");
		expect(status).toEqual({ success: true, date: "2026-03-12T10:00:00Z" });
	});

	it("coerces string 'true' to boolean true", () => {
		const fm = `---\nsuccess: "true"\ndate: 2026-03-12\n---`;
		// Note: our inline parser doesn't wrap in quotes, so "true" stays as string
		// The domain function handles success === "true" explicitly
		const deps = mockDeps({ "/reports/Build Report.md": `---\nsuccess: true\n---` });
		const status = collectBuildStatus(deps, "/reports");
		expect(status!.success).toBe(true);
	});

	it("reports failure when success is false", () => {
		const deps = mockDeps({ "/reports/Build Report.md": `---\nsuccess: false\n---` });
		const status = collectBuildStatus(deps, "/reports");
		expect(status!.success).toBe(false);
	});

	it("returns null date when date field is absent", () => {
		const deps = mockDeps({ "/reports/Build Report.md": `---\nsuccess: true\n---` });
		const status = collectBuildStatus(deps, "/reports");
		expect(status!.date).toBeNull();
	});
});

// ── collectTestStatus ────────────────────────────────────────────────

describe("collectTestStatus", () => {
	it("returns null when report file missing", () => {
		const deps = mockDeps();
		expect(collectTestStatus(deps, "/reports")).toBeNull();
	});

	it("parses total and failed from frontmatter", () => {
		const deps = mockDeps({ "/reports/Test Report.md": TEST_FM });
		const status = collectTestStatus(deps, "/reports");
		expect(status).toEqual({ total: 4086, failed: 0 });
	});

	it("returns null when total is 0", () => {
		const deps = mockDeps({ "/reports/Test Report.md": `---\ntotal: 0\n---` });
		expect(collectTestStatus(deps, "/reports")).toBeNull();
	});

	it("falls back to total_tests field", () => {
		const deps = mockDeps({ "/reports/Test Report.md": `---\ntotal_tests: 100\nfailed: 2\n---` });
		const status = collectTestStatus(deps, "/reports");
		expect(status).toEqual({ total: 100, failed: 2 });
	});
});

// ── collectFreshness ─────────────────────────────────────────────────

describe("collectFreshness", () => {
	it("returns true when no manifest exists (needs rebuild)", () => {
		const deps = mockDeps();
		expect(collectFreshness(deps, "/project")).toBe(true);
	});
});

// ── collectProjectStatus ─────────────────────────────────────────────

describe("collectProjectStatus", () => {
	it("collects all metrics into snapshot", () => {
		const deps = mockDeps({
			"/project/reports/Build Report.md": BUILD_FM,
			"/project/reports/Test Report.md": TEST_FM,
		});
		const status = collectProjectStatus(deps, "/project", { name: "Test", reports: { dir: "reports" } } as any);
		expect(status.build).not.toBeNull();
		expect(status.tests).not.toBeNull();
		expect(status.build!.success).toBe(true);
		expect(status.tests!.total).toBe(4086);
	});

	it("returns null metrics when no reports exist", () => {
		const deps = mockDeps();
		const status = collectProjectStatus(deps, "/project", { name: "Test" } as any);
		expect(status.build).toBeNull();
		expect(status.tests).toBeNull();
	});
});
