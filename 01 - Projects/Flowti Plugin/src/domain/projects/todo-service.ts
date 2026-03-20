/**
 * TODO list parse/serialize for $project/TODO.md.
 * Pure functions — no I/O. Operates on markdown strings.
 */

import type { TodoItem } from "./types.js";

const TODO_REGEX = /^- \[(x| )\] (.+)$/gm;

/** Parse checkbox items from markdown content. */
export function parseTodos(md: string): TodoItem[] {
	const items: TodoItem[] = [];
	let match: RegExpExecArray | null;
	const re = new RegExp(TODO_REGEX.source, TODO_REGEX.flags);
	while ((match = re.exec(md)) !== null) {
		items.push({ text: match[2], done: match[1] === "x" });
	}
	return items;
}

/** Append a new unchecked item to the markdown content. */
export function addTodoLine(md: string, text: string): string {
	const line = `- [ ] ${text}`;
	return md ? `${md}\n${line}` : line;
}

/** Toggle the checkbox at the given index (0-based among TODO items). */
export function toggleTodoLine(md: string, index: number): string {
	let count = 0;
	return md.replace(TODO_REGEX, (full, check, label) => {
		if (count++ === index) {
			return check === "x" ? `- [ ] ${label}` : `- [x] ${label}`;
		}
		return full;
	});
}

/** Delete the TODO item at the given index. */
export function deleteTodoLine(md: string, index: number): string {
	let count = 0;
	const lines = md.split("\n");
	const filtered = lines.filter((line) => {
		if (/^- \[(x| )\] .+$/.test(line)) {
			return count++ !== index;
		}
		return true;
	});
	return filtered.join("\n");
}
