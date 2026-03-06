/**
 * ExecutionProgressModal — 3-phase modal for in-app journey execution.
 *
 * Phase 1 (Options): dry-run toggle, continue on failure toggle, Run/Cancel buttons.
 * Phase 2 (Progress): live step results, progress bar, cancel button.
 * Phase 3 (Summary): pass/fail/skip counts, generate report button.
 */
import { Modal, Setting } from "obsidian";
import type { App } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { JourneyExecutorService } from "../../domain/journeyExecutor/JourneyExecutorService";
import type { ExecutableJourney, ExecutionResult, StepResult } from "../../domain/journeyExecutor/types";
import { generateExecutionReport } from "../../domain/journeyExecutor/executionReportGenerator";
import { ManualQaModal } from "../modals";

type Phase = "options" | "progress" | "summary";

export interface ExecutionProgressModalDeps {
	app: App;
	eventBus: IEventBus;
	executorService: JourneyExecutorService;
	journey: ExecutableJourney;
	canvasPath?: string;
	writeFile?: (path: string, content: string) => Promise<void>;
}

export class ExecutionProgressModal extends Modal {
	private deps: ExecutionProgressModalDeps;
	private phase: Phase = "options";
	private dryRun = false;
	private continueOnFailure = true;
	private stepResults: StepResult[] = [];
	private result: ExecutionResult | null = null;
	private unsubscribes: Array<() => void> = [];
	private stepColors: Record<number, string> = {};

	constructor(deps: ExecutionProgressModalDeps) {
		super(deps.app);
		this.deps = deps;
	}

	onOpen(): void {
		this.renderPhase();
	}

	onClose(): void {
		this.unsubscribes.forEach((u) => u());
		this.unsubscribes = [];
		this.contentEl.empty();
	}

	private renderPhase(): void {
		this.contentEl.empty();
		this.contentEl.addClass("ft-execution-modal");

		switch (this.phase) {
			case "options": return this.renderOptions();
			case "progress": return this.renderProgress();
			case "summary": return this.renderSummary();
		}
	}

	// ── Phase 1: Options ─────────────────────────────────────

	private renderOptions(): void {
		this.contentEl.createEl("h3", { text: `Run: ${this.deps.journey.journey}` });
		this.contentEl.createEl("p", {
			text: `${this.deps.journey.steps.length} steps`,
			cls: "ft-text-muted",
		});

		new Setting(this.contentEl)
			.setName("Dry run")
			.setDesc("Validate without executing side effects")
			.addToggle((t) => {
				t.setValue(this.dryRun);
				t.onChange((v) => { this.dryRun = v; });
			});

		new Setting(this.contentEl)
			.setName("Continue on failure")
			.setDesc("Keep running after a step fails")
			.addToggle((t) => {
				t.setValue(this.continueOnFailure);
				t.onChange((v) => { this.continueOnFailure = v; });
			});

		new Setting(this.contentEl)
			.addButton((btn) => btn.setButtonText("Cancel").onClick(() => this.close()))
			.addButton((btn) =>
				btn.setButtonText("Run").setCta().onClick(() => void this.startExecution()),
			);
	}

	// ── Phase 2: Progress ────────────────────────────────────

	private async startExecution(): Promise<void> {
		this.phase = "progress";
		this.stepResults = [];
		this.stepColors = {};
		this.renderPhase();

		// Listen for step completions
		this.unsubscribes.push(
			this.deps.eventBus.on("journey-executor.run.step-completed", (event) => {
				const { stepIndex, stepId, stepTitle, status, durationMs, error } = event.payload;
				this.stepResults.push({ stepIndex, stepId, stepTitle, status, durationMs, error });

				// Canvas highlighting: green=1, red=6
				this.stepColors[stepIndex] = status === "pass" ? "1" : "6";
				this.emitCanvasSync();

				this.renderProgress();
			}),
		);

		try {
			this.result = await this.deps.executorService.run(this.deps.journey, {
				dryRun: this.dryRun,
				continueOnFailure: this.continueOnFailure,
				onManualInput: (instruction) => this.showManualInput(instruction),
				onConfirmDestructive: (description) => this.showConfirmDestructive(description),
			});
		} catch {
			this.result = {
				journeyName: this.deps.journey.journey,
				totalSteps: this.deps.journey.steps.length,
				passed: 0, failed: 0, skipped: 0,
				durationMs: 0,
				steps: [],
			};
		}

		this.phase = "summary";
		this.renderPhase();
	}

