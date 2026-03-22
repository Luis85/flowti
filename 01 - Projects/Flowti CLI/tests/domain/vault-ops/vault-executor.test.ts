import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/domain/trust/trust-manager.js", () => ({
	recordSuccess: vi.fn(),
}));

vi.mock("../../../src/domain/economy/economy-ledger.js", () => ({
	getAccount: vi.fn(),
	creditReward: vi.fn(),
}));

vi.mock("../../../src/domain/economy/economy-rules.js", () => ({
	calculateReward: vi.fn(),
}));

vi.mock("../../../src/domain/tasks/staging.js", () => ({
	createStagingArea: vi.fn(),
}));

import { validateRequest, executeVaultOp, approveStaged } from "../../../src/domain/vault-ops/vault-executor.js";
import { recordSuccess } from "../../../src/domain/trust/trust-manager.js";
import { creditReward } from "../../../src/domain/economy/economy-ledger.js";
import { calculateReward } from "../../../src/domain/economy/economy-rules.js";
import { createStagingArea } from "../../../src/domain/tasks/staging.js";
import type { VaultOpsDeps, VaultReadRequest, VaultCreateRequest, VaultMoveRequest } from "../../../src/domain/vault-ops/vault-ops-types.js";
import type { AgentTrustProfile, TrustConfig, TrustLevel, VaultOperation } from "../../../src/domain/trust/trust-types.js";
import type { EconomyLedger } from "../../../src/domain/economy/economy-types.js";

// ── Helpers ──────────────────────────────────────────────────────────

function makeDeps(files: Record<string, string> = {}): VaultOpsDeps {
	const store: Record<string, string> = { ...files };
	return {
		disk: {
			existsSync: (p: string) => p in store,
			readFileSync: (p: string, _enc?: string) => {
				if (!(p in store)) throw new Error(`ENOENT: ${p}`);
				return store[p];
			},
			writeFileSync: (p: string, content: string) => {
				store[p] = content;
			},
			mkdirSync: () => undefined,
			renameSync: (from: string, to: string) => {
				if (!(from in store)) throw new Error(`ENOENT: ${from}`);
				store[to] = store[from];
				delete store[from];
			},
			readdirSync: (dir: string) => {
				const prefix = dir.endsWith("/") ? dir : dir + "/";
				return Object.keys(store)
					.filter((p) => p.startsWith(prefix))
					.map((p) => ({
						name: p.slice(prefix.length),
						isFile: () => true,
						isDirectory: () => false,
					}));
			},
			statSync: (p: string) => {
				if (!(p in store)) throw new Error(`ENOENT: ${p}`);
				return { mtimeMs: Date.now() };
			},
			rmSync: (p: string) => {
				delete store[p];
			},
			copyFileSync: (src: string, dest: string) => {
				if (!(src in store)) throw new Error(`ENOENT: ${src}`);
				store[dest] = store[src];
			},
		},
		clock: { iso: () => "2026-03-22T10:00:00Z" },
		paths: {
			join: (...segs: string[]) => segs.join("/"),
			dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
			basename: (p: string) => p.split("/").pop() ?? "",
			relative: (from: string, to: string) =>
				to.startsWith(from + "/") ? to.slice(from.length + 1) : to,
		},
		vaultRoot: "/vault",
	};
}

const DEFAULT_OPS: Record<VaultOperation, TrustLevel> = {
	"vault-read": "auto",
	"vault-search": "auto",
	"vault-tag": "review",
	"vault-create": "review",
	"vault-edit": "manual",
	"vault-move": "manual",
	"vault-link": "review",
};

function makeProfile(overrides?: Partial<AgentTrustProfile>): AgentTrustProfile {
	return {
		tier: "supervised",
		operations: { ...DEFAULT_OPS },
		promotionLog: [],
		successCounts: {},
		...overrides,
	};
}

function makeLedger(accounts: Record<string, { level: number; xp: number; coin: number }> = {}): EconomyLedger {
	const mapped: Record<string, {
		readonly xp: number;
		readonly level: number;
		readonly coin: number;
		readonly tokens: number;
		readonly totalEarned: { readonly xp: number; readonly coin: number };
		readonly totalSpent: { readonly coin: number; readonly tokens: number };
	}> = {};
	for (const [name, vals] of Object.entries(accounts)) {
		mapped[name] = {
			xp: vals.xp,
			level: vals.level,
			coin: vals.coin,
			tokens: 0,
			totalEarned: { xp: 0, coin: 0 },
			totalSpent: { coin: 0, tokens: 0 },
		};
	}
	return { version: 1, updatedAt: "", accounts: mapped };
}

