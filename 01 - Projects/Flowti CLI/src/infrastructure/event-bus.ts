/**
 * event-bus.ts — Lightweight synchronous EventBus for the Flowti CLI.
 *
 * Modeled on the Obsidian plugin's EventBus but simplified for CLI:
 * - Synchronous handlers only (CLI is single-threaded)
 * - Factory function instead of class (easy per-test creation)
 * - Error isolation (handler errors don't crash the pipeline)
 * - No wildcard, no timestamps, no async
 */

import type { CliEventMap } from "./cli-events.js";

// ── Event types ─────────────────────────────────────────────────────

export interface CliEvent<K extends keyof CliEventMap = keyof CliEventMap> {
	readonly type: K;
	readonly payload: CliEventMap[K];
}

export type CliEventHandler<K extends keyof CliEventMap = keyof CliEventMap> =
	(event: CliEvent<K>) => void;

// ── Bus interface ───────────────────────────────────────────────────

export interface ICliBus {
	emit<K extends keyof CliEventMap>(type: K, payload: CliEventMap[K]): void;
	on<K extends keyof CliEventMap>(type: K, handler: CliEventHandler<K>): () => void;
	once<K extends keyof CliEventMap>(type: K, handler: CliEventHandler<K>): () => void;
	clear(): void;
}

// ── Factory ─────────────────────────────────────────────────────────

export function createCliBus(): ICliBus {
	const handlers = new Map<string, Set<CliEventHandler<never>>>();

	return {
		emit<K extends keyof CliEventMap>(type: K, payload: CliEventMap[K]): void {
			const event = { type, payload } as CliEvent<K>;
			for (const h of handlers.get(type as string) ?? []) {
				try {
					(h as CliEventHandler<K>)(event);
				} catch {
					/* swallow — isolated */
				}
			}
		},

		on<K extends keyof CliEventMap>(type: K, handler: CliEventHandler<K>): () => void {
			const key = type as string;
			if (!handlers.has(key)) handlers.set(key, new Set());
			handlers.get(key)!.add(handler as CliEventHandler<never>);
			return () => {
				handlers.get(key)?.delete(handler as CliEventHandler<never>);
			};
		},

		once<K extends keyof CliEventMap>(type: K, handler: CliEventHandler<K>): () => void {
			const unsub = this.on(type, (e) => {
				unsub();
				handler(e);
			});
			return unsub;
		},

		clear(): void {
			handlers.clear();
		},
	};
}
