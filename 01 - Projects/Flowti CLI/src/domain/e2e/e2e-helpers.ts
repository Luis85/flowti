/**
 * e2e-helpers.ts — Shared readline and formatting helpers for E2E modules.
 */

import type { ReadlineInterface } from "../../infrastructure/readline.js";

export function ask(rl: ReadlineInterface, question: string, defaultValue: string = ""): Promise<string> {
	return new Promise((resolve) => {
		const suffix = defaultValue ? ` (${defaultValue})` : "";
		rl.question(`  ${question}${suffix}: `, (answer: string) => {
			resolve(answer.trim() || defaultValue);
		});
	});
}

export function askYesNo(rl: ReadlineInterface, question: string, defaultNo: boolean = true): Promise<boolean> {
	return new Promise((resolve) => {
		const hint = defaultNo ? "(y/N)" : "(Y/n)";
		rl.question(`  ${question} ${hint}: `, (answer: string) => {
			const input = answer.trim().toLowerCase();
			if (!input) {
				resolve(!defaultNo);
				return;
			}
			resolve(input === "y" || input === "yes");
		});
	});
}

/** YAML-safe string escaping. */
export function yamlStr(value: string): string {
	if (/[:\n\r\t#'"{}[\],&*?]|^\s|\s$/.test(value)) return JSON.stringify(value);
	return value;
}
