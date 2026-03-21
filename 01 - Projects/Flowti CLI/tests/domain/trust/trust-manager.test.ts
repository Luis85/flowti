import { describe, it, expect, vi } from "vitest";
import {
	loadTrustProfile,
	saveTrustProfile,
	canPerform,
	promote,
	demote,
	recordSuccess,
	checkAutoPromotion,
	deriveTier,
} from "../../../src/domain/trust/trust-manager.js";
import type { AgentTrustProfile } from "../../../src/domain/trust/trust-types.js";
import { DEFAULT_OPERATION_TRUST, DEFAULT_TRUST_CONFIG } from "../../../src/domain/trust/trust-types.js";

function makeDeps(files: Record<string, string> = {}) {
	const store: Record<string, string> = { ...files };
	return {
		disk: {
			existsSync: vi.fn((p: string) => p in store),
			readFileSync: vi.fn((p: string) => store[p] ?? ""),
			writeFileSync: vi.fn((p: string, c: string) => { store[p] = c; }),
			mkdirSync: vi.fn(),
		},
		paths: {
			join: (...segs: string[]) => segs.join("/"),
			dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
		},
		clock: { iso: () => "2026-03-21T10:00:00Z" },
	};
}

const SUPERVISED_PROFILE: AgentTrustProfile = {
	tier: "supervised",
	operations: { ...DEFAULT_OPERATION_TRUST },
	promotionLog: [],
};

