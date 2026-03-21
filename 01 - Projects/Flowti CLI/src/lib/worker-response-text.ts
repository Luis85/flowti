/**
 * Final worker `onResponse` payload shape varies by LLM provider / runner.
 * Agent JSONL events and the HTTP API use the normalized string as assistant text.
 */
export function textFromWorkerResponsePayload(n: unknown): string {
	if (n == null || typeof n !== "object") return "";
	const o = n as Record<string, unknown>;
	let msg: unknown = o.message ?? o.text ?? o.response ?? o.content;
	if (typeof msg !== "string") msg = msg != null ? String(msg) : "";
	return msg as string;
}
