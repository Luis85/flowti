/**
 * NavBar — step navigation row for the Journey Builder sidebar.
 *
 * Renders: [< Prev] Step N of M [Next >] [+ Add step]
 */
import { setIcon } from "obsidian";

export interface NavBarDeps {
	/** Total number of steps in the journey. */
	stepCount: number;
	/** Zero-based index of the currently active step. */
	currentIndex: number;
	/** Called when user clicks "Previous". */
	onPrev: () => void;
	/** Called when user clicks "Next". */
	onNext: () => void;
	/** Called when user clicks "Add step". */
	onAddStep: () => void;
	/** Called when user clicks "Setup" to return to the setup form. */
	onSetup?: () => void;
}

export class NavBar {
	constructor(
		private readonly container: HTMLElement,
		private readonly deps: NavBarDeps,
	) {}

	render(): void {
		this.container.empty();

		const bar = this.container.createDiv({ cls: "ft-jb-navbar" });

		const { stepCount, currentIndex } = this.deps;
		const hasPrev = stepCount > 0 && currentIndex > 0;
		const hasNext = stepCount > 0 && currentIndex < stepCount - 1;

		// Setup button (optional)
		if (this.deps.onSetup) {
			const setupBtn = bar.createSpan({ cls: "ft-jb-nav-btn" });
			setupBtn.dataset.testId = "jb-nav-setup";
			setupBtn.setAttribute("role", "button");
			setupBtn.setAttribute("tabindex", "0");
			setupBtn.setAttribute("aria-label", "Setup");
			setIcon(setupBtn, "settings");
			setupBtn.addEventListener("click", () => this.deps.onSetup!());
			setupBtn.addEventListener("keydown", (e: KeyboardEvent) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					this.deps.onSetup!();
				}
			});
		}

		// Prev button
		const prevBtn = bar.createSpan({ cls: `ft-jb-nav-btn${hasPrev ? "" : " ft-jb-nav-disabled"}` });
		prevBtn.dataset.testId = "jb-nav-prev";
		prevBtn.setAttribute("role", "button");
		prevBtn.setAttribute("tabindex", hasPrev ? "0" : "-1");
		prevBtn.setAttribute("aria-label", "Previous step");
		if (!hasPrev) prevBtn.setAttribute("aria-disabled", "true");
		setIcon(prevBtn, "arrow-left");
		if (hasPrev) {
			prevBtn.addEventListener("click", () => this.deps.onPrev());
			prevBtn.addEventListener("keydown", (e: KeyboardEvent) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					this.deps.onPrev();
				}
			});
		}

		// Step counter
		const counter = bar.createSpan({ cls: "ft-jb-nav-counter" });
		counter.dataset.testId = "jb-nav-counter";
		counter.textContent = stepCount === 0
			? "No steps yet"
			: `Step ${currentIndex + 1} of ${stepCount}`;

		// Next button
		const nextBtn = bar.createSpan({ cls: `ft-jb-nav-btn${hasNext ? "" : " ft-jb-nav-disabled"}` });
		nextBtn.dataset.testId = "jb-nav-next";
		nextBtn.setAttribute("role", "button");
		nextBtn.setAttribute("tabindex", hasNext ? "0" : "-1");
		nextBtn.setAttribute("aria-label", "Next step");
		if (!hasNext) nextBtn.setAttribute("aria-disabled", "true");
		setIcon(nextBtn, "arrow-right");
		if (hasNext) {
			nextBtn.addEventListener("click", () => this.deps.onNext());
			nextBtn.addEventListener("keydown", (e: KeyboardEvent) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					this.deps.onNext();
				}
			});
		}

		// Add step button
		const addBtn = bar.createSpan({ cls: "ft-jb-nav-add" });
		addBtn.dataset.testId = "jb-nav-add-step";
		addBtn.setAttribute("role", "button");
		addBtn.setAttribute("tabindex", "0");
		addBtn.setAttribute("aria-label", "Add step");
		const addIcon = addBtn.createSpan();
		setIcon(addIcon, "plus");
		addBtn.createSpan({ text: "Add step" });
		addBtn.addEventListener("click", () => this.deps.onAddStep());
		addBtn.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				this.deps.onAddStep();
			}
		});
	}
}
