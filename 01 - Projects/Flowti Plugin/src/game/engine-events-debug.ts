/**
 * engine-events-debug.ts — Wire debug panel custom events to CLI commands
 * and local game state mutations.
 *
 * The debug panel (panel-debug.ts) dispatches bubbling custom events:
 *   - debug-stat-adjust  { stat, delta }
 *   - debug-stat-set     { stat, value }
 *   - debug-need-set     { need, value }
 *   - debug-trust-mode   { op, mode }
 *   - debug-economy-cheat { action }
 *
 * Economy / trust mutations call CLI commands for persistence, then
 * refresh the store for immediate visual feedback.
 * Needs mutations are local game state only (NeedsSystem).
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { EngineContext } from "./engine-types.js";
import { findNodeBinary } from "../infrastructure/agents/cli-executor.js";
import { runOneShotCommand } from "../infrastructure/agents/cli-executor-helpers.js";

// ── CLI helper ───────────────────────────────────────────────────────

async function runCli(
	vaultBasePath: string,
	args: string[],
): Promise<unknown> {
	const nodeBin = findNodeBinary();
	const cliBin = join(vaultBasePath, ".flowti", "bin", "main.mjs");
	if (!nodeBin || !existsSync(cliBin)) return undefined;
	return runOneShotCommand(nodeBin, cliBin, [...args, "--format=json"], vaultBasePath);
}

/** Re-read the CLI ledger and push fresh economy data into the store. */
async function refreshEconomy(
	ctx: EngineContext,
	vaultBasePath: string,
	agentName: string,
): Promise<void> {
	try {
		const result = await runCli(vaultBasePath, ["economy:balance", `--agent=${agentName}`]);
		const bal = result as {
			xp?: number; level?: number; coin?: number; tokens?: number;
		} | undefined;
		if (bal) {
			ctx.store.setAgentEconomy(agentName, {
				xp: bal.xp,
				level: bal.level,
				coin: bal.coin,
				tokens: bal.tokens,
			});
		}
	} catch {
		// CLI unavailable — store keeps its current state
	}
}

// ── Stat helpers ─────────────────────────────────────────────────────

/** Map a stat key to the CLI flag(s) needed to grant that stat. */
function statToGrantArgs(stat: string, amount: number): string[] | null {
	switch (stat) {
		case "coin": return [`--coin=${amount}`];
		case "tokens": return [`--tokens=${amount}`];
		case "xp": return [`--xp=${amount}`];
		default: return null;
	}
}

// ── Cheat action map ─────────────────────────────────────────────────

interface CheatSpec {
	readonly command: string;
	readonly args: string[];
}

function cheatToSpec(action: string, agentName: string): CheatSpec | null {
	switch (action) {
		case "add-coin-500":
			return { command: "economy:grant", args: [`--agent=${agentName}`, "--coin=500"] };
		case "add-tokens-10000":
			return { command: "economy:grant", args: [`--agent=${agentName}`, "--tokens=10000"] };
		case "add-xp-500":
			return { command: "economy:reward", args: [`--agent=${agentName}`, "--xp=500"] };
		case "level-up":
			return { command: "economy:reward", args: [`--agent=${agentName}`, "--xp=9999"] };
		default:
			return null;
	}
}

// ── Trust mode map ───────────────────────────────────────────────────

function trustModeToLevel(mode: string): string {
	switch (mode) {
		case "AUTO": return "autonomous";
		case "REVIEW": return "review";
		case "MANUAL": return "manual";
		default: return "review";
	}
}

// ── Main wiring ──────────────────────────────────────────────────────

