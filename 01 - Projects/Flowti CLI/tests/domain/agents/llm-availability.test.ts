import { describe, it, expect } from "vitest";
import { hasLLMProvider } from "../../../src/domain/agents/llm-availability.js";
import type { IProviderRegistry, ILLMProvider } from "../../../src/domain/agents/llm-types.js";

function mockProvider(name: string): ILLMProvider {
	return {
		name,
		capabilities: () => ({ streaming: true, thinking: false, toolUse: false, structuredOutput: false }),
		execute: () => ({ onEvent: () => () => {}, result: Promise.resolve({ text: "", thinking: "", exitCode: 0 }), kill: () => {} }),
	};
}

function mockRegistry(providers: ILLMProvider[]): IProviderRegistry {
	return {
		register: () => {},
		get: (n: string) => providers.find((p) => p.name === n),
		list: () => providers,
		select: () => { throw new Error("unused"); },
	};
}

describe("hasLLMProvider", () => {
	it("returns false when registry is undefined", () => {
		expect(hasLLMProvider(undefined)).toBe(false);
	});

	it("returns false when registry has no providers", () => {
		expect(hasLLMProvider(mockRegistry([]))).toBe(false);
	});

	it("returns true when registry has at least one provider", () => {
		expect(hasLLMProvider(mockRegistry([mockProvider("anthropic")]))).toBe(true);
	});

	it("returns true when registry has cursor only", () => {
		expect(hasLLMProvider(mockRegistry([mockProvider("cursor")]))).toBe(true);
	});

	it("returns true when registry has multiple providers", () => {
		expect(hasLLMProvider(mockRegistry([mockProvider("anthropic"), mockProvider("cursor"), mockProvider("ollama")]))).toBe(true);
	});
});
