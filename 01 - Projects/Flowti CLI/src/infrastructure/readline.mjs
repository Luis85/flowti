/**
 * readline.mjs — Interactive user input helpers.
 */

import readline from "node:readline";
import { RESET, DIM } from "./ui.mjs";

export function createRL() {
	return readline.createInterface({ input: process.stdin, output: process.stdout });
}

export function ask(rl, question, defaultValue = "") {
	return new Promise((resolve) => {
		const suffix = defaultValue ? ` ${DIM}(${defaultValue})${RESET}` : "";
		rl.question(`  ${question}${suffix}: `, (answer) => {
			resolve(answer.trim() || defaultValue);
		});
	});
}
