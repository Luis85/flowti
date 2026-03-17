/**
 * ollama-provider.ts — Ollama HTTP adapter implementing ILLMProvider.
 *
 * HTTP POST to localhost:11434/api/generate with streaming NDJSON.
 * Utility-tier: no tool use, no thinking, no structured output.
 * Uses Node.js built-in http module (zero deps).
 */

import http from "node:http";
import type { ILLMProvider, LLMRequest, LLMProcess, LLMEvent, LLMResult, ProviderCapabilities } from "../../domain/agents/llm-types.js";
import { formatPrompt, isPreFormatted } from "../../domain/agents/llm-prompt.js";

const CAPABILITIES: ProviderCapabilities = {
	streaming: true,
	thinking: false,
	toolUse: false,
	structuredOutput: false,
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
	};
}
