import { describe, it, expect } from "vitest";
import { selectForUtility } from "../../../src/domain/agents/llm-router.js";
import type { IProviderRegistry, ILLMProvider, ProviderCapabilities, SelectOptions } from "../../../src/domain/agents/llm-types.js";

function mockProvider(name: string, caps: Partial<ProviderCapabilities> = {}): ILLMProvider {
	return {
		name,
		capabilities: () => ({ streaming: true, thinking: false, toolUse: false, structuredOutput: false, ...caps }),
		execute: () => ({ onEvent: () => () => {}, result: Promise.resolve({ text: "", thinking: "", exitCode: 0 }), kill: () => {} }),
	};
}

function mockRegistry(providers: ILLMProvider[]): IProviderRegistry {
	const map = new Map(providers.map((p) => [p.name, p]));
	return {
		register: () => {},
		get: (name) => map.get(name),
		list: () => [...map.values()],
		select: (opts: SelectOptions) => {
			const prov = opts.preferred ? map.get(opts.preferred) : providers[0];
			return { provider: prov ?? providers[0], reason: "fallback" as const };
		},
	};
}

describe("selectForUtility", () => {
	it("returns a provider selection", () => {
		const ollama = mockProvider("ollama");
		const registry = mockRegistry([ollama]);
		const result = selectForUtility(registry);
		expect(result.provider.name).toBe("ollama");
	});
});
