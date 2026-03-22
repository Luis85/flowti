import { describe, it, expect } from "vitest";
import type { AgentTrustProfile, TrustConfig, VaultOperation, TrustLevel } from "../../../src/domain/trust/trust-types.js";
import { DEFAULT_OPERATION_TRUST, DEFAULT_TRUST_CONFIG } from "../../../src/domain/trust/trust-types.js";

describe("trust-types", () => {
	it("DEFAULT_OPERATION_TRUST covers all 7 operations", () => {
		const ops: VaultOperation[] = ["vault-read", "vault-search", "vault-tag", "vault-create", "vault-edit", "vault-move", "vault-link"];
		for (const op of ops) {
			expect(DEFAULT_OPERATION_TRUST[op]).toBeDefined();
		}
		expect(Object.keys(DEFAULT_OPERATION_TRUST)).toHaveLength(7);
	});

	it("read and search default to auto", () => {
		expect(DEFAULT_OPERATION_TRUST["vault-read"]).toBe("auto");
		expect(DEFAULT_OPERATION_TRUST["vault-search"]).toBe("auto");
	});

	it("edit and move default to manual", () => {
		expect(DEFAULT_OPERATION_TRUST["vault-edit"]).toBe("manual");
		expect(DEFAULT_OPERATION_TRUST["vault-move"]).toBe("manual");
	});

	it("DEFAULT_TRUST_CONFIG has autoPromote enabled", () => {
		expect(DEFAULT_TRUST_CONFIG.autoPromote).toBe(true);
	});

	it("DEFAULT_TRUST_CONFIG has thresholds for tag, create, edit", () => {
		expect(DEFAULT_TRUST_CONFIG.thresholds["vault-tag"]).toEqual({ successes: 20, minLevel: 2 });
		expect(DEFAULT_TRUST_CONFIG.thresholds["vault-create"]).toEqual({ successes: 50, minLevel: 4 });
		expect(DEFAULT_TRUST_CONFIG.thresholds["vault-edit"]).toEqual({ successes: 100, minLevel: 5 });
	});

	it("AgentTrustProfile type-checks", () => {
		const profile: AgentTrustProfile = {
			tier: "supervised",
			operations: { ...DEFAULT_OPERATION_TRUST },
			promotionLog: [],
		};
		expect(profile.tier).toBe("supervised");
	});
});
