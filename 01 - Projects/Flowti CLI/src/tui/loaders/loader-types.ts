/**
 * loader-types.ts — Type definitions for the TUI loader pattern.
 *
 * Loaders are pure functions that receive a LoaderContext and return typed data.
 * They follow the existing ISP pattern — no singleton imports.
 */

import type { CliDeps } from "../../infrastructure/deps.js";
import type { AgentsConfig } from "../../infrastructure/types-config.js";

/** Dependencies available to loaders — ISP subset of CliDeps. */
export type LoaderDeps = Pick<CliDeps, "disk" | "paths" | "clock" | "shell" | "log">;

/** Full context passed to every loader function. */
export interface LoaderContext {
	readonly deps: LoaderDeps;
	readonly vaultRoot: string;
	readonly projectPath: string | undefined;
	readonly agentsConfig: AgentsConfig | undefined;
	readonly params: Readonly<Record<string, string>>;
}

/** A loader function — pure, sync, returns typed data. */
export type LoaderFn<T> = (ctx: LoaderContext) => T;
