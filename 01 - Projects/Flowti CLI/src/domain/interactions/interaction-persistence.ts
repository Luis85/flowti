import type { Interaction } from "./interaction-types.js";
import { HISTORY_BUFFER_SIZE, isValidInteraction } from "./interaction-types.js";

// ── Deps ───────────────────────────────────────────────────────────────

export interface PersistenceDeps {
	readonly disk: {
		existsSync(path: string): boolean;
		readFileSync(path: string, encoding: string): string;
		appendFileSync(path: string, data: string): void;
		mkdirSync(path: string, options?: { recursive?: boolean }): void;
	};
	readonly paths: {
		join(...segments: string[]): string;
		dirname(path: string): string;
	};
}

// ── Constants ──────────────────────────────────────────────────────────

const LOG_FILE = "interaction-log.jsonl";
const SCHEMA_VERSION = 1;

// ── appendInteraction ──────────────────────────────────────────────────

export function appendInteraction(
	deps: PersistenceDeps,
	projectPath: string,
	interaction: Interaction,
): void {
	const filePath = deps.paths.join(projectPath, ".flowti", "var", LOG_FILE);
	const dir = deps.paths.dirname(filePath);
	deps.disk.mkdirSync(dir, { recursive: true });
	const line = JSON.stringify({ v: SCHEMA_VERSION, ...interaction }) + "\n";
	deps.disk.appendFileSync(filePath, line);
}

// ── loadHistory ────────────────────────────────────────────────────────

export function loadHistory(
	deps: PersistenceDeps,
	projectPath: string,
): Interaction[] {
	const filePath = deps.paths.join(projectPath, ".flowti", "var", LOG_FILE);
	if (!deps.disk.existsSync(filePath)) return [];

	const content = deps.disk.readFileSync(filePath, "utf-8");
	const lines = content.split("\n");
	const entries: Interaction[] = [];

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed === "") continue;
		try {
			const parsed = JSON.parse(trimmed) as Record<string, unknown>;
			const { v: _v, ...rest } = parsed;
			void _v;
			const candidate = rest as unknown as Interaction;
			if (isValidInteraction(candidate)) {
				entries.push(candidate);
			}
		} catch {
			// Skip malformed lines
		}
	}

	return entries.slice(-HISTORY_BUFFER_SIZE);
}

// ── restoreCooldowns ───────────────────────────────────────────────────

export function restoreCooldowns(
	history: Interaction[],
): Map<string, number> {
	const cooldowns = new Map<string, number>();

	for (const interaction of history) {
		const key = `${interaction.initiator.entityType}:${interaction.initiator.id}:${interaction.action}`;
		const expiry = interaction.timestamp + interaction.cooldownMs;
		cooldowns.set(key, expiry);
	}

	return cooldowns;
}
