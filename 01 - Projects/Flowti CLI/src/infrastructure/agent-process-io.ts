/**
 * agent-process-io.ts — Raw process I/O for the agent:start JSONL loop.
 *
 * Infrastructure module — allowed to use process.stdin/stdout/pid and
 * node:readline directly. Provides the ILineReader/ILineWriter interfaces
 * needed by createAgentProcessLoop.
 */

import readline from "node:readline";
import type { ILineReader, ILineWriter } from "../domain/agents/agent-process-loop.js";

/** Create an ILineReader that reads from process.stdin. */
export function createStdinLineReader(): ILineReader {
	const rl = readline.createInterface({ input: process.stdin });
	return {
		onLine(cb: (line: string) => void) { rl.on("line", cb); },
		close() { rl.close(); },
	};
}

/** Create an ILineWriter that writes to process.stdout. */
export function createStdoutLineWriter(): ILineWriter {
	return {
		write(line: string) { process.stdout.write(line); },
	};
}

/** Get the current process ID. */
export function getProcessPid(): number {
	return process.pid;
}

/** Exit the current process with the given code. */
export function exitProcess(code: number): void {
	process.exit(code);
}
