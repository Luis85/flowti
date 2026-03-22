import { describe, it, expect, vi, beforeEach } from "vitest";
import { createOllamaProvider } from "../../../src/infrastructure/llm/ollama-provider.js";
import type { LLMEvent } from "../../../src/domain/agents/llm-types.js";

// Mock http module
const mockRequest = vi.fn();
vi.mock("node:http", () => ({
	default: { request: (...args: unknown[]) => mockRequest(...args) },
	request: (...args: unknown[]) => mockRequest(...args),
}));

function setupMockResponse(chunks: string[], statusCode = 200) {
	const responseCallbacks = new Map<string, (...args: unknown[]) => void>();
	const mockRes = {
		statusCode,
		on: vi.fn((event: string, cb: (...args: unknown[]) => void) => { responseCallbacks.set(event, cb); }),
	};
	const requestCallbacks = new Map<string, (...args: unknown[]) => void>();
	const mockReq = {
		on: vi.fn((event: string, cb: (...args: unknown[]) => void) => { requestCallbacks.set(event, cb); }),
		write: vi.fn(),
		end: vi.fn(() => {
			// Defer response simulation to next microtask so onEvent subscribers register first
			queueMicrotask(() => {
				const responseCb = mockRequest.mock.calls[0]?.[1] as ((...a: unknown[]) => void) | undefined;
				if (typeof responseCb === "function") responseCb(mockRes);
				const dataCb = responseCallbacks.get("data");
				if (dataCb) for (const chunk of chunks) dataCb(Buffer.from(chunk + "\n"));
				const endCb = responseCallbacks.get("end");
				if (endCb) endCb();
			});
		}),
		destroy: vi.fn(),
	};
	mockRequest.mockReturnValue(mockReq);
	return { mockReq, mockRes };
}

beforeEach(() => {
	mockRequest.mockReset();
});

describe("createOllamaProvider", () => {
	it("has name 'ollama'", () => {
		expect(createOllamaProvider().name).toBe("ollama");
	});

	it("reports utility-tier capabilities", () => {
		const caps = createOllamaProvider().capabilities();
		expect(caps.streaming).toBe(true);
		expect(caps.thinking).toBe(false);
		expect(caps.toolUse).toBe(false);
		expect(caps.structuredOutput).toBe(false);
	});

	it("execute sends HTTP POST to localhost:11434", async () => {
		setupMockResponse([JSON.stringify({ response: "Hi!", done: false }), JSON.stringify({ response: "", done: true })]);
		const provider = createOllamaProvider();
		const proc = provider.execute({ prompt: { message: "hello" } });
		const result = await proc.result;
		expect(result.text).toBe("Hi!");
		expect(mockRequest).toHaveBeenCalledWith(
			expect.objectContaining({ hostname: "localhost", port: 11434, path: "/api/generate", method: "POST" }),
			expect.any(Function),
		);
	});

	it("emits text events for each response chunk", async () => {
		setupMockResponse([JSON.stringify({ response: "chunk1", done: false }), JSON.stringify({ response: "chunk2", done: false }), JSON.stringify({ response: "", done: true })]);
		const provider = createOllamaProvider();
		const proc = provider.execute({ prompt: { message: "hello" } });
		const events: LLMEvent[] = [];
		proc.onEvent((e) => events.push(e));
		await proc.result;
		const textEvents = events.filter((e) => e.kind === "text");
		expect(textEvents).toHaveLength(2);
	});

	it("kill destroys the HTTP request", () => {
		const { mockReq } = setupMockResponse([]);
		const provider = createOllamaProvider();
		const proc = provider.execute({ prompt: { message: "hello" } });
		proc.kill();
		expect(mockReq.destroy).toHaveBeenCalled();
	});

	it("reports persistentSession capability", () => {
		const caps = createOllamaProvider().capabilities();
		expect(caps.persistentSession).toBe(true);
	});

	describe("createSession", () => {
		it("returns a session object with send, kill, alive", () => {
			const provider = createOllamaProvider();
			const session = provider.createSession!({});
			expect(typeof session.send).toBe("function");
			expect(typeof session.kill).toBe("function");
			expect(session.alive).toBe(true);
		});

		it("session.alive is true initially", () => {
			const provider = createOllamaProvider();
			const session = provider.createSession!({});
			expect(session.alive).toBe(true);
		});

		it("session.kill sets alive to false", () => {
			const provider = createOllamaProvider();
			const session = provider.createSession!({});
			expect(session.alive).toBe(true);
			session.kill();
			expect(session.alive).toBe(false);
		});

		it("send posts to /api/chat with messages history", async () => {
			setupMockResponse([
				JSON.stringify({ message: { role: "assistant", content: "Hello!" }, done: false }),
				JSON.stringify({ message: { role: "assistant", content: "" }, done: true }),
			]);
			const provider = createOllamaProvider();
			const session = provider.createSession!({});
			const proc = session.send("hi");
			const result = await proc.result;
			expect(result.text).toBe("Hello!");
			expect(result.exitCode).toBe(0);
			expect(mockRequest).toHaveBeenCalledWith(
				expect.objectContaining({ hostname: "localhost", port: 11434, path: "/api/chat", method: "POST" }),
				expect.any(Function),
			);
		});

		it("emits text events during session send", async () => {
			setupMockResponse([
				JSON.stringify({ message: { role: "assistant", content: "chunk1" }, done: false }),
				JSON.stringify({ message: { role: "assistant", content: "chunk2" }, done: false }),
				JSON.stringify({ message: { role: "assistant", content: "" }, done: true }),
			]);
			const provider = createOllamaProvider();
			const session = provider.createSession!({});
			const proc = session.send("hello");
			const events: LLMEvent[] = [];
			proc.onEvent((e) => events.push(e));
			await proc.result;
			const textEvents = events.filter((e) => e.kind === "text");
			expect(textEvents).toHaveLength(2);
		});
	});
});
