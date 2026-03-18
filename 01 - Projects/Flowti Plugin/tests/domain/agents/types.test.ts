import { describe, it, expectTypeOf } from "vitest";
import type {
	AgentCard, ConversationTurn, ConversationMode,
	ToolCall, AgentServiceEvent, IAgentService,
} from "../../../src/domain/agents/types";

describe("agent domain types", () => {
	it("AgentCard has required fields", () => {
		const card: AgentCard = {
			name: "atlas", activity: "idle",
		};
		expectTypeOf(card).toMatchTypeOf<AgentCard>();
	});

	it("ConversationTurn has required fields", () => {
		const turn: ConversationTurn = {
			id: "1", role: "agent", content: "hello", timestamp: "", mode: "conversational",
		};
		expectTypeOf(turn).toMatchTypeOf<ConversationTurn>();
	});

	it("AgentServiceEvent is a discriminated union", () => {
		const events: AgentServiceEvent[] = [
			{ kind: "status-changed", agent: "a", activity: "thinking" },
			{ kind: "message-received", agent: "a", turn: { id: "1", role: "agent", content: "", timestamp: "", mode: "conversational" } },
			{ kind: "thinking", agent: "a", text: "" },
			{ kind: "tool-started", agent: "a", tool: "Bash", id: "1" },
			{ kind: "tool-completed", agent: "a", id: "1" },
		];
		expectTypeOf(events).toMatchTypeOf<AgentServiceEvent[]>();
	});

	it("IAgentService has async sendMessage", () => {
		expectTypeOf<IAgentService>().toHaveProperty("sendMessage");
		expectTypeOf<IAgentService>().toHaveProperty("stopGeneration");
		expectTypeOf<IAgentService>().toHaveProperty("listAgents");
	});

	it("ConversationMode is a string union", () => {
		const modes: ConversationMode[] = ["document", "conversational", "canvas"];
		expectTypeOf(modes).toMatchTypeOf<ConversationMode[]>();
	});

	it("ToolCall has required fields", () => {
		const call: ToolCall = { id: "1", name: "Bash", status: "started" };
		expectTypeOf(call).toMatchTypeOf<ToolCall>();
	});
});
