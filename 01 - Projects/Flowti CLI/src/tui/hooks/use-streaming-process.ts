/**
 * use-streaming-process.ts — Run a shell command and capture output into state.
 *
 * Used by build, test, and devtools pages for output rendering.
 * Currently runs synchronously via IShell.runCaptureStatus — lines are set on completion.
 * The interface is streaming-ready: when IShell gets a line-callback spawn method,
 * this hook can be upgraded without changing any page component.
 */

import { useState, useCallback } from "react";
import type { LoaderDeps } from "../loaders/loader-types.js";

interface UseStreamingProcessResult {
	readonly lines: readonly string[];
	readonly running: boolean;
	readonly exitCode: number | null;
	readonly start: () => void;
}

export function useStreamingProcess(command: string, cwd: string, deps: LoaderDeps): UseStreamingProcessResult {
	const [lines, setLines] = useState<string[]>([]);
	const [running, setRunning] = useState(false);
	const [exitCode, setExitCode] = useState<number | null>(null);

	const start = useCallback(() => {
		setLines([]);
		setRunning(true);
		setExitCode(null);

		try {
			const result = deps.shell.runCaptureStatus(command, { cwd });
			setLines(result.output.split("\n"));
			setExitCode(result.exitCode);
		} catch (err) {
			setLines([`Error: ${err instanceof Error ? err.message : String(err)}`]);
			setExitCode(1);
		} finally {
			setRunning(false);
		}
	}, [command, cwd, deps.shell]);

	return { lines, running, exitCode, start };
}
