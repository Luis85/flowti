// tests/helpers/capture-display.ts
import { vi } from "vitest";

export function captureDisplay(fn: (log: (msg?: string) => void) => void): string {
	const log = vi.fn();
	fn(log);
	return log.mock.calls.flat().join("\n");
}

export function captureDisplayLines(fn: (log: (msg?: string) => void) => void): string[] {
	const log = vi.fn();
	fn(log);
	return log.mock.calls.flat() as string[];
}