const DEFAULT_CONFIG: TrustConfig = {
	autoPromote: true,
	thresholds: {
		"vault-tag": { successes: 20, minLevel: 2 },
		"vault-create": { successes: 50, minLevel: 4 },
		"vault-edit": { successes: 100, minLevel: 5 },
	},
};

// ── Setup ────────────────────────────────────────────────────────────

beforeEach(() => {
	vi.clearAllMocks();

	const mockRecordSuccess = vi.mocked(recordSuccess);
	mockRecordSuccess.mockImplementation((profile) => ({
		profile: {
			...profile,
			successCounts: {
				...profile.successCounts,
				"vault-read": ((profile.successCounts["vault-read"] ?? 0) + 1),
			},
		},
		promoted: false,
	}));

	const mockCreditReward = vi.mocked(creditReward);
	mockCreditReward.mockImplementation((ledger, _agent, _reward) => ({
		ledger,
		reward: { xp: 50, coin: 25, leveledUp: false },
	}));

	const mockCalculateReward = vi.mocked(calculateReward);
	mockCalculateReward.mockReturnValue({ xp: 50, coin: 25 });

	vi.mocked(createStagingArea).mockReturnValue("/vault/.flowti/var/staging/task-1");
});

// ── validateRequest ──────────────────────────────────────────────────

describe("validateRequest", () => {
	it("rejects path traversal (..)", () => {
		const deps = makeDeps();
		const req: VaultReadRequest = {
			operation: "vault-read",
			agentName: "agent-a",
			path: "notes/../secrets/key.md",
		};

		const result = validateRequest(req, deps);

		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.reason).toContain("traversal");
		}
	});

	it("rejects empty path", () => {
		const deps = makeDeps();
		const req: VaultReadRequest = {
			operation: "vault-read",
			agentName: "agent-a",
			path: "",
		};

		const result = validateRequest(req, deps);

		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.reason).toContain("empty");
		}
	});

	it("accepts valid path", () => {
		const deps = makeDeps();
		const req: VaultReadRequest = {
			operation: "vault-read",
			agentName: "agent-a",
			path: "notes/hello.md",
		};

		const result = validateRequest(req, deps);

		expect(result.valid).toBe(true);
	});

	it("rejects path outside scope", () => {
		const deps = makeDeps();
		const req: VaultReadRequest = {
			operation: "vault-read",
			agentName: "agent-a",
			path: "private/secret.md",
		};

		const result = validateRequest(req, deps, { folders: ["notes/", "docs/"] });

		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.reason).toContain("outside allowed scope");
		}
	});

	it("allows path within scope", () => {
		const deps = makeDeps();
		const req: VaultReadRequest = {
			operation: "vault-read",
			agentName: "agent-a",
			path: "notes/hello.md",
		};

		const result = validateRequest(req, deps, { folders: ["notes/"] });

		expect(result.valid).toBe(true);
	});
});

// ── executeVaultOp — auto trust path ─────────────────────────────────

describe("executeVaultOp — auto trust path", () => {
	it("executes operation and returns data", () => {
		const deps = makeDeps({
			"/vault/notes/hello.md": "---\ntitle: Hello\n---\nBody text",
		});
		const profile = makeProfile({
			operations: { ...DEFAULT_OPS, "vault-read": "auto" },
		});

		const { result } = executeVaultOp(
			{ operation: "vault-read", agentName: "agent-a", path: "notes/hello.md" } as VaultReadRequest,
			deps,
			profile,
			DEFAULT_CONFIG,
			makeLedger(),
		);

		expect(result.outcome).toBe("executed");
		expect(result.data).toEqual({
			content: "\nBody text",
			frontmatter: { title: "Hello" },
		});
	});

	it("records success on profile", () => {
		const deps = makeDeps({
			"/vault/notes/hello.md": "---\ntitle: Hello\n---\nBody",
		});
		const profile = makeProfile({
			operations: { ...DEFAULT_OPS, "vault-read": "auto" },
		});

		const { profile: updatedProfile } = executeVaultOp(
			{ operation: "vault-read", agentName: "agent-a", path: "notes/hello.md" } as VaultReadRequest,
			deps,
			profile,
			DEFAULT_CONFIG,
			makeLedger(),
		);

		expect(recordSuccess).toHaveBeenCalledOnce();
		expect(updatedProfile.successCounts["vault-read"]).toBe(1);
	});

	it("awards reward when taskId present", () => {
		const deps = makeDeps({
			"/vault/notes/hello.md": "Body text",
		});
		const profile = makeProfile({
			operations: { ...DEFAULT_OPS, "vault-read": "auto" },
		});

		executeVaultOp(
			{ operation: "vault-read", agentName: "agent-a", path: "notes/hello.md", taskId: "task-42" } as VaultReadRequest,
			deps,
			profile,
			DEFAULT_CONFIG,
			makeLedger(),
		);

		expect(calculateReward).toHaveBeenCalledOnce();
		expect(creditReward).toHaveBeenCalledOnce();
	});

	it("does not award reward when taskId absent", () => {
		const deps = makeDeps({
			"/vault/notes/hello.md": "Body text",
		});
		const profile = makeProfile({
			operations: { ...DEFAULT_OPS, "vault-read": "auto" },
		});

		executeVaultOp(
			{ operation: "vault-read", agentName: "agent-a", path: "notes/hello.md" } as VaultReadRequest,
			deps,
			profile,
			DEFAULT_CONFIG,
			makeLedger(),
		);

		expect(creditReward).not.toHaveBeenCalled();
	});
});

