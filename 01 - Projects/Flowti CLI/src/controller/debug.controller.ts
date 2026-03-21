/**
 * debug.controller.ts — CLI commands for debug overrides.
 *
 * Provides debug:set, debug:trust, debug:needs, and debug:unlock commands.
 * All operations log to economy-log.jsonl with type "debug".
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types-config.js";
import type { CliDeps } from "../infrastructure/deps.js";
import { readLedger, writeLedger, appendTransaction } from "../domain/economy/economy-ledger.js";
import { levelForXp } from "../domain/economy/leveling.js";
import { loadTrustProfile, saveTrustProfile } from "../domain/trust/trust-manager.js";
import type { AgentTrustProfile } from "../domain/trust/trust-types.js";
import { renderDebugSet, renderDebugTrust, renderDebugNeeds, renderDebugUnlock } from "../ui/displays/debug-display.js";
import { VAULT_ROOT } from "../infrastructure/config.js";

const AGENTS_DIR = "docs/agents";

// ── Helpers ───────────────────────────────────────────────────────

function ledgerDeps(deps: CliDeps) {
	return {
		disk: {
			existsSync: (p: string) => deps.disk.existsSync(p),
			readFileSync: (p: string, enc?: string) => deps.disk.readFileSync(p, (enc ?? "utf-8") as BufferEncoding),
			writeFileSync: (p: string, c: string) => deps.disk.writeFileSync(p, c, "utf-8"),
			mkdirSync: (p: string, opts?: { recursive?: boolean }) => deps.disk.mkdirSync(p, opts),
		},
		paths: deps.paths,
		clock: deps.clock,
	};
}

function trustDeps(deps: CliDeps) {
	return {
		disk: {
			existsSync: (p: string) => deps.disk.existsSync(p),
			readFileSync: (p: string, enc?: string) => deps.disk.readFileSync(p, (enc ?? "utf-8") as BufferEncoding),
			writeFileSync: (p: string, c: string) => deps.disk.writeFileSync(p, c, "utf-8"),
			mkdirSync: (p: string, opts?: { recursive?: boolean }) => deps.disk.mkdirSync(p, opts),
		},
		paths: deps.paths,
		clock: deps.clock,
	};
}

function agentJsonPath(deps: CliDeps, agentName: string): string {
	const filename = agentName.toLowerCase().replace(/\s+/g, "-") + ".json";
	return deps.paths.join(VAULT_ROOT, AGENTS_DIR, filename);
}

interface AgentJson {
	components?: Array<{ name: string; type?: string; config?: Record<string, unknown> }>;
}

function readAgentJson(deps: CliDeps, jsonPath: string): AgentJson {
	if (!deps.disk.existsSync(jsonPath)) return {};
	try {
		return JSON.parse(deps.disk.readFileSync(jsonPath, "utf-8")) as AgentJson;
	} catch {
		return {};
	}
}

function writeAgentJson(deps: CliDeps, jsonPath: string, data: AgentJson): void {
	const dir = deps.paths.dirname(jsonPath);
	deps.disk.mkdirSync(dir, { recursive: true });
	deps.disk.writeFileSync(jsonPath, JSON.stringify(data, null, "\t"), "utf-8");
}

// ── Commands ─────────────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = {
	"debug:set": adaptDescriptor({
		flags: {
			agent: { type: "string", required: true, hint: "--agent=<name>" },
			xp: { type: "number", default: -1, hint: "--xp=<n>" },
			coin: { type: "number", default: -1, hint: "--coin=<n>" },
			level: { type: "number", default: -1, hint: "--level=<n>" },
		},
		handler: (ctx) => {
			const agent = ctx.flags.agent as string;
			const xpOverride = ctx.flags.xp as number;
			const coinOverride = ctx.flags.coin as number;
			const levelOverride = ctx.flags.level as number;

			const deps = ledgerDeps(ctx.deps);
			const ledger = readLedger(deps, VAULT_ROOT);
			const prev = ledger.accounts[agent] ?? {
				xp: 0, level: 1, coin: 0, tokens: 0,
				totalEarned: { xp: 0, coin: 0 },
				totalSpent: { coin: 0, tokens: 0 },
			};

			const changes: string[] = [];
			const next = { ...prev };

			if (xpOverride >= 0) {
				next.xp = xpOverride;
				next.level = levelForXp(xpOverride);
				changes.push(`xp=${xpOverride}`);
			}
			if (coinOverride >= 0) {
				next.coin = coinOverride;
				changes.push(`coin=${coinOverride}`);
			}
			if (levelOverride >= 0) {
				next.level = levelOverride;
				changes.push(`level=${levelOverride}`);
			}

			const updatedLedger = { ...ledger, accounts: { ...ledger.accounts, [agent]: next } };
			writeLedger(deps, VAULT_ROOT, updatedLedger);
			appendTransaction(deps, VAULT_ROOT, {
				ts: ctx.deps.clock.iso(),
				agent,
				type: "debug",
				xp: xpOverride >= 0 ? xpOverride : undefined,
				coin: coinOverride >= 0 ? coinOverride : undefined,
			});

			return { agent, changes };
		},
		renderer: renderDebugSet,
	}),

	"debug:trust": adaptDescriptor({
		flags: {
			agent: { type: "string", required: true, hint: "--agent=<name>" },
			op: { type: "string", required: true, hint: "--op=<operation>" },
			to: { type: "string", required: true, hint: "--to=<level>" },
		},
		handler: (ctx) => {
			const agent = ctx.flags.agent as string;
			const op = ctx.flags.op as string;
			const to = ctx.flags.to as string;

			const deps = trustDeps(ctx.deps);
			const profile = loadTrustProfile(deps, VAULT_ROOT, agent);
			const from = (profile.operations as Record<string, string>)[op] ?? "manual";

			const updatedOps = { ...profile.operations, [op]: to };
			const updatedProfile: AgentTrustProfile = { ...profile, operations: updatedOps as AgentTrustProfile["operations"] };
			saveTrustProfile(deps, VAULT_ROOT, agent, updatedProfile);

			appendTransaction(ledgerDeps(ctx.deps), VAULT_ROOT, {
				ts: ctx.deps.clock.iso(),
				agent,
				type: "debug",
			});

			return { agent, op, from, to };
		},
		renderer: renderDebugTrust,
	}),

	"debug:needs": adaptDescriptor({
		flags: {
			agent: { type: "string", required: true, hint: "--agent=<name>" },
			energy: { type: "number", default: -1, hint: "--energy=<n>" },
			hunger: { type: "number", default: -1, hint: "--hunger=<n>" },
			thirst: { type: "number", default: -1, hint: "--thirst=<n>" },
		},
		handler: (ctx) => {
			const agent = ctx.flags.agent as string;
			const energy = ctx.flags.energy as number;
			const hunger = ctx.flags.hunger as number;
			const thirst = ctx.flags.thirst as number;

			const components: Record<string, unknown> = {};
			if (energy >= 0) components.energy = energy;
			if (hunger >= 0) components.hunger = hunger;
			if (thirst >= 0) components.thirst = thirst;

			ctx.deps.worldState.updateEntity(agent, "agent", components);

			appendTransaction(ledgerDeps(ctx.deps), VAULT_ROOT, {
				ts: ctx.deps.clock.iso(),
				agent,
				type: "debug",
			});

			return {
				agent,
				energy: energy >= 0 ? energy : undefined,
				hunger: hunger >= 0 ? hunger : undefined,
				thirst: thirst >= 0 ? thirst : undefined,
			};
		},
		renderer: renderDebugNeeds,
	}),

	"debug:unlock": adaptDescriptor({
		flags: {
			agent: { type: "string", required: true, hint: "--agent=<name>" },
			capability: { type: "string", required: true, hint: "--capability=<name>" },
		},
		handler: (ctx) => {
			const agent = ctx.flags.agent as string;
			const capability = ctx.flags.capability as string;

			const jsonPath = agentJsonPath(ctx.deps, agent);
			const agentJson = readAgentJson(ctx.deps, jsonPath);

			const components = agentJson.components ?? [];
			const alreadyHas = components.some(c => c.name === capability);
			if (!alreadyHas) {
				components.push({ name: capability, type: "capability" });
			}

			writeAgentJson(ctx.deps, jsonPath, { ...agentJson, components });

			appendTransaction(ledgerDeps(ctx.deps), VAULT_ROOT, {
				ts: ctx.deps.clock.iso(),
				agent,
				type: "debug",
			});

			return { agent, capability, ok: true };
		},
		renderer: renderDebugUnlock,
	}),
};
