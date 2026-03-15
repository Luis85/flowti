/**
 * command-parser.ts — Parse slash commands from raw user input.
 *
 * Pure function — no I/O, no side effects.
 */

import type { ChatCommand } from "./chat-renderer-types.js";

const SIMPLE_COMMANDS: ReadonlyMap<string, ChatCommand> = new Map([
	["new", { type: "new" }],
	["done", { type: "done" }],
	["back", { type: "back" }],
	["let go", { type: "let-go" }],
	["history", { type: "history" }],
	["topics", { type: "topics" }],
	["clear", { type: "clear" }],
	["focus", { type: "focus" }],
	["talk", { type: "talk" }],
]);

/**
 * Parse raw input text into a ChatCommand, or null if not a valid command.
 * Commands start with `/` and are case-insensitive.
 */
export function parseCommand(input: string): ChatCommand | null {
	const trimmed = input.trim();
	if (!trimmed.startsWith("/")) return null;

	const body = trimmed.slice(1).toLowerCase();

	const simple = SIMPLE_COMMANDS.get(body);
	if (simple) return simple;

	if (body.startsWith("pick ")) {
		const name = trimmed.slice(1).slice(5).trim();
		if (!name) return null;
		return { type: "pick", name };
	}

	return null;
}
