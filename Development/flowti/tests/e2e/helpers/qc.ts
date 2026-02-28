/**
 * Manual QC checkpoint for E2E journey tests.
 *
 * Shows an Obsidian modal asking the operator to visually inspect
 * the current state. The operator can approve or reject.
 *
 * Disabled by default (auto-approves). Enable with E2E_QC=true.
 *
 * Usage in a journey step:
 *   await qcCheckpoint(cli, "Verify dashboard layout looks correct");
 */
import type { ObsidianCli } from "../../../src/infrastructure/cli/ObsidianCli";

/** Default timeout for QC approval (5 minutes). */
const QC_TIMEOUT_MS = 300_000;
/** Polling interval to check for operator response. */
const QC_POLL_MS = 500;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns true if QC mode is enabled (E2E_QC=true env var).
 * When disabled, qcCheckpoint() auto-approves without showing a modal.
 */
export function isQcEnabled(): boolean {
	return process.env.E2E_QC === "true";
}

/**
 * Shows a QC checkpoint modal in Obsidian and waits for operator response.
 *
 * When QC is disabled (default), returns immediately (auto-approve).
 *
 * When QC is enabled:
 *   - Creates an Obsidian Modal with the prompt, Approve and Reject buttons
 *   - Polls window._e2eQcResult every 500ms
 *   - Throws if the operator rejects or the timeout expires
 */
export async function qcCheckpoint(
	cli: ObsidianCli,
	prompt: string,
	timeoutMs?: number,
): Promise<void> {
	if (!isQcEnabled()) return;

	const escapedPrompt = JSON.stringify(prompt);

	// Clear any previous result and show the modal
	cli.eval([
		"(() => {",
		"  delete window._e2eQcResult;",
		"  const modal = new (class extends require('obsidian').Modal {",
		"    onOpen() {",
		"      const { contentEl } = this;",
		"      contentEl.createEl('h2', { text: 'QC Checkpoint' });",
		`      contentEl.createEl('p', { text: ${escapedPrompt} });`,
		"      const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });",
		"      const approveBtn = btnRow.createEl('button', { text: 'Approve', cls: 'mod-cta' });",
		"      approveBtn.addEventListener('click', () => { window._e2eQcResult = 'approved'; this.close(); });",
		"      const rejectBtn = btnRow.createEl('button', { text: 'Reject' });",
		"      rejectBtn.addEventListener('click', () => { window._e2eQcResult = 'rejected'; this.close(); });",
		"    }",
		"  })(app);",
		"  modal.open();",
		"})()",
	].join(" "));

	// Poll for operator response
	const deadline = Date.now() + (timeoutMs ?? QC_TIMEOUT_MS);
	while (Date.now() < deadline) {
		await sleep(QC_POLL_MS);
		const result = cli.eval("window._e2eQcResult ?? 'pending'");
		if (result.success) {
			if (result.value === "approved") return;
			if (result.value === "rejected") {
				throw new Error(`QC rejected: ${prompt}`);
			}
		}
	}

	throw new Error(
		`QC checkpoint timed out after ${((timeoutMs ?? QC_TIMEOUT_MS) / 1000).toFixed(0)}s: ${prompt}`,
	);
}
