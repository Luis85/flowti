/**
 * proc.ts — Centralized process operations.
 *
 * All process.exit(), process.argv, and process.cwd() calls
 * should go through this service for testability.
 */

import type { IProcess } from "../types.js";

class NodeProcess implements IProcess {
	exit(code: number): never {
		process.exit(code);
	}

	argv(): string[] {
		return process.argv.slice(2);
	}

	cwd(): string {
		return process.cwd();
	}
}

export const proc: IProcess = new NodeProcess();
