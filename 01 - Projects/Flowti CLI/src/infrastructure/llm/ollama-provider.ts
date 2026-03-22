/**
 * ollama-provider.ts — Ollama HTTP adapter implementing ILLMProvider.
 *
 * HTTP POST to localhost:11434/api/generate with streaming NDJSON.
 * Utility-tier: no tool use, no thinking, no structured output.
 * Uses Node.js built-in http module (zero deps).
 */

import http from "node:http";
import type { ILLMProvider, LLMRequest, LLMProcess, LLMEvent, LLMResult, ProviderCapabilities, LLMSession, LLMSessionRequest } from "../../domain/agents/llm-types.js";
import { formatPrompt, isPreFormatted } from "../../domain/agents/llm-prompt.js";

const CAPABILITIES: ProviderCapabilities = {
	streaming: true,
	thinking: false,
	toolUse: false,
	structuredOutput: false,
	persistentSession: true,
};

const DEFAULT_MODEL = "llama3.1";

export function createOllamaProvider(model?: string): ILLMProvider {
	const modelName = model ?? DEFAULT_MODEL;

	return {
		name: "ollama",

		capabilities() {
			return CAPABILITIES;
		},

		execute(request: LLMRequest): LLMProcess {
			const prompt = isPreFormatted(request.prompt)
				? request.prompt.message
				: formatPrompt(request.prompt, CAPABILITIES);

			const textBuffer: string[] = [];
			const subscribers = new Set<(event: LLMEvent) => void>();
			let req: http.ClientRequest | null = null;

			function emit(event: LLMEvent): void {
				for (const cb of subscribers) {
					try { cb(event); } catch { /* subscriber error */ }
				}
			}

			const body = JSON.stringify({ model: modelName, prompt, stream: true });

			const resultPromise = new Promise<LLMResult>((resolve) => {
				req = http.request(
					{ hostname: "localhost", port: 11434, path: "/api/generate", method: "POST", headers: { "Content-Type": "application/json" } },
					(res) => {
						if (res.statusCode !== 200) {
							emit({ kind: "error", message: `Ollama returned status ${res.statusCode}` });
							resolve({ text: "", thinking: "", exitCode: 1 });
							return;
						}
						let lineBuffer = "";
						res.on("data", (chunk: Buffer) => {
							lineBuffer += chunk.toString();
							const lines = lineBuffer.split("\n");
							lineBuffer = lines.pop() ?? "";
							for (const line of lines) {
								if (!line.trim()) continue;
								try {
									const parsed = JSON.parse(line) as Record<string, unknown>;
									if (typeof parsed.response === "string" && parsed.response) {
										textBuffer.push(parsed.response);
										emit({ kind: "text", text: parsed.response });
									}
									if (parsed.done === true) {
										emit({ kind: "done" });
									}
								} catch { /* invalid JSON line */ }
							}
						});
						res.on("end", () => {
							resolve({ text: textBuffer.join(""), thinking: "", exitCode: 0 });
						});
						res.on("error", () => {
							resolve({ text: textBuffer.join(""), thinking: "", exitCode: 1 });
						});
					},
				);
				req.on("error", (err) => {
					emit({ kind: "error", message: err.message });
					resolve({ text: "", thinking: "", exitCode: 1 });
				});
				req.write(body);
				req.end();
			});

			return {
				onEvent(callback) {
					subscribers.add(callback);
					return () => { subscribers.delete(callback); };
				},
				result: resultPromise,
				kill() {
					if (req) req.destroy();
				},
			};
		},

		createSession(_request: LLMSessionRequest): LLMSession {
			const messages: Array<{ role: string; content: string }> = [];
			let aborted = false;
			let activeReq: http.ClientRequest | null = null;

			return {
				send(message: string): LLMProcess {
					messages.push({ role: "user", content: message });

					const textBuffer: string[] = [];
					const subscribers = new Set<(event: LLMEvent) => void>();

					function emit(event: LLMEvent): void {
						for (const cb of subscribers) {
							try { cb(event); } catch { /* subscriber error */ }
						}
					}

					const body = JSON.stringify({ model: modelName, messages, stream: true });

					const resultPromise = new Promise<LLMResult>((resolve) => {
						if (aborted) {
							resolve({ text: "", thinking: "", exitCode: 1 });
							return;
						}

						activeReq = http.request(
							{ hostname: "localhost", port: 11434, path: "/api/chat", method: "POST", headers: { "Content-Type": "application/json" } },
							(res) => {
								if (res.statusCode !== 200) {
									emit({ kind: "error", message: `Ollama returned status ${res.statusCode}` });
									resolve({ text: "", thinking: "", exitCode: 1 });
									return;
								}
								let lineBuffer = "";
								res.on("data", (chunk: Buffer) => {
									lineBuffer += chunk.toString();
									const lines = lineBuffer.split("\n");
									lineBuffer = lines.pop() ?? "";
									for (const line of lines) {
										if (!line.trim()) continue;
										try {
											const parsed = JSON.parse(line) as Record<string, unknown>;
											const msg = parsed.message as Record<string, unknown> | undefined;
											if (msg && typeof msg.content === "string" && msg.content) {
												textBuffer.push(msg.content);
												emit({ kind: "text", text: msg.content });
											}
											if (parsed.done === true) {
												emit({ kind: "done" });
											}
										} catch { /* invalid JSON line */ }
									}
								});
								res.on("end", () => {
									const fullResponse = textBuffer.join("");
									messages.push({ role: "assistant", content: fullResponse });
									resolve({ text: fullResponse, thinking: "", exitCode: 0 });
								});
								res.on("error", () => {
									resolve({ text: textBuffer.join(""), thinking: "", exitCode: 1 });
								});
							},
						);
						activeReq.on("error", (err) => {
							emit({ kind: "error", message: err.message });
							resolve({ text: "", thinking: "", exitCode: 1 });
						});
						activeReq.write(body);
						activeReq.end();
					});

					return {
						onEvent(callback) {
							subscribers.add(callback);
							return () => { subscribers.delete(callback); };
						},
						result: resultPromise,
						kill() {
							if (activeReq) activeReq.destroy();
						},
					};
				},

				kill() {
					aborted = true;
					if (activeReq) activeReq.destroy();
				},

				get alive() {
					return !aborted;
				},
			};
		},
	};
}
