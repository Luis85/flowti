/**
 * provider-registry.ts — Manages available LLM providers and selects the right one.
 *
 * Implements IProviderRegistry (domain contract).
 * Selection logic: preferred → utility-route-to-ollama → fallback → throw.
 */

import type { IProviderRegistry, ILLMProvider, SelectOptions, ProviderSelection, ProviderCapabilities } from "../../domain/agents/llm-types.js";

function meetsRequirements(caps: ProviderCapabilities, required?: Partial<ProviderCapabilities>): boolean {
	if (!required) return true;
	if (required.streaming !== undefined && caps.streaming !== required.streaming) return false;
	if (required.thinking !== undefined && caps.thinking !== required.thinking) return false;
	if (required.toolUse !== undefined && caps.toolUse !== required.toolUse) return false;
	if (required.structuredOutput !== undefined && caps.structuredOutput !== required.structuredOutput) return false;
	return true;
}

export function createProviderRegistry(): IProviderRegistry {
	const providers = new Map<string, ILLMProvider>();

	return {
		register(provider) {
			providers.set(provider.name, provider);
		},

		get(name) {
			return providers.get(name);
		},

		list() {
			return [...providers.values()];
		},

		select(options: SelectOptions): ProviderSelection {
			const { preferred, taskType, required } = options;

			// 1. Preferred provider, if it meets requirements
			if (preferred) {
				const prov = providers.get(preferred);
				if (prov && meetsRequirements(prov.capabilities(), required)) {
					return { provider: prov, reason: "configured" };
				}
			}

			// 2. Utility tasks → route to ollama when available
			if (taskType === "utility") {
				const ollama = providers.get("ollama");
				if (ollama && meetsRequirements(ollama.capabilities(), required)) {
					return { provider: ollama, reason: "routed" };
				}
			}

			// 3. Fallback — first provider meeting requirements
			for (const prov of providers.values()) {
				if (meetsRequirements(prov.capabilities(), required)) {
					return { provider: prov, reason: "fallback" };
				}
			}

			// 4. Nothing works
			const names = [...providers.keys()].join(", ") || "none registered";
			const reqs = required ? JSON.stringify(required) : "none";
			throw new Error(`No provider meets requirements (${reqs}). Available: ${names}`);
		},
	};
}
