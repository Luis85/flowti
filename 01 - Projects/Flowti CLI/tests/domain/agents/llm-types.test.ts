import { describe, it, expectTypeOf } from "vitest";
import type {
	ProviderCapabilities, PromptEnvelope, AgentIdentity, LLMTaskContext,
	ResponseFormatHint, LLMRequest, LLMEvent, LLMResult, LLMProcess,
	ILLMProvider, IProviderRegistry, TaskType, SelectionReason,
	ProviderSelection, SelectOptions,
} from "../../../src/domain/agents/llm-types.js";

describe("llm-types", () => {
	it("ProviderCapabilities has required boolean fields", () => {
		expectTypeOf<ProviderCapabilities>().toHaveProperty("streaming");
		expectTypeOf<ProviderCapabilities>().toHaveProperty("thinking");
		expectTypeOf<ProviderCapabilities>().toHaveProperty("toolUse");
		expectTypeOf<ProviderCapabilities>().toHaveProperty("structuredOutput");
	});

	it("PromptEnvelope requires message, everything else optional", () => {
		const envelope: PromptEnvelope = { message: "hello" };
		expectTypeOf(envelope).toMatchTypeOf<PromptEnvelope>();
	});

	it("LLMEvent union covers all event kinds", () => {
		const events: LLMEvent[] = [
			{ kind: "thinking", text: "" },
			{ kind: "text", text: "" },
			{ kind: "tool-start", id: "1", name: "Bash" },
			{ kind: "tool-input", index: 0, json: "{}" },
			{ kind: "tool-end", id: "1" },
			{ kind: "error", message: "fail" },
			{ kind: "usage", inputTokens: 0, outputTokens: 0 },
			{ kind: "done" },
		];
		expectTypeOf(events).toMatchTypeOf<LLMEvent[]>();
	});

	it("ILLMProvider has name, capabilities, and execute", () => {
		expectTypeOf<ILLMProvider>().toHaveProperty("name");
		expectTypeOf<ILLMProvider>().toHaveProperty("capabilities");
		expectTypeOf<ILLMProvider>().toHaveProperty("execute");
	});

	it("SelectionReason is a string union", () => {
		const reasons: SelectionReason[] = ["configured", "routed", "fallback"];
		expectTypeOf(reasons).toMatchTypeOf<SelectionReason[]>();
	});
});
