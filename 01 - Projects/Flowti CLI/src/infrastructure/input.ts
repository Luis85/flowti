/**
 * input.ts — User input abstraction.
 *
 * Provides a singleton `input` object that wraps readline.
 * Domain functions use `input.ask()` instead of managing readline
 * lifecycle directly, making them testable via mock injection.
 */

import readline from "node:readline";
import { RESET, DIM } from "./ui.js";

export interface IInput {
	ask(question: string, defaultValue?: string): Promise<string>;
}

export const input: IInput = {
	async ask(question: string, defaultValue = ""): Promise<string> {
		const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
		return new Promise((resolve) => {
			const suffix = defaultValue ? ` ${DIM}(${defaultValue})${RESET}` : "";
			rl.question(`  ${question}${suffix}: `, (answer) => {
				rl.close();
				resolve(answer.trim() || defaultValue);
			});
		});
	},
};
