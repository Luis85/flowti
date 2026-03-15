/**
 * input.ts — User input abstraction.
 *
 * Provides a singleton `input` object that wraps readline.
 * Domain functions use `input.ask()` instead of managing readline
 * lifecycle directly, making them testable via mock injection.
 */

import readline from "node:readline";
import { RESET, DIM } from "./ui.js";
import type { IInput } from "./types.js";
export type { IInput } from "./types.js";

function formatPrompt(question: string, suffix: string): string {
	return `  ${question}${suffix}: `;
}

export const input: IInput = {
	async ask(question: string, defaultValue = ""): Promise<string> {
		const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
		return new Promise((resolve) => {
			const suffix = defaultValue ? ` ${DIM}(${defaultValue})${RESET}` : "";
			rl.question(formatPrompt(question, suffix), (answer) => {
				rl.close();
				resolve(answer.trim() || defaultValue);
			});
		});
	},

	askAbortable(question: string): { promise: Promise<string>; abort: () => void } {
		const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
		let resolve: (value: string) => void;
		const promise = new Promise<string>((r) => { resolve = r; });
		rl.question(formatPrompt(question, ""), (answer) => {
			rl.close();
			resolve(answer.trim());
		});
		return {
			promise,
			abort() { rl.close(); resolve(""); },
		};
	},

	async waitForEnter(): Promise<void> {
		const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
		return new Promise((resolve) => {
			rl.question(`  ${DIM}Press Enter to continue${RESET} `, () => {
				rl.close();
				resolve();
			});
		});
	},

	async askYesNo(question: string, defaultNo = true): Promise<boolean> {
		const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
		return new Promise((resolve) => {
			const hint = defaultNo ? "(y/N)" : "(Y/n)";
			rl.question(formatPrompt(question, ` ${hint}`), (answer) => {
				rl.close();
				const trimmed = answer.trim().toLowerCase();
				if (!trimmed) {
					resolve(!defaultNo);
					return;
				}
				resolve(trimmed === "y" || trimmed === "yes");
			});
		});
	},
};