export function wireDebugEvents(ctx: EngineContext, vaultBasePath?: string): () => void {
	const container = ctx.engine.canvas.parentElement;
	if (!container) return () => { /* no-op */ };

	const handlers: Array<{ event: string; handler: EventListener }> = [];

	const on = (event: string, handler: EventListener): void => {
		container.addEventListener(event, handler);
		handlers.push({ event, handler });
	};

	// ── debug-stat-adjust: { stat, delta } ───────────────────────
	on("debug-stat-adjust", ((e: CustomEvent) => {
		const agentName = ctx.store.selectedAgent;
		if (!agentName) return;
		const { stat, delta } = e.detail as { stat: string; delta: number };

		// Level adjustments are store-only (no CLI grant command for level)
		if (stat === "level") {
			const current = ctx.store.getAgentEconomy(agentName);
			if (current) {
				ctx.store.setAgentEconomy(agentName, { level: Math.max(1, current.level + delta) });
			}
			return;
		}

		// XP / coin / tokens: apply locally, then persist via CLI
		const current = ctx.store.getAgentEconomy(agentName);
		if (current) {
			const newValue = Math.max(0, (current[stat as keyof typeof current] as number ?? 0) + delta);
			ctx.store.setAgentEconomy(agentName, { [stat]: newValue });
		}
		if (vaultBasePath) {
			const args = statToGrantArgs(stat, delta);
			if (args) {
				const cmd = stat === "xp" ? "economy:reward" : "economy:grant";
				void runCli(vaultBasePath, [cmd, `--agent=${agentName}`, ...args])
					.then(() => refreshEconomy(ctx, vaultBasePath, agentName))
					.catch(() => { /* CLI unavailable */ });
			}
		}
	}) as EventListener);

	// ── debug-stat-set: { stat, value } ──────────────────────────
	on("debug-stat-set", ((e: CustomEvent) => {
		const agentName = ctx.store.selectedAgent;
		if (!agentName) return;
		const { stat, value } = e.detail as { stat: string; value: number };

		// Read BEFORE updating so delta is correct
		const current = ctx.store.getAgentEconomy(agentName);
		const prev = current ? (current[stat as keyof typeof current] as number ?? 0) : 0;

		// Immediate store update
		ctx.store.setAgentEconomy(agentName, { [stat]: Math.max(0, value) });

		// Persist via CLI: compute delta from current and grant
		if (vaultBasePath && stat !== "level") {
			const delta = value - prev;
			if (delta !== 0) {
				const args = statToGrantArgs(stat, delta);
				if (args) {
					const cmd = stat === "xp" ? "economy:reward" : "economy:grant";
					void runCli(vaultBasePath, [cmd, `--agent=${agentName}`, ...args])
						.then(() => refreshEconomy(ctx, vaultBasePath, agentName))
						.catch(() => { /* CLI unavailable */ });
				}
			}
		}
	}) as EventListener);

	// ── debug-need-set: { need, value } ──────────────────────────
	on("debug-need-set", ((e: CustomEvent) => {
		const agentName = ctx.store.selectedAgent;
		if (!agentName) return;
		const { need, value } = e.detail as { need: string; value: number };

		// Needs are local game state — compute delta and apply
		const current = ctx.systems.needs.getNeeds(agentName);
		const prev = current[need as keyof typeof current] ?? 50;
		const delta = value - prev;
		if (delta !== 0) {
			ctx.systems.needs.applyEffect(agentName, { [need]: delta });
		}
	}) as EventListener);

	// ── debug-trust-mode: { op, mode } ───────────────────────────
	on("debug-trust-mode", ((e: CustomEvent) => {
		const agentName = ctx.store.selectedAgent;
		if (!agentName || !vaultBasePath) return;
		const { op, mode } = e.detail as { op: string; mode: string };
		const level = trustModeToLevel(mode);

		void runCli(vaultBasePath, [
			"trust:promote",
			`--agent=${agentName}`,
			`--op=${op}`,
			`--to=${level}`,
			`--reason=debug panel override`,
		]).catch(() => { /* CLI unavailable */ });
	}) as EventListener);

	// ── debug-economy-cheat: { action } ──────────────────────────
	on("debug-economy-cheat", ((e: CustomEvent) => {
		const agentName = ctx.store.selectedAgent;
		if (!agentName) return;
		const { action } = e.detail as { action: string };
		const spec = cheatToSpec(action, agentName);
		if (!spec) return;

		// Immediate optimistic store update
		const current = ctx.store.getAgentEconomy(agentName);
		if (current) {
			switch (action) {
				case "add-coin-500":
					ctx.store.setAgentEconomy(agentName, { coin: current.coin + 500 });
					break;
				case "add-tokens-10000":
					ctx.store.setAgentEconomy(agentName, { tokens: current.tokens + 10000 });
					break;
				case "add-xp-500":
					ctx.store.setAgentEconomy(agentName, { xp: current.xp + 500 });
					break;
				case "level-up":
					ctx.store.setAgentEconomy(agentName, { level: current.level + 1 });
					break;
			}
		}

		// Persist via CLI
		if (vaultBasePath) {
			void runCli(vaultBasePath, [spec.command, ...spec.args])
				.then(() => refreshEconomy(ctx, vaultBasePath, agentName))
				.catch(() => { /* CLI unavailable */ });
		}
	}) as EventListener);

	return () => {
		for (const { event, handler } of handlers) {
			container.removeEventListener(event, handler);
		}
	};
}
