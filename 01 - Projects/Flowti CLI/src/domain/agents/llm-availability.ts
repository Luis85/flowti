/**
 * llm-availability.ts — Pure check for LLM provider availability.
 *
 * Domain-layer helper — no I/O, no side effects.
 * UI guards call this instead of hardcoding CLI binary checks.
 */

import type { IProviderRegistry } from "./llm-types.js";

/** Returns true when at least one LLM provider is registered. */
export function hasLLMProvider(registry?: IProviderRegistry): boolean {
	if (!registry) return false;
	return registry.list().length > 0;
}
