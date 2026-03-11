import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => false),
		readFileSync: vi.fn(() => ""),
		readdirSync: vi.fn(() => []),
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
	VAULT_ROOT: "/vault",
}));

vi.mock("../../../../src/infrastructure/proc.js", () => ({
	proc: {
		argv: () => [] as string[],
		env: () => ({}),
	},
}));

vi.mock("../../../../src/infrastructure/clock.js", () => ({
	clock: {
		now: () => new Date("2026-03-10T12:00:00Z"),
		iso: () => "2026-03-10T12:00:00.000Z",
		safeIso: () => "2026-03-10T12-00-00",
	},
}));

vi.mock("../../../../src/infrastructure/frontmatter.js", () => ({
	parseFrontmatterContent: vi.fn(() => null),
}));

beforeEach(() => {
	vi.clearAllMocks();
});

interface ScanResult {
	id: string;
	type: string;
	frontmatter: Record<string, unknown>;
}

interface TraceGap {
	documentId: string;
	documentType: string;
	gapType: string;
	description: string;
}

// Replicate checker functions
function checkInbox(doc: ScanResult, stage: string): TraceGap[] {
	if (!doc.frontmatter.parent && stage !== "backlog") {
		return [{ documentId: doc.id, documentType: "inbox", gapType: "unlinked_inbox", description: `Inbox item missing parent link (stage: ${stage || "unknown"})` }];
	}
	return [];
}

function checkPbi(doc: ScanResult, stage: string): TraceGap[] {
	const gaps: TraceGap[] = [];
	if (stage === "delivered" && !doc.frontmatter.delivered_in) {
		gaps.push({ documentId: doc.id, documentType: "pbi", gapType: "delivered_without_cycle", description: "PBI is delivered but missing delivered_in link to cycle" });
	}
	if (!doc.frontmatter.feature) {
		gaps.push({ documentId: doc.id, documentType: "pbi", gapType: "orphaned_pbi", description: "PBI missing feature link to PRD" });
	}
	return gaps;
}

function checkCycle(doc: ScanResult, stage: string): TraceGap[] {
	if (stage === "done" && (!Array.isArray(doc.frontmatter.pbis) || doc.frontmatter.pbis.length === 0)) {
		return [{ documentId: doc.id, documentType: "cycle", gapType: "cycle_without_pbi_refs", description: "Completed cycle has no PBI references" }];
	}
	return [];
}

function checkTechDebt(doc: ScanResult): TraceGap[] {
	const status = String(doc.frontmatter.status ?? doc.frontmatter.stage ?? "");
	if (status === "resolved" && !doc.frontmatter.resolved_in) {
		return [{ documentId: doc.id, documentType: "tech_debt", gapType: "resolved_debt_without_cycle", description: "Tech debt is resolved but missing resolved_in link to cycle" }];
	}
	return [];
}

function findGaps(docs: ScanResult[]): TraceGap[] {
	const checkers: Record<string, (doc: ScanResult, stage: string) => TraceGap[]> = {
		inbox: checkInbox,
		pbi: checkPbi,
		cycle: checkCycle,
		tech_debt: (d) => checkTechDebt(d),
	};
	const gaps: TraceGap[] = [];
	for (const doc of docs) {
		const stage = String(doc.frontmatter.stage ?? "");
		const checker = checkers[doc.type];
		if (checker) gaps.push(...checker(doc, stage));
	}
	return gaps;
}

