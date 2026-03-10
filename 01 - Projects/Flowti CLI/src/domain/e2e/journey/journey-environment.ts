/**
 * journey-environment.ts — Environment providers and capability registry.
 *
 * The CLI is the execution environment; projects declare what they need.
 * Each project target (cli, obsidian-plugin, typescript, etc.) has an
 * EnvironmentProvider that supplies additional tools and setup/teardown.
 *
 * Journey definitions declare requirements via `requires`. The CLI
 * resolves the provider, checks capabilities, and assembles the tool
 * registry before execution — dependency injection for test environments.
 */

import type { JourneyAction, ActionResult, JourneyExecutorOptions } from "./journey-types.js";
import type { ToolDeps } from "./journey-executor.js";

// ── Capability ───────────────────────────────────────────────────────

/** A named capability the environment can provide. */
export interface Capability {
	/** Unique identifier, e.g. "obsidian-cli", "test-vault", "frontmatter". */
	id: string;
	/** Human-readable name. */
	name: string;
	/** What this capability provides. */
	description: string;
	/**
	 * Check whether this capability is available in the current environment.
	 * Returns true if available, false (or a string reason) if not.
	 */
	check: (deps: ToolDeps) => boolean | string;
}

// ── Tool executor (same signature as journey-executor) ───────────────

export type ToolExecutor = (
	action: JourneyAction,
	deps: ToolDeps,
	opts: JourneyExecutorOptions,
) => ActionResult | Promise<ActionResult>;

// ── Environment provider ─────────────────────────────────────────────

/** An environment provider supplies tools and lifecycle for a project target. */
export interface EnvironmentProvider {
	/** The project target this provider serves. */
	target: string;
	/** Human-readable label. */
	label: string;
	/** Capabilities this provider enables. */
	capabilities: string[];
	/** Additional tools this provider contributes to the registry. */
	tools: Record<string, ToolExecutor>;
	/** Optional setup before journey execution. */
	setup?: (deps: ToolDeps, opts: JourneyExecutorOptions) => void | Promise<void>;
	/** Optional teardown after journey execution. */
	teardown?: (deps: ToolDeps) => void | Promise<void>;
}

// ── Journey requirements ─────────────────────────────────────────────

/** What a journey definition declares it needs from the environment. */
export interface JourneyRequirements {
	/** Project target type. */
	target: string;
	/** Capability IDs the journey depends on. */
	capabilities?: string[];
}

// ── Capability check result ──────────────────────────────────────────

export interface CapabilityCheckResult {
	id: string;
	available: boolean;
	reason?: string;
}

// ── Environment registry ─────────────────────────────────────────────

/** Registry that maps targets to providers and tracks available capabilities. */
export interface EnvironmentRegistry {
	/** Register an environment provider for a target. */
	registerProvider(provider: EnvironmentProvider): void;
	/** Get the provider for a target. */
	getProvider(target: string): EnvironmentProvider | undefined;
	/** List all registered target names. */
	targets(): string[];
	/** Register a standalone capability (not tied to a provider). */
	registerCapability(capability: Capability): void;
	/** Check whether specific capabilities are available. */
	checkCapabilities(ids: string[], deps: ToolDeps): CapabilityCheckResult[];
	/** Resolve the full tool registry for a target (base + provider tools). */
	resolveTools(target: string, baseTools: Record<string, ToolExecutor>): Record<string, ToolExecutor>;
}

export function createEnvironmentRegistry(): EnvironmentRegistry {
	const providers = new Map<string, EnvironmentProvider>();
	const capabilities = new Map<string, Capability>();

	return {
		registerProvider(provider) {
			providers.set(provider.target, provider);
		},

		getProvider(target) {
			return providers.get(target);
		},

		targets() {
			return [...providers.keys()];
		},

		registerCapability(capability) {
			capabilities.set(capability.id, capability);
		},

		checkCapabilities(ids, deps) {
			return ids.map((id) => {
				const cap = capabilities.get(id);
				if (!cap) return { id, available: false, reason: `Unknown capability: ${id}` };
				const result = cap.check(deps);
				if (result === true) return { id, available: true };
				return { id, available: false, reason: typeof result === "string" ? result : `Capability "${id}" not available` };
			});
		},

		resolveTools(target, baseTools) {
			const provider = providers.get(target);
			if (!provider) return { ...baseTools };
			return { ...baseTools, ...provider.tools };
		},
	};
}