describe("trust-manager", () => {
	describe("loadTrustProfile", () => {
		it("returns default profile for new agent", () => {
			const deps = makeDeps();
			const profile = loadTrustProfile(deps, "/vault", "auditor");
			expect(profile.operations).toEqual(DEFAULT_OPERATION_TRUST);
			expect(profile.promotionLog).toHaveLength(0);
		});

		it("new agent default profile has supervised tier", () => {
			const deps = makeDeps();
			const profile = loadTrustProfile(deps, "/vault", "auditor");
			expect(profile.tier).toBe("supervised");
		});

		it("loads existing profile from disk", () => {
			const existing: AgentTrustProfile = {
				tier: "trusted",
				operations: { ...DEFAULT_OPERATION_TRUST, "vault-tag": "auto", "vault-create": "auto", "vault-search": "auto", "vault-read": "auto" },
				promotionLog: [{ op: "vault-tag", from: "review", to: "auto", at: "2026-03-21T09:00:00Z", reason: "test" }],
			};
			const deps = makeDeps({ "/vault/.flowti/var/trust-auditor.json": JSON.stringify(existing) });
			const profile = loadTrustProfile(deps, "/vault", "auditor");
			expect(profile.tier).toBe("trusted");
			expect(profile.promotionLog).toHaveLength(1);
		});
	});

	describe("saveTrustProfile", () => {
		it("writes profile to correct path", () => {
			const deps = makeDeps();
			saveTrustProfile(deps, "/vault", "auditor", SUPERVISED_PROFILE);
			expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
				"/vault/.flowti/var/trust-auditor.json",
				expect.any(String),
			);
		});

		it("creates directory before writing", () => {
			const deps = makeDeps();
			saveTrustProfile(deps, "/vault", "auditor", SUPERVISED_PROFILE);
			expect(deps.disk.mkdirSync).toHaveBeenCalledWith(
				"/vault/.flowti/var",
				{ recursive: true },
			);
		});
	});

	describe("canPerform", () => {
		it("returns allowed:true for auto operations", () => {
			const result = canPerform(SUPERVISED_PROFILE, "vault-read");
			expect(result.allowed).toBe(true);
			expect(result.level).toBe("auto");
		});

		it("returns allowed:true with review level for review operations", () => {
			const result = canPerform(SUPERVISED_PROFILE, "vault-tag");
			expect(result.allowed).toBe(true);
			expect(result.level).toBe("review");
		});

		it("returns allowed:false with reason for manual operations", () => {
			const result = canPerform(SUPERVISED_PROFILE, "vault-edit");
			expect(result.allowed).toBe(false);
			expect(result.level).toBe("manual");
			expect(result.reason).toBe("requires Director");
		});

		it("vault-move is manual and not allowed", () => {
			const result = canPerform(SUPERVISED_PROFILE, "vault-move");
			expect(result.allowed).toBe(false);
			expect(result.reason).toBe("requires Director");
		});

		it("vault-search defaults to auto and is allowed", () => {
			const result = canPerform(SUPERVISED_PROFILE, "vault-search");
			expect(result.allowed).toBe(true);
			expect(result.level).toBe("auto");
		});
	});

	describe("promote", () => {
		it("updates operation level", () => {
			const clock = { iso: () => "2026-03-21T10:00:00Z" };
			const updated = promote(SUPERVISED_PROFILE, "vault-edit", "review", "50 approved edits", clock);
			expect(updated.operations["vault-edit"]).toBe("review");
		});

		it("appends log entry with from/to/reason", () => {
			const clock = { iso: () => "2026-03-21T10:00:00Z" };
			const updated = promote(SUPERVISED_PROFILE, "vault-edit", "review", "50 approved edits", clock);
			expect(updated.promotionLog).toHaveLength(1);
			const entry = updated.promotionLog[0];
			expect(entry.op).toBe("vault-edit");
			expect(entry.from).toBe("manual");
			expect(entry.to).toBe("review");
			expect(entry.reason).toBe("50 approved edits");
			expect(entry.at).toBe("2026-03-21T10:00:00Z");
		});

		it("recalculates tier after promotion", () => {
			const clock = { iso: () => "2026-03-21T10:00:00Z" };
			const allAutoProfile: AgentTrustProfile = {
				tier: "supervised",
				operations: {
					"vault-read": "auto", "vault-search": "auto", "vault-tag": "auto",
					"vault-create": "auto", "vault-edit": "manual", "vault-move": "auto", "vault-link": "auto",
				},
				promotionLog: [],
			};
			const updated = promote(allAutoProfile, "vault-edit", "auto", "fully trusted", clock);
			expect(updated.tier).toBe("autonomous");
		});

		it("preserves existing log entries", () => {
			const clock = { iso: () => "2026-03-21T10:00:00Z" };
			const profileWithLog: AgentTrustProfile = {
				...SUPERVISED_PROFILE,
				promotionLog: [{ op: "vault-tag", from: "review", to: "auto", at: "2026-03-20T00:00:00Z", reason: "first" }],
			};
			const updated = promote(profileWithLog, "vault-create", "auto", "second", clock);
			expect(updated.promotionLog).toHaveLength(2);
		});
	});

	describe("demote", () => {
		it("downgrades operation level", () => {
			const autoProfile: AgentTrustProfile = {
				...SUPERVISED_PROFILE,
				operations: { ...DEFAULT_OPERATION_TRUST, "vault-tag": "auto" },
			};
			const clock = { iso: () => "2026-03-21T10:00:00Z" };
			const updated = demote(autoProfile, "vault-tag", "manual", "suspicious activity", clock);
			expect(updated.operations["vault-tag"]).toBe("manual");
		});

		it("appends log entry for demotion", () => {
			const autoProfile: AgentTrustProfile = {
				...SUPERVISED_PROFILE,
				operations: { ...DEFAULT_OPERATION_TRUST, "vault-tag": "auto" },
			};
			const clock = { iso: () => "2026-03-21T10:00:00Z" };
			const updated = demote(autoProfile, "vault-tag", "manual", "suspicious activity", clock);
			expect(updated.promotionLog).toHaveLength(1);
			const entry = updated.promotionLog[0];
			expect(entry.from).toBe("auto");
			expect(entry.to).toBe("manual");
		});

		it("recalculates tier after demotion drops below autonomous threshold", () => {
			const clock = { iso: () => "2026-03-21T10:00:00Z" };
			// 5 auto, 2 manual = 71% auto → trusted (below 80% autonomous threshold)
			const nearAutonomousProfile: AgentTrustProfile = {
				tier: "autonomous",
				operations: {
					"vault-read": "auto", "vault-search": "auto", "vault-tag": "auto",
					"vault-create": "auto", "vault-edit": "auto", "vault-move": "manual", "vault-link": "manual",
				},
				promotionLog: [],
			};
			const updated = demote(nearAutonomousProfile, "vault-edit", "manual", "revoked", clock);
			// Now 4/7 = 57% auto → trusted
			expect(updated.tier).toBe("trusted");
		});
	});

	describe("recordSuccess", () => {
		it("returns the profile unchanged (no config supplied)", () => {
			const result = recordSuccess(SUPERVISED_PROFILE, "vault-tag", 19);
			expect(result.profile).toBe(SUPERVISED_PROFILE);
			expect(result.promoted).toBe(false);
		});

		it("reports promoted:false below threshold", () => {
			const result = recordSuccess(SUPERVISED_PROFILE, "vault-tag", 5);
			expect(result.promoted).toBe(false);
		});
	});

	describe("checkAutoPromotion", () => {
		it("returns false when autoPromote is disabled", () => {
			const config = { ...DEFAULT_TRUST_CONFIG, autoPromote: false };
			expect(checkAutoPromotion(SUPERVISED_PROFILE, "vault-tag", 5, config, 100)).toBe(false);
		});

		it("returns false when no threshold defined for operation", () => {
			expect(checkAutoPromotion(SUPERVISED_PROFILE, "vault-read", 10, DEFAULT_TRUST_CONFIG, 1000)).toBe(false);
		});

		it("returns false when successCount is below threshold", () => {
			expect(checkAutoPromotion(SUPERVISED_PROFILE, "vault-tag", 5, DEFAULT_TRUST_CONFIG, 10)).toBe(false);
		});

		it("returns false when agentLevel is below minLevel", () => {
			expect(checkAutoPromotion(SUPERVISED_PROFILE, "vault-tag", 1, DEFAULT_TRUST_CONFIG, 25)).toBe(false);
		});

		it("returns true when both successes and level meet threshold", () => {
			expect(checkAutoPromotion(SUPERVISED_PROFILE, "vault-tag", 2, DEFAULT_TRUST_CONFIG, 20)).toBe(true);
		});

		it("returns true for vault-edit at exact threshold", () => {
			expect(checkAutoPromotion(SUPERVISED_PROFILE, "vault-edit", 5, DEFAULT_TRUST_CONFIG, 100)).toBe(true);
		});

		it("returns false for vault-create when level is one below minLevel", () => {
			expect(checkAutoPromotion(SUPERVISED_PROFILE, "vault-create", 3, DEFAULT_TRUST_CONFIG, 50)).toBe(false);
		});
	});

	describe("deriveTier", () => {
		it("returns supervised when fewer than 50% operations are auto", () => {
			expect(deriveTier(SUPERVISED_PROFILE)).toBe("supervised");
		});

		it("returns autonomous when 80%+ operations are auto (6 of 7)", () => {
			const profile: AgentTrustProfile = {
				tier: "supervised",
				operations: {
					"vault-read": "auto", "vault-search": "auto", "vault-tag": "auto",
					"vault-create": "auto", "vault-edit": "auto", "vault-move": "auto", "vault-link": "review",
				},
				promotionLog: [],
			};
			expect(deriveTier(profile)).toBe("autonomous");
		});

		it("returns autonomous when all 7 operations are auto", () => {
			const profile: AgentTrustProfile = {
				tier: "supervised",
				operations: {
					"vault-read": "auto", "vault-search": "auto", "vault-tag": "auto",
					"vault-create": "auto", "vault-edit": "auto", "vault-move": "auto", "vault-link": "auto",
				},
				promotionLog: [],
			};
			expect(deriveTier(profile)).toBe("autonomous");
		});

		it("returns trusted when 50%-79% operations are auto (4 of 7)", () => {
			const profile: AgentTrustProfile = {
				tier: "supervised",
				operations: {
					"vault-read": "auto", "vault-search": "auto", "vault-tag": "auto",
					"vault-create": "auto", "vault-edit": "manual", "vault-move": "manual", "vault-link": "manual",
				},
				promotionLog: [],
			};
			expect(deriveTier(profile)).toBe("trusted");
		});

		it("returns supervised when exactly 3 of 7 operations are auto", () => {
			const profile: AgentTrustProfile = {
				tier: "supervised",
				operations: {
					"vault-read": "auto", "vault-search": "auto", "vault-tag": "auto",
					"vault-create": "review", "vault-edit": "manual", "vault-move": "manual", "vault-link": "manual",
				},
				promotionLog: [],
			};
			expect(deriveTier(profile)).toBe("supervised");
		});
	});
});
