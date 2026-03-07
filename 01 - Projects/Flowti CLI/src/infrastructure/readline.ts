/**
 * readline.ts — Interactive user input helpers.
 */

import readline from "node:readline";
import { RESET, DIM } from "./ui.js";

export type ReadlineInterface = readline.Interface;

export function createRL(): readline.Interface {
	return readline.createInterface({ input: process.stdin, output: process.stdout });
}

export function ask(rl: readline.Interface, question: string, defaultValue = ""): Promise<string> {
	return new Promise((resolve) => {
		const suffix = defaultValue ? ` ${DIM}(${defaultValue})${RESET}` : "";
		rl.question(`  ${question}${suffix}: `, (answer) => {
			resolve(answer.trim() || defaultValue);
		});
	});
}