// ── executeVaultOp — review trust path ───────────────────────────────

describe("executeVaultOp — review trust path", () => {
	it("stages operation instead of executing", () => {
		const deps = makeDeps();
		const profile = makeProfile({
			operations: { ...DEFAULT_OPS, "vault-create": "review" },
		});

		const { result } = executeVaultOp(
			{
				operation: "vault-create",
				agentName: "agent-a",
				path: "notes/new.md",
				body: "Hello",
				taskId: "task-1",
			} as VaultCreateRequest,
			deps,
			profile,
			DEFAULT_CONFIG,
			makeLedger(),
		);

		expect(result.outcome).toBe("staged");
		expect(result.stagingId).toBe("task-1");
		expect(createStagingArea).toHaveBeenCalledOnce();
	});

	it("does not record success or award reward", () => {
		const deps = makeDeps();
		const profile = makeProfile({
			operations: { ...DEFAULT_OPS, "vault-create": "review" },
		});

		executeVaultOp(
			{
				operation: "vault-create",
				agentName: "agent-a",
				path: "notes/new.md",
				body: "Hello",
				taskId: "task-1",
			} as VaultCreateRequest,
			deps,
			profile,
			DEFAULT_CONFIG,
			makeLedger(),
		);

		expect(recordSuccess).not.toHaveBeenCalled();
		expect(creditReward).not.toHaveBeenCalled();
	});
});

// ── executeVaultOp — manual trust path ───────────────────────────────

describe("executeVaultOp — manual trust path", () => {
	it("returns queued without executing", () => {
		const deps = makeDeps();
		const profile = makeProfile({
			operations: { ...DEFAULT_OPS, "vault-edit": "manual" },
		});

		const { result, profile: returnedProfile, ledger: returnedLedger } = executeVaultOp(
			{
				operation: "vault-edit",
				agentName: "agent-a",
				path: "notes/edit.md",
				content: "new content",
			},
			deps,
			profile,
			DEFAULT_CONFIG,
			makeLedger(),
		);

		expect(result.outcome).toBe("queued");
		expect(recordSuccess).not.toHaveBeenCalled();
		expect(creditReward).not.toHaveBeenCalled();
		expect(returnedProfile).toBe(profile);
	});
});

// ── executeVaultOp — operation failure ───────────────────────────────

describe("executeVaultOp — operation failure", () => {
	it("returns failed when operation throws", () => {
		const deps = makeDeps({});
		const profile = makeProfile({
			operations: { ...DEFAULT_OPS, "vault-read": "auto" },
		});

		const { result } = executeVaultOp(
			{ operation: "vault-read", agentName: "agent-a", path: "missing.md" } as VaultReadRequest,
			deps,
			profile,
			DEFAULT_CONFIG,
			makeLedger(),
		);

		expect(result.outcome).toBe("failed");
		expect(result.reason).toContain("ENOENT");
	});
});

// ── approveStaged ────────────────────────────────────────────────────

describe("approveStaged", () => {
	it("records success and awards review-tier reward", () => {
		const deps = makeDeps();
		const profile = makeProfile();
		const ledger = makeLedger({ "agent-a": { level: 2, xp: 100, coin: 50 } });

		approveStaged("task-1", deps, profile, DEFAULT_CONFIG, ledger, "vault-create", "agent-a");

		expect(recordSuccess).toHaveBeenCalledOnce();
		expect(calculateReward).toHaveBeenCalledWith(
			{ xp: 50, coin: 25 },
			expect.objectContaining({ trustTier: "review" }),
		);
		expect(creditReward).toHaveBeenCalledOnce();
	});

	it("returns updated profile and ledger", () => {
		const deps = makeDeps();
		const profile = makeProfile();
		const ledger = makeLedger();

		const result = approveStaged("task-1", deps, profile, DEFAULT_CONFIG, ledger, "vault-tag", "agent-b");

		expect(result.profile).toBeDefined();
		expect(result.ledger).toBeDefined();
	});
});
