/**
 * llm-router.ts — Routing helpers for LLM provider selection.
 *
 * Pure functions. No I/O, no side effects.
 */

import type { IProviderRegistry, ProviderSelection } from "./llm-types.js";

/** Select a provider for lightweight utility tasks (summarization, classification). */
export function selectForUtility(registry: IProviderRegistry): ProviderSelection {
	return registry.select({ taskType: "utility", required: { streaming: true } });
}
