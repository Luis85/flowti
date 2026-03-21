/**
 * Final worker payload shape varies by LLM provider. The agent JSONL line uses
 * the `text` field (see `azt` / line writer in the Flowti CLI bundle).
 *
 * When rebuilding `main.mjs`, wire `onResponse` to this helper so Talk / plugin
 * receive non-empty `response` events.
 */
export function textFromWorkerResponsePayload(n: unknown): string {
	if (n == null || typeof n !== "object") return "";
	const o = n as Record<string, unknown>;
	let msg: unknown = o.message ?? o.text ?? o.response ?? o.content;
	if (typeof msg !== "string") msg = msg != null ? String(msg) : "";
	return msg as string;
}
