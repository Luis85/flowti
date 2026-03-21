/**
 * Normalize assistant text from CLI JSONL events — providers use many shapes.
 */

import type { CliEvent } from "../../infrastructure/agents/cli-executor.js";

const SKIP_KEYS = new Set(["type", "agent", "tool", "id", "status", "ts"]);

/**
 * Collect non-empty string fields from a CLI event (excluding routing metadata).
 */
export function collectStringFieldsFromCliEvent(event: CliEvent): string {
	const parts: string[] = [];
	for (const [k, v] of Object.entries(event as unknown as Record<string, unknown>)) {
		if (SKIP_KEYS.has(k)) continue;
		if (typeof v === "string" && v.trim()) parts.push(v.trim());
	}
	return parts.join("\n");
}

/**
 * Pull human-readable text from parsed JSON (OpenAI / Anthropic / ad-hoc).
 */
export function extractTextFromUnknownJson(parsed: unknown): string | null {
	if (parsed == null) return null;
	if (typeof parsed === "string") return parsed.trim() || null;
	if (typeof parsed !== "object") return null;
	const o = parsed as Record<string, unknown>;

	for (const key of ["message", "response", "content", "output", "text", "reply", "assistant", "body", "result"]) {
		const v = o[key];
		if (typeof v === "string" && v.trim()) return v.trim();
	}

	const choices = o.choices;
	if (Array.isArray(choices) && choices[0] && typeof choices[0] === "object") {
		const msg = (choices[0] as { message?: { content?: unknown } }).message?.content;
		if (typeof msg === "string" && msg.trim()) return msg.trim();
	}

	const content = o.content;
	if (Array.isArray(content)) {
		const texts: string[] = [];
		for (const block of content) {
			if (!block || typeof block !== "object") continue;
			const b = block as { type?: string; text?: string };
			if (b.type === "text" && typeof b.text === "string" && b.text.trim()) texts.push(b.text.trim());
		}
		if (texts.length) return texts.join("");
	}

	return null;
}

/**
 * Best-effort raw assistant text from a single CLI event line.
 */
export function rawTextFromCliEvent(event: CliEvent): string {
	const e = event as unknown as Record<string, unknown>;
	const ordered = [e.text, e.response, e.content, e.output, e.message, e.reply];
	for (const v of ordered) {
		if (typeof v === "string" && v.trim()) return v.trim();
	}

	const fromFields = collectStringFieldsFromCliEvent(event);
	if (fromFields) return fromFields;

	try {
		const nested = extractTextFromUnknownJson(event as unknown);
		if (nested) return nested;
	} catch {
		/* ignore */
	}

	return "";
}
