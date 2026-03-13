import { describe, it, expect } from "vitest";
import { validateProjectConfig } from "../../../src/domain/project/config-schema.js";

// ── Helpers ──────────────────────────────────────────────────────────

function valid(overrides: Record<string, unknown> = {}) {
	return { name: "ReviewTest", ...overrides };
}

function fullReview(overrides: Record<string, unknown> = {}) {
	return {
		journeysDir: "tests/e2e",
		target: "obsidian-plugin",
		capabilities: ["dom-interaction", "events"],
		sequencer: "risk-priority",
		bail: 3,
		timeout: 60000,
		hookTimeout: 5000,
		parallel: true,
		stepFilter: "login-*",
		evidenceDir: "docs/evidence",
		screenshots: true,
		logs: true,
		traces: false,
		retainRuns: 10,
		gates: {
			coverage: { requirementCoverage: 80, journeyCoverage: 70, statementCoverage: 60 },
			security: { required: true, maxCritical: 0, maxHigh: 2 },
			risk: { criticalMustPass: true, highMustPass: false },
			release: { allGatesMustPass: true, requireApproval: false },
		},
		...overrides,
	};
}

// ── review section — extended fields ─────────────────────────────────

describe("validateProjectConfig — review (extended)", () => {
	describe("valid review config with all fields", () => {
		it("produces no errors and no warnings", () => {
			const { errors, warnings } = validateProjectConfig(valid({ review: fullReview() }));
			expect(errors).toEqual([]);
			expect(warnings).toEqual([]);
		});

		it("accepts minimal review with only journeysDir", () => {
			const { errors, warnings } = validateProjectConfig(valid({ review: { journeysDir: "e2e" } }));
			expect(errors).toEqual([]);
			expect(warnings).toEqual([]);
		});

		it("accepts empty review object", () => {
			const { errors, warnings } = validateProjectConfig(valid({ review: {} }));
			expect(errors).toEqual([]);
			expect(warnings).toEqual([]);
		});
	});

	// ── review.target ────────────────────────────────────────────

	describe("review.target", () => {
		it("accepts all valid targets", () => {
			for (const t of ["cli", "obsidian-vault", "obsidian-plugin", "typescript", "webapp"]) {
				const { warnings } = validateProjectConfig(valid({ review: { target: t } }));
				expect(warnings).toEqual([]);
			}
		});

		it("warns on invalid target string", () => {
			const { warnings } = validateProjectConfig(valid({ review: { target: "python" } }));
			expect(warnings).toContainEqual(expect.stringContaining('"review.target" must be one of'));
		});

		it("warns on non-string target", () => {
			const { warnings } = validateProjectConfig(valid({ review: { target: 42 } }));
			expect(warnings).toContainEqual(expect.stringContaining('"review.target" must be one of'));
		});
	});

	// ── review.sequencer ─────────────────────────────────────────

	describe("review.sequencer", () => {
		it("accepts all valid sequencers", () => {
			for (const s of ["alphabetical", "risk-priority", "chapter-order"]) {
				const { warnings } = validateProjectConfig(valid({ review: { sequencer: s } }));
				expect(warnings).toEqual([]);
			}
		});

		it("warns on invalid sequencer", () => {
			const { warnings } = validateProjectConfig(valid({ review: { sequencer: "random" } }));
			expect(warnings).toContainEqual(expect.stringContaining('"review.sequencer" must be one of'));
		});

		it("warns on non-string sequencer", () => {
			const { warnings } = validateProjectConfig(valid({ review: { sequencer: true } }));
			expect(warnings).toContainEqual(expect.stringContaining('"review.sequencer" must be one of'));
		});
	});

	// ── review.capabilities ──────────────────────────────────────

	describe("review.capabilities", () => {
		it("accepts an array of strings", () => {
			const { warnings } = validateProjectConfig(valid({ review: { capabilities: ["dom", "events"] } }));
			expect(warnings).toEqual([]);
		});

		it("warns on non-array capabilities", () => {
			const { warnings } = validateProjectConfig(valid({ review: { capabilities: "dom" } }));
			expect(warnings).toContainEqual(expect.stringContaining('"review.capabilities" must be an array'));
		});
	});

	// ── review number/boolean/string type checks ─────────────────

	describe("type checks for number fields", () => {
		it("warns when bail is not a number", () => {
			const { warnings } = validateProjectConfig(valid({ review: { bail: "3" } }));
			expect(warnings).toContainEqual(expect.stringContaining('"review.bail" must be a number'));
		});

		it("warns when timeout is not a number", () => {
			const { warnings } = validateProjectConfig(valid({ review: { timeout: true } }));
			expect(warnings).toContainEqual(expect.stringContaining('"review.timeout" must be a number'));
		});

		it("warns when hookTimeout is not a number", () => {
			const { warnings } = validateProjectConfig(valid({ review: { hookTimeout: "5000" } }));
			expect(warnings).toContainEqual(expect.stringContaining('"review.hookTimeout" must be a number'));
		});

		it("warns when retainRuns is not a number", () => {
			const { warnings } = validateProjectConfig(valid({ review: { retainRuns: false } }));
			expect(warnings).toContainEqual(expect.stringContaining('"review.retainRuns" must be a number'));
		});
	});

	describe("type checks for boolean fields", () => {
		it("warns when parallel is not a boolean", () => {
			const { warnings } = validateProjectConfig(valid({ review: { parallel: "yes" } }));
			expect(warnings).toContainEqual(expect.stringContaining('"review.parallel" must be a boolean'));
		});

		it("warns when screenshots is not a boolean", () => {
			const { warnings } = validateProjectConfig(valid({ review: { screenshots: 1 } }));
			expect(warnings).toContainEqual(expect.stringContaining('"review.screenshots" must be a boolean'));
		});

		it("warns when logs is not a boolean", () => {
			const { warnings } = validateProjectConfig(valid({ review: { logs: "true" } }));
			expect(warnings).toContainEqual(expect.stringContaining('"review.logs" must be a boolean'));
		});

		it("warns when traces is not a boolean", () => {
			const { warnings } = validateProjectConfig(valid({ review: { traces: 0 } }));
			expect(warnings).toContainEqual(expect.stringContaining('"review.traces" must be a boolean'));
		});
	});

	describe("type checks for string fields", () => {
		it("warns when stepFilter is not a string", () => {
			const { warnings } = validateProjectConfig(valid({ review: { stepFilter: 42 } }));
			expect(warnings).toContainEqual(expect.stringContaining('"review.stepFilter" must be a string'));
		});

		it("warns when evidenceDir is not a string", () => {
			const { warnings } = validateProjectConfig(valid({ review: { evidenceDir: true } }));
			expect(warnings).toContainEqual(expect.stringContaining('"review.evidenceDir" must be a string'));
		});
	});

	// ── review.gates ─────────────────────────────────────────────

	describe("review.gates", () => {
		it("accepts valid gates object with all sub-objects", () => {
			const { warnings } = validateProjectConfig(valid({ review: { gates: fullReview().gates } }));
			expect(warnings).toEqual([]);
		});

		it("warns when gates is not an object", () => {
			const { warnings } = validateProjectConfig(valid({ review: { gates: "bad" } }));
			expect(warnings).toContainEqual(expect.stringContaining('"review.gates" must be an object'));
		});

		it("warns when gates is null", () => {
			const { warnings } = validateProjectConfig(valid({ review: { gates: null } }));
			expect(warnings).toContainEqual(expect.stringContaining('"review.gates" must be an object'));
		});
	});

	describe("review.gates.coverage", () => {
		it("accepts valid coverage gate", () => {
			const { warnings } = validateProjectConfig(valid({
				review: { gates: { coverage: { requirementCoverage: 80, journeyCoverage: 70, statementCoverage: 60 } } },
			}));
			expect(warnings).toEqual([]);
		});

		it("warns when coverage is not an object", () => {
			const { warnings } = validateProjectConfig(valid({ review: { gates: { coverage: 80 } } }));
			expect(warnings).toContainEqual(expect.stringContaining('"review.gates.coverage" must be an object'));
		});

		it("warns when requirementCoverage is not a number", () => {
			const { warnings } = validateProjectConfig(valid({
				review: { gates: { coverage: { requirementCoverage: "80" } } },
			}));
			expect(warnings).toContainEqual(expect.stringContaining('"review.gates.coverage.requirementCoverage" must be a number'));
		});

		it("warns when journeyCoverage is not a number", () => {
			const { warnings } = validateProjectConfig(valid({
				review: { gates: { coverage: { journeyCoverage: true } } },
			}));
			expect(warnings).toContainEqual(expect.stringContaining('"review.gates.coverage.journeyCoverage" must be a number'));
		});

		it("warns when statementCoverage is not a number", () => {
			const { warnings } = validateProjectConfig(valid({
				review: { gates: { coverage: { statementCoverage: "60" } } },
			}));
			expect(warnings).toContainEqual(expect.stringContaining('"review.gates.coverage.statementCoverage" must be a number'));
		});
	});

	describe("review.gates.security", () => {
		it("accepts valid security gate", () => {
			const { warnings } = validateProjectConfig(valid({
				review: { gates: { security: { required: true, maxCritical: 0, maxHigh: 2 } } },
			}));
			expect(warnings).toEqual([]);
		});

		it("warns when security is not an object", () => {
			const { warnings } = validateProjectConfig(valid({ review: { gates: { security: true } } }));
			expect(warnings).toContainEqual(expect.stringContaining('"review.gates.security" must be an object'));
		});

		it("warns when required is not a boolean", () => {
			const { warnings } = validateProjectConfig(valid({
				review: { gates: { security: { required: "yes" } } },
			}));
			expect(warnings).toContainEqual(expect.stringContaining('"review.gates.security.required" must be a boolean'));
		});

		it("warns when maxCritical is not a number", () => {
			const { warnings } = validateProjectConfig(valid({
				review: { gates: { security: { maxCritical: "zero" } } },
			}));
			expect(warnings).toContainEqual(expect.stringContaining('"review.gates.security.maxCritical" must be a number'));
		});

		it("warns when maxHigh is not a number", () => {
			const { warnings } = validateProjectConfig(valid({
				review: { gates: { security: { maxHigh: false } } },
			}));
			expect(warnings).toContainEqual(expect.stringContaining('"review.gates.security.maxHigh" must be a number'));
		});
	});

	describe("review.gates.risk", () => {
		it("accepts valid risk gate", () => {
			const { warnings } = validateProjectConfig(valid({
				review: { gates: { risk: { criticalMustPass: true, highMustPass: false } } },
			}));
			expect(warnings).toEqual([]);
		});

		it("warns when risk is not an object", () => {
			const { warnings } = validateProjectConfig(valid({ review: { gates: { risk: "high" } } }));
			expect(warnings).toContainEqual(expect.stringContaining('"review.gates.risk" must be an object'));
		});

		it("warns when criticalMustPass is not a boolean", () => {
			const { warnings } = validateProjectConfig(valid({
				review: { gates: { risk: { criticalMustPass: 1 } } },
			}));
			expect(warnings).toContainEqual(expect.stringContaining('"review.gates.risk.criticalMustPass" must be a boolean'));
		});

		it("warns when highMustPass is not a boolean", () => {
			const { warnings } = validateProjectConfig(valid({
				review: { gates: { risk: { highMustPass: "yes" } } },
			}));
			expect(warnings).toContainEqual(expect.stringContaining('"review.gates.risk.highMustPass" must be a boolean'));
		});
	});

	describe("review.gates.release", () => {
		it("accepts valid release gate", () => {
			const { warnings } = validateProjectConfig(valid({
				review: { gates: { release: { allGatesMustPass: true, requireApproval: false } } },
			}));
			expect(warnings).toEqual([]);
		});

		it("warns when release is not an object", () => {
			const { warnings } = validateProjectConfig(valid({ review: { gates: { release: 42 } } }));
			expect(warnings).toContainEqual(expect.stringContaining('"review.gates.release" must be an object'));
		});

		it("warns when allGatesMustPass is not a boolean", () => {
			const { warnings } = validateProjectConfig(valid({
				review: { gates: { release: { allGatesMustPass: "true" } } },
			}));
			expect(warnings).toContainEqual(expect.stringContaining('"review.gates.release.allGatesMustPass" must be a boolean'));
		});

		it("warns when requireApproval is not a boolean", () => {
			const { warnings } = validateProjectConfig(valid({
				review: { gates: { release: { requireApproval: 0 } } },
			}));
			expect(warnings).toContainEqual(expect.stringContaining('"review.gates.release.requireApproval" must be a boolean'));
		});
	});

	// ── combined edge cases ──────────────────────────────────────

	describe("edge cases", () => {
		it("multiple warnings accumulate from different review fields", () => {
			const { warnings } = validateProjectConfig(valid({
				review: {
					target: "invalid",
					sequencer: "invalid",
					bail: "not-number",
					parallel: "not-bool",
				},
			}));
			expect(warnings.length).toBeGreaterThanOrEqual(4);
		});

		it("valid review does not generate errors (only warnings possible)", () => {
			const { errors } = validateProjectConfig(valid({ review: fullReview() }));
			expect(errors).toEqual([]);
		});

		it("gates can be empty object", () => {
			const { warnings } = validateProjectConfig(valid({ review: { gates: {} } }));
			expect(warnings).toEqual([]);
		});

		it("gates sub-objects can be empty", () => {
			const { warnings } = validateProjectConfig(valid({
				review: { gates: { coverage: {}, security: {}, risk: {}, release: {} } },
			}));
			expect(warnings).toEqual([]);
		});
	});
});
