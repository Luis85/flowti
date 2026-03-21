import { describe, it, expect } from "vitest";
import type {
	TrustLevel,
	VaultOperation,
	PromotionLogEntry,
	AgentTrustProfile,
	TrustThreshold,
	TrustConfig,
} from "../../../src/domain/trust/trust-types.js";
import { DEFAULT_OPERATION_TRUST, DEFAULT_TRUST_CONFIG } from "../../../src/domain/trust/trust-types.js";

describe("trust-types", () => {
	it("TrustLevel accepts all valid values", () => {
		const levels: TrustLevel[] = ["manual", "review", "auto"];
		expect(levels).toHaveLength(3);
	});

	it("VaultOperation accepts all valid values", () => {
		const ops: VaultOperation[] = [
			"vault-read", "vault-search", "vault-tag",
			"vault-create", "vault-edit", "vault-move", "vault-link",
		];
		expect(ops).toHaveLength(7);
	});

	it("PromotionLogEntry accepts valid entry", () => {
		const entry: PromotionLogEntry = {
			op: "vault-edit",
			from: "manual",
			to: "review",
			at: "2026-03-21T10:00:00Z",
			reason: "100 successful edits",
		};
		expect(entry.op).toBe("vault-edit");
		expect(entry.from).toBe("manual");
		expect(entry.to).toBe("review");
	});

	it("AgentTrustProfile accepts valid profile", () => {
		const profile: AgentTrustProfile = {
			tier: "supervised",
			operations: { ...DEFAULT_OPERATION_TRUST },
			promotionLog: [],
		};
		expect(profile.tier).toBe("supervised");
		expect(profile.promotionLog).toHaveLength(0);
	});

	it("TrustThreshold accepts valid threshold", () => {
		const threshold: TrustThreshold = { successes: 50, minLevel: 3 };
		expect(threshold.successes).toBe(50);
		expect(threshold.minLevel).toBe(3);
	});

	it("TrustConfig accepts valid config", () => {
		const config: TrustConfig = {
			autoPromote: false,
			thresholds: { "vault-tag": { successes: 10, minLevel: 1 } },
		};
		expect(config.autoPromote).toBe(false);
		expect(config.thresholds["vault-tag"]?.successes).toBe(10);
	});

	describe("DEFAULT_OPERATION_TRUST", () => {
		it("vault-read and vault-search default to auto", () => {
			expect(DEFAULT_OPERATION_TRUST["vault-read"]).toBe("auto");
			expect(DEFAULT_OPERATION_TRUST["vault-search"]).toBe("auto");
		});

		it("vault-tag, vault-create, vault-link default to review", () => {
			expect(DEFAULT_OPERATION_TRUST["vault-tag"]).toBe("review");
			expect(DEFAULT_OPERATION_TRUST["vault-create"]).toBe("review");
			expect(DEFAULT_OPERATION_TRUST["vault-link"]).toBe("review");
		});

		it("vault-edit and vault-move default to manual", () => {
			expect(DEFAULT_OPERATION_TRUST["vault-edit"]).toBe("manual");
			expect(DEFAULT_OPERATION_TRUST["vault-move"]).toBe("manual");
		});

		it("covers all 7 vault operations", () => {
			const keys = Object.keys(DEFAULT_OPERATION_TRUST);
			expect(keys).toHaveLength(7);
		});
	});

	describe("DEFAULT_TRUST_CONFIG", () => {
		it("autoPromote is true by default", () => {
			expect(DEFAULT_TRUST_CONFIG.autoPromote).toBe(true);
		});

		it("has thresholds for vault-tag, vault-create, vault-edit", () => {
			expect(DEFAULT_TRUST_CONFIG.thresholds["vault-tag"]).toBeDefined();
			expect(DEFAULT_TRUST_CONFIG.thresholds["vault-create"]).toBeDefined();
			expect(DEFAULT_TRUST_CONFIG.thresholds["vault-edit"]).toBeDefined();
		});

		it("vault-edit threshold requires 100 successes and level 5", () => {
			const t = DEFAULT_TRUST_CONFIG.thresholds["vault-edit"];
			expect(t?.successes).toBe(100);
			expect(t?.minLevel).toBe(5);
		});
	});
});
