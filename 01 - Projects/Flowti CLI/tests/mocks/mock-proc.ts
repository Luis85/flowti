/**
 * mock-proc.ts — In-memory IProcess for tests.
 *
 * Usage:
 *   const p = createMockProc({ argv: ["build", "--fast"] });
 *   p.argv(); // ["build", "--fast"]
 *   p.exit(0); // throws MockExitError with code 0
 */

import type { IProcess } from "../../src/types.js";

export class MockExitError extends Error {
	constructor(public readonly code: number) {
		super(`process.exit(${code})`);
		this.name = "MockExitError";
	}
}

export interface MockProcOptions {
	argv?: string[];
	cwd?: string;
	env?: Record<string, string | undefined>;
}

export function createMockProc(opts: MockProcOptions = {}): IProcess & {
	exits: number[];
} {
	const exits: number[] = [];

	return {
		exits,

		exit(code: number): never {
			exits.push(code);
			throw new MockExitError(code);
		},

		argv(): string[] {
			return opts.argv ?? [];
		},

		cwd(): string {
			return opts.cwd ?? "/mock/cwd";
		},

		env(): Record<string, string | undefined> {
			return opts.env ?? {};
		},
	};
}
