/**
 * progress.ts — Lightweight progress indicators for long CLI operations.
 *
 * Provides a spinner for indeterminate tasks and a progress bar for
 * tasks with a known total. Both write to stderr so they don't
 * interfere with --format=json output on stdout.
 *
 * Respects --quiet mode by accepting an optional `enabled` flag.
 */

// ── Spinner ──────────────────────────────────────────────────────────

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export interface Spinner {
	/** Update the spinner label while it's running. */
	update(label: string): void;
	/** Stop and replace spinner line with a final message. */
	stop(finalMessage?: string): void;
}

/**
 * Start a terminal spinner. Returns a handle to update or stop it.
 * If `enabled` is false, returns a no-op spinner (for --quiet mode).
 */
export function startSpinner(label: string, enabled = true): Spinner {
	if (!enabled || !process.stderr.isTTY) {
		return { update: () => {}, stop: () => {} };
	}

	let frameIdx = 0;
	let currentLabel = label;
	let stopped = false;

	const interval = setInterval(() => {
		if (stopped) return;
		const frame = FRAMES[frameIdx % FRAMES.length];
		process.stderr.write(`\r  ${frame} ${currentLabel}`);
		frameIdx++;
	}, 80);

	return {
		update(newLabel: string) {
			currentLabel = newLabel;
		},
		stop(finalMessage?: string) {
			if (stopped) return;
			stopped = true;
			clearInterval(interval);
			process.stderr.write("\r" + " ".repeat(currentLabel.length + 10) + "\r");
			if (finalMessage) {
				process.stderr.write(`  ${finalMessage}\n`);
			}
		},
	};
}

// ── Progress bar ────────────────────────────────────────────────────

export interface ProgressBar {
	/** Advance progress by one step, optionally updating the label. */
	tick(label?: string): void;
	/** Complete the bar (fills to 100%). */
	complete(finalMessage?: string): void;
}

/**
 * Create a progress bar with a known total.
 * If `enabled` is false, returns a no-op bar (for --quiet mode).
 */
export function createProgressBar(total: number, label: string, enabled = true): ProgressBar {
	if (!enabled || total <= 0 || !process.stderr.isTTY) {
		return { tick: () => {}, complete: () => {} };
	}

	let current = 0;
	let currentLabel = label;
	const barWidth = 20;

	function render(): void {
		const pct = Math.min(current / total, 1);
		const filled = Math.round(pct * barWidth);
		const empty = barWidth - filled;
		const bar = "█".repeat(filled) + "░".repeat(empty);
		const pctStr = `${Math.round(pct * 100)}%`.padStart(4);
		process.stderr.write(`\r  ${bar} ${pctStr} ${currentLabel}`);
	}

	render();

	return {
		tick(tickLabel?: string) {
			current++;
			if (tickLabel) currentLabel = tickLabel;
			render();
		},
		complete(finalMessage?: string) {
			current = total;
			render();
			process.stderr.write("\r" + " ".repeat(currentLabel.length + barWidth + 20) + "\r");
			if (finalMessage) {
				process.stderr.write(`  ${finalMessage}\n`);
			}
		},
	};
}
