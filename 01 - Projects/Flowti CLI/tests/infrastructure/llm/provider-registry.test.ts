import { describe, it, expect } from "vitest";
import { createProviderRegistry } from "../../../src/infrastructure/llm/provider-registry.js";
import type { ILLMProvider, ProviderCapabilities } from "../../../src/domain/agents/llm-types.js";

function mockProvider(name: string, caps: Partial<ProviderCapabilities> = {}): ILLMProvider {
	const defaults: ProviderCapabilities = { streaming: true, thinking: false, toolUse: false, structuredOutput: false };
	return {
		name,
		capabilities: () => ({ ...defaults, ...caps }),
		execute: () => ({ onEvent: () => () => {}, result: Promise.resolve({ text: "", thinking: "", exitCode: 0 }), kill: () => {} }),
	};
}

describe("createProviderRegistry", () => {
	describe("register and get", () => {
		it("registers and retrieves a provider by name", () => {
			const registry = createProviderRegistry();
			const claude = mockProvider("anthropic");
			registry.register(claude);
			expect(registry.get("anthropic")).toBe(claude);
		});

		it("returns undefined for unknown provider", () => {
			const registry = createProviderRegistry();
			expect(registry.get("unknown")).toBeUndefined();
		});

		it("lists all registered providers", () => {
			const registry = createProviderRegistry();
			registry.register(mockProvider("anthropic"));
			registry.register(mockProvider("cursor"));
			expect(registry.list()).toHaveLength(2);
		});
	});

	describe("select — preferred", () => {
		it("selects preferred provider when it meets requirements", () => {
			const registry = createProviderRegistry();
			registry.register(mockProvider("anthropic", { toolUse: true }));
			registry.register(mockProvider("cursor", { toolUse: true }));
			const result = registry.select({ preferred: "cursor", taskType: "conversation", required: { toolUse: true } });
			expect(result.provider.name).toBe("cursor");
			expect(result.reason).toBe("configured");
		});

		it("skips preferred provider when it does not meet requirements", () => {
			const registry = createProviderRegistry();
			registry.register(mockProvider("anthropic", { toolUse: true }));
			registry.register(mockProvider("ollama", { toolUse: false }));
			const result = registry.select({ preferred: "ollama", taskType: "autonomous", required: { toolUse: true } });
			expect(result.provider.name).toBe("anthropic");
			expect(result.reason).toBe("fallback");
		});
	});

	describe("select — utility routing", () => {
		it("routes utility tasks to ollama when available", () => {
			const registry = createProviderRegistry();
			registry.register(mockProvider("anthropic"));
			registry.register(mockProvider("ollama"));
			const result = registry.select({ taskType: "utility", required: { streaming: true } });
			expect(result.provider.name).toBe("ollama");
			expect(result.reason).toBe("routed");
		});

		it("falls back when ollama is not registered", () => {
			const registry = createProviderRegistry();
			registry.register(mockProvider("anthropic"));
			const result = registry.select({ taskType: "utility", required: { streaming: true } });
			expect(result.provider.name).toBe("anthropic");
			expect(result.reason).toBe("fallback");
		});
	});

	describe("select — fallback", () => {
		it("returns first provider meeting requirements", () => {
			const registry = createProviderRegistry();
			registry.register(mockProvider("anthropic", { thinking: true }));
			registry.register(mockProvider("cursor"));
			const result = registry.select({ taskType: "conversation", required: { thinking: true } });
			expect(result.provider.name).toBe("anthropic");
			expect(result.reason).toBe("fallback");
		});

		it("throws when no provider meets requirements", () => {
			const registry = createProviderRegistry();
			registry.register(mockProvider("ollama"));
			expect(() => registry.select({
				taskType: "autonomous",
				required: { toolUse: true },
			})).toThrow(/No provider/);
		});

		it("throws when registry is empty", () => {
			const registry = createProviderRegistry();
			expect(() => registry.select({ taskType: "conversation" })).toThrow(/No provider/);
		});
	});
});
