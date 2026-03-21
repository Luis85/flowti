import type { AgentAccount, EconomyLedger, Transaction, RewardResult } from "./economy-types.js";
import { levelForXp } from "./leveling.js";

const LEDGER_PATH = ".flowti/var/economy.json";
const LOG_PATH = ".flowti/var/economy-log.jsonl";

type LedgerDeps = {
	readonly disk: { existsSync(p: string): boolean; readFileSync(p: string, enc?: string): string; writeFileSync(p: string, c: string): void; mkdirSync(p: string, opts?: { recursive?: boolean }): void };
	readonly paths: { join(...segs: string[]): string; dirname(p: string): string };
	readonly clock?: { iso(): string };
};

const DEFAULT_ACCOUNT: AgentAccount = {
	xp: 0, level: 1, coin: 0, tokens: 0,
	totalEarned: { xp: 0, coin: 0 },
	totalSpent: { coin: 0, tokens: 0 },
};

export function readLedger(deps: LedgerDeps, vaultRoot: string): EconomyLedger {
	const path = deps.paths.join(vaultRoot, LEDGER_PATH);
	if (!deps.disk.existsSync(path)) return { version: 1, updatedAt: "", accounts: {} };
	const raw = deps.disk.readFileSync(path, "utf-8");
	return JSON.parse(raw) as EconomyLedger;
}

export function writeLedger(deps: LedgerDeps, vaultRoot: string, ledger: EconomyLedger): void {
	const path = deps.paths.join(vaultRoot, LEDGER_PATH);
	const dir = deps.paths.dirname(path);
	deps.disk.mkdirSync(dir, { recursive: true });
	const updated: EconomyLedger = { ...ledger, updatedAt: deps.clock?.iso() ?? new Date().toISOString() };
	deps.disk.writeFileSync(path, JSON.stringify(updated, null, "\t"));
}

export function getAccount(ledger: EconomyLedger, agent: string): AgentAccount {
	return ledger.accounts[agent] ?? { ...DEFAULT_ACCOUNT };
}

export function creditReward(
	ledger: EconomyLedger,
	agent: string,
	reward: { readonly xp: number; readonly coin: number },
): { readonly ledger: EconomyLedger; readonly reward: RewardResult } {
	const prev = getAccount(ledger, agent);
	const newXp = prev.xp + reward.xp;
	const newLevel = levelForXp(newXp);
	const leveledUp = newLevel > prev.level;
	const updated: AgentAccount = {
		...prev,
		xp: newXp,
		level: newLevel,
		coin: prev.coin + reward.coin,
		totalEarned: { xp: prev.totalEarned.xp + reward.xp, coin: prev.totalEarned.coin + reward.coin },
	};
	return {
		ledger: { ...ledger, accounts: { ...ledger.accounts, [agent]: updated } },
		reward: { xp: reward.xp, coin: reward.coin, leveledUp, newLevel: leveledUp ? newLevel : undefined },
	};
}

export function debitCoin(ledger: EconomyLedger, agent: string, amount: number): EconomyLedger | null {
	const prev = getAccount(ledger, agent);
	if (prev.coin < amount) return null;
	const updated: AgentAccount = {
		...prev,
		coin: prev.coin - amount,
		totalSpent: { ...prev.totalSpent, coin: prev.totalSpent.coin + amount },
	};
	return { ...ledger, accounts: { ...ledger.accounts, [agent]: updated } };
}

export function debitTokens(ledger: EconomyLedger, agent: string, amount: number): EconomyLedger | null {
	const prev = getAccount(ledger, agent);
	if (prev.tokens < amount) return null;
	const updated: AgentAccount = {
		...prev,
		tokens: prev.tokens - amount,
		totalSpent: { ...prev.totalSpent, tokens: prev.totalSpent.tokens + amount },
	};
	return { ...ledger, accounts: { ...ledger.accounts, [agent]: updated } };
}

export function grantResources(ledger: EconomyLedger, agent: string, grant: { readonly coin?: number; readonly tokens?: number }): EconomyLedger {
	const prev = getAccount(ledger, agent);
	const updated: AgentAccount = {
		...prev,
		coin: prev.coin + (grant.coin ?? 0),
		tokens: prev.tokens + (grant.tokens ?? 0),
		totalEarned: { ...prev.totalEarned, coin: prev.totalEarned.coin + (grant.coin ?? 0) },
	};
	return { ...ledger, accounts: { ...ledger.accounts, [agent]: updated } };
}

export function appendTransaction(deps: LedgerDeps, vaultRoot: string, tx: Transaction): void {
	const path = deps.paths.join(vaultRoot, LOG_PATH);
	const dir = deps.paths.dirname(path);
	deps.disk.mkdirSync(dir, { recursive: true });
	const existing = deps.disk.existsSync(path) ? deps.disk.readFileSync(path, "utf-8") : "";
	deps.disk.writeFileSync(path, existing + JSON.stringify(tx) + "\n");
}