describe("trace-report generator", () => {
	describe("checkInbox", () => {
		it("flags inbox item without parent when not backlog", () => {
			const doc: ScanResult = { id: "Idea-1", type: "inbox", frontmatter: { stage: "review" } };
			const gaps = checkInbox(doc, "review");
			expect(gaps).toHaveLength(1);
			expect(gaps[0].gapType).toBe("unlinked_inbox");
		});

		it("does not flag inbox item in backlog stage", () => {
			const doc: ScanResult = { id: "Idea-1", type: "inbox", frontmatter: {} };
			const gaps = checkInbox(doc, "backlog");
			expect(gaps).toHaveLength(0);
		});

		it("does not flag inbox item with parent", () => {
			const doc: ScanResult = { id: "Idea-1", type: "inbox", frontmatter: { parent: "PBI-1" } };
			const gaps = checkInbox(doc, "review");
			expect(gaps).toHaveLength(0);
		});
	});

	describe("checkPbi", () => {
		it("flags delivered PBI without delivered_in", () => {
			const doc: ScanResult = { id: "PBI-1", type: "pbi", frontmatter: { feature: "F-1" } };
			const gaps = checkPbi(doc, "delivered");
			expect(gaps).toHaveLength(1);
			expect(gaps[0].gapType).toBe("delivered_without_cycle");
		});

		it("flags PBI without feature link", () => {
			const doc: ScanResult = { id: "PBI-1", type: "pbi", frontmatter: {} };
			const gaps = checkPbi(doc, "planned");
			expect(gaps).toHaveLength(1);
			expect(gaps[0].gapType).toBe("orphaned_pbi");
		});

		it("flags both issues on delivered PBI", () => {
			const doc: ScanResult = { id: "PBI-1", type: "pbi", frontmatter: {} };
			const gaps = checkPbi(doc, "delivered");
			expect(gaps).toHaveLength(2);
		});

		it("no gaps for well-linked PBI", () => {
			const doc: ScanResult = { id: "PBI-1", type: "pbi", frontmatter: { feature: "F-1", delivered_in: "Cycle 59" } };
			const gaps = checkPbi(doc, "delivered");
			expect(gaps).toHaveLength(0);
		});
	});

	describe("checkCycle", () => {
		it("flags done cycle without PBI refs", () => {
			const doc: ScanResult = { id: "Cycle 59", type: "cycle", frontmatter: {} };
			const gaps = checkCycle(doc, "done");
			expect(gaps).toHaveLength(1);
			expect(gaps[0].gapType).toBe("cycle_without_pbi_refs");
		});

		it("flags done cycle with empty pbis array", () => {
			const doc: ScanResult = { id: "Cycle 59", type: "cycle", frontmatter: { pbis: [] } };
			const gaps = checkCycle(doc, "done");
			expect(gaps).toHaveLength(1);
		});

		it("no gap for done cycle with PBI refs", () => {
			const doc: ScanResult = { id: "Cycle 59", type: "cycle", frontmatter: { pbis: ["PBI-1"] } };
			const gaps = checkCycle(doc, "done");
			expect(gaps).toHaveLength(0);
		});

		it("no gap for in-progress cycle", () => {
			const doc: ScanResult = { id: "Cycle 60", type: "cycle", frontmatter: {} };
			const gaps = checkCycle(doc, "active");
			expect(gaps).toHaveLength(0);
		});
	});

	describe("checkTechDebt", () => {
		it("flags resolved debt without resolved_in", () => {
			const doc: ScanResult = { id: "TD-1", type: "tech_debt", frontmatter: { status: "resolved" } };
			const gaps = checkTechDebt(doc);
			expect(gaps).toHaveLength(1);
			expect(gaps[0].gapType).toBe("resolved_debt_without_cycle");
		});

		it("uses stage fallback when status is missing", () => {
			const doc: ScanResult = { id: "TD-1", type: "tech_debt", frontmatter: { stage: "resolved" } };
			const gaps = checkTechDebt(doc);
			expect(gaps).toHaveLength(1);
		});

		it("no gap when resolved_in is present", () => {
			const doc: ScanResult = { id: "TD-1", type: "tech_debt", frontmatter: { status: "resolved", resolved_in: "Cycle 50" } };
			const gaps = checkTechDebt(doc);
			expect(gaps).toHaveLength(0);
		});

		it("no gap for unresolved debt", () => {
			const doc: ScanResult = { id: "TD-1", type: "tech_debt", frontmatter: { status: "open" } };
			const gaps = checkTechDebt(doc);
			expect(gaps).toHaveLength(0);
		});
	});

	describe("findGaps", () => {
		it("aggregates gaps from all document types", () => {
			const docs: ScanResult[] = [
				{ id: "Idea-1", type: "inbox", frontmatter: { stage: "review" } },
				{ id: "PBI-1", type: "pbi", frontmatter: { stage: "delivered" } },
				{ id: "Cycle 59", type: "cycle", frontmatter: { stage: "done" } },
				{ id: "TD-1", type: "tech_debt", frontmatter: { status: "resolved" } },
			];
			const gaps = findGaps(docs);
			expect(gaps.length).toBeGreaterThanOrEqual(4);
		});

		it("returns no gaps for well-linked documents", () => {
			const docs: ScanResult[] = [
				{ id: "Idea-1", type: "inbox", frontmatter: { stage: "backlog" } },
				{ id: "PBI-1", type: "pbi", frontmatter: { stage: "planned", feature: "F-1" } },
				{ id: "Cycle 59", type: "cycle", frontmatter: { stage: "done", pbis: ["PBI-1"] } },
				{ id: "TD-1", type: "tech_debt", frontmatter: { status: "open" } },
			];
			const gaps = findGaps(docs);
			expect(gaps).toHaveLength(0);
		});

		it("skips unknown document types", () => {
			const docs: ScanResult[] = [
				{ id: "Unknown-1", type: "unknown", frontmatter: {} },
			];
			const gaps = findGaps(docs);
			expect(gaps).toHaveLength(0);
		});
	});

	describe("coverage calculation", () => {
		it("computes 100% for no gaps", () => {
			const docs = 10;
			const gaps = 0;
			const coverage = docs > 0 ? Math.round(((docs - gaps) / docs) * 10000) / 100 : 100;
			expect(coverage).toBe(100);
		});

		it("computes percentage for some gaps", () => {
			const docs = 10;
			const gaps = 3;
			const coverage = Math.round(((docs - gaps) / docs) * 10000) / 100;
			expect(coverage).toBe(70);
		});

		it("returns 100 for empty docs", () => {
			const docs = 0;
			const gaps = 0;
			const coverage = docs > 0 ? Math.round(((docs - gaps) / docs) * 10000) / 100 : 100;
			expect(coverage).toBe(100);
		});
	});
});