	private renderProgress(): void {
		this.contentEl.empty();
		const total = this.deps.journey.steps.length;
		const done = this.stepResults.length;

		this.contentEl.createEl("h3", { text: `Running: ${this.deps.journey.journey}` });

		// Progress bar
		const bar = this.contentEl.createDiv({ cls: "ft-exec-progress-bar" });
		const fill = bar.createDiv({ cls: "ft-exec-progress-fill" });
		fill.style.width = total > 0 ? `${(done / total) * 100}%` : "0%";

		this.contentEl.createEl("p", { text: `Step ${done} of ${total}`, cls: "ft-text-muted" });

		// Step results list
		const list = this.contentEl.createDiv({ cls: "ft-exec-step-list" });
		for (const step of this.stepResults) {
			const icon = step.status === "pass" ? "✓" : step.status === "fail" ? "✗" : "–";
			const cls = `ft-exec-step-${step.status}`;
			const row = list.createDiv({ cls: `ft-exec-step-row ${cls}` });
			row.createSpan({ text: `${icon} ${step.stepTitle}` });
			row.createSpan({ text: `${step.durationMs}ms`, cls: "ft-text-muted" });
		}

		// Cancel button
		new Setting(this.contentEl)
			.addButton((btn) =>
				btn.setButtonText("Cancel").setWarning().onClick(() => {
					this.deps.executorService.cancel();
				}),
			);
	}

	// ── Phase 3: Summary ─────────────────────────────────────

	private renderSummary(): void {
		const r = this.result!;
		const statusText = r.failed > 0 ? "Failed" : "Passed";

		this.contentEl.createEl("h3", { text: `${statusText}: ${r.journeyName}` });

		const stats = this.contentEl.createDiv({ cls: "ft-exec-summary" });
		stats.createEl("p", { text: `Passed: ${r.passed} | Failed: ${r.failed} | Skipped: ${r.skipped}` });
		stats.createEl("p", { text: `Duration: ${formatDuration(r.durationMs)}`, cls: "ft-text-muted" });

		// Failed step details
		const failures = r.steps.filter((s) => s.status === "fail");
		if (failures.length > 0) {
			const details = this.contentEl.createDiv({ cls: "ft-exec-failures" });
			details.createEl("h4", { text: "Failures" });
			for (const f of failures) {
				details.createEl("p", { text: `Step ${f.stepIndex + 1}: ${f.stepTitle}`, cls: "ft-text-bold" });
				if (f.error) details.createEl("p", { text: f.error, cls: "ft-text-muted ft-text-sm" });
			}
		}

		const actions = new Setting(this.contentEl);
		actions.addButton((btn) =>
			btn.setButtonText("Generate report").onClick(() => void this.generateReport()),
		);
		actions.addButton((btn) => btn.setButtonText("Close").setCta().onClick(() => this.close()));
	}

	// ── Helpers ───────────────────────────────────────────────

	private showManualInput(instruction: string): Promise<"pass" | "fail"> {
		return new Promise((resolve) => {
			const modal = new ManualQaModal(this.app, {
				instruction,
				onResult: (result) => resolve(result.value),
			});
			modal.open();
		});
	}

	private showConfirmDestructive(description: string): Promise<boolean> {
		return new Promise((resolve) => {
			const el = this.contentEl.createDiv({ cls: "ft-exec-confirm" });
			el.createEl("p", { text: `Destructive action: ${description}` });
			new Setting(el)
				.addButton((btn) => btn.setButtonText("Skip").onClick(() => { el.remove(); resolve(false); }))
				.addButton((btn) => btn.setButtonText("Allow").setWarning().onClick(() => { el.remove(); resolve(true); }));
		});
	}

	private emitCanvasSync(): void {
		if (!this.deps.canvasPath) return;
		void this.deps.eventBus.emit("journey-builder.canvas.sync-requested", {
			canvasPath: this.deps.canvasPath,
			definition: {
				journey: this.deps.journey.journey,
				description: "",
				startEvent: "",
				endEvent: "",
				stepColors: { ...this.stepColors },
				steps: this.deps.journey.steps.map((s) => ({
					id: s.id,
					title: s.title,
					description: s.description,
					actions: s.actions,
				})),
			},
		});
	}

	private async generateReport(): Promise<void> {
		if (!this.result || !this.deps.writeFile) return;
		const { frontmatter, markdown } = generateExecutionReport(this.result);
		const fm = Object.entries(frontmatter).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join("\n");
		const content = `---\n${fm}\n---\n\n${markdown}`;
		const folder = "docs/reports/executions";
		const name = `${this.result.journeyName.replace(/[^a-zA-Z0-9-_ ]/g, "")} - ${new Date().toISOString().slice(0, 10)}`;
		await this.deps.writeFile(`${folder}/${name}.md`, content);
		void this.deps.eventBus.emit("notice.show", { message: `Report saved: ${folder}/${name}.md` });
	}
}

function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	return `${(ms / 1000).toFixed(1)}s`;
}
