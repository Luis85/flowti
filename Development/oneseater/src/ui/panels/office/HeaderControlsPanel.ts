import { IEventBus } from "src/eventsystem";
import { JumpToNextPhaseEvent } from "src/eventsystem/engine/JumpToNextPhaseEvent";
import { SetTimeScaleEvent } from "src/eventsystem/engine/SetTimeScaleEvent";
import { TogglePauseEvent } from "src/eventsystem/engine/TogglePauseEvent";
import { GoToSleepEvent } from "src/eventsystem/player/GoToSleepEvent";
import { GameViewModel } from "src/models/GameViewModel";
import { PlayerStatus } from "src/models/Player";
import { getLevelFromXP } from "src/simulation/systems/player/LevelSystem";
import { DayPhase, SpeedPreset, PHASE_ORDER } from "src/simulation/types";
import { speedLabel, formatMinute } from "src/simulation/utils";
import { PHASE_ICONS, STATUS_CONFIG } from "src/ui";

const ENERGY_LOW_THRESHOLD = 35;
const ENERGY_CRITICAL_THRESHOLD = 20;


// ═══════════════════════════════════════════════════════════════════════════════
// HEADER CONTROLS PANEL
// ═══════════════════════════════════════════════════════════════════════════════

export class HeaderControlsPanel {
	private root?: HTMLElement;
	
	// Clock elements
	private timeEl?: HTMLElement;
	private dayEl?: HTMLElement;
	
	// Player Status elements (Row 1: Energy)
	private statusIconEl?: HTMLElement;
	private statusLabelEl?: HTMLElement;
	private energyBarFill?: HTMLElement;
	private energyTextEl?: HTMLElement;
	private sleepBtn?: HTMLButtonElement;
	private stacksEl?: HTMLElement;
	
	// Player Progress elements (Row 2: XP/Level)
	private levelBadgeEl?: HTMLElement;
	private xpTextEl?: HTMLElement;
	private xpBarFill?: HTMLElement;
	private tasksCountEl?: HTMLElement;
	
	// Phase elements
	private phaseChips = new Map<DayPhase, HTMLElement>();
	
	// Control elements
	private pauseBtn?: HTMLButtonElement;
	private speedBtns = new Map<SpeedPreset, HTMLButtonElement>();

	// Cache for render optimization
	private lastMinute = -1;
	private lastDay = -1;
	private lastPhase?: DayPhase;
	private lastPaused?: boolean;
	private lastSpeed = -1;
	private lastEnergy = -1;
	private lastStatus?: PlayerStatus;
	private lastStacks = -1;
	private lastXP = -1;
	private lastTasks = -1;

	constructor(
		private events: IEventBus,
		private presets: SpeedPreset[] = [1, 1800, 3600, 36000]
	) {}

	mount(parent: HTMLElement) {
		this.root = parent.createDiv({ cls: "mm-header" });

		this.buildClockBlock();
		this.buildPlayerStatsBlock();
		this.buildPhaseBlock();
		this.buildControlsBlock();
		this.injectAnimationStyles();
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// BLOCK 1: Clock (Links)
	// ═══════════════════════════════════════════════════════════════════════════
	private buildClockBlock() {
		if (!this.root) return;

		const block = this.root.createDiv({ cls: "mm-header-clock" });
		this.timeEl = block.createDiv({ text: "--:--" });
		this.timeEl.style.cssText = `
			font-size: 28px;
			font-weight: 700;
			font-family: var(--font-monospace);
			line-height: 1;
			letter-spacing: -1px;
		`;

		this.dayEl = block.createDiv({ text: "Day 0" });
		this.dayEl.style.cssText = `
			font-size: 11px;
			opacity: 0.5;
			font-weight: 500;
		`;
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// BLOCK 2: Player Stats (Zweizeilig: Status/Energy + Level/XP)
	// ═══════════════════════════════════════════════════════════════════════════
	private buildPlayerStatsBlock() {
		if (!this.root) return;

		const wrapper = this.root.createDiv({ cls: "mm-header-player" });
		wrapper.style.cssText = `
			display: flex;
			align-items: center;
			gap: 10px;
		`;

		// Main stats container
		const statsContainer = wrapper.createDiv({ cls: "mm-player-stats-container" });

		// Row 1: Status + Energy
		this.buildEnergyRow(statsContainer);
		
		// Divider
		const divider = statsContainer.createDiv();
		divider.style.cssText = `
			height: 1px;
			background: var(--background-modifier-border);
			margin: 2px 0;
		`;
		
		// Row 2: Level + XP + Tasks
		this.buildProgressRow(statsContainer);

		// Sleep Button (außerhalb für stabiles Layout)
		this.sleepBtn = wrapper.createEl("button", { text: "😴 Sleep" });
		this.sleepBtn.addEventListener("click", () => void this.events.publish(new GoToSleepEvent('player')));
		this.sleepBtn.style.cssText = `
			display: none;
			border: none;
			border-radius: 8px;
			background: var(--color-yellow, #facc15);
			color: #000;
			cursor: pointer;
			font-size: 12px;
			font-weight: 600;
			white-space: nowrap;
			transition: all 0.2s ease;
		`;
		this.sleepBtn.title = "Go to sleep to restore energy";
	}

	private buildEnergyRow(parent: HTMLElement) {
		const row = parent.createDiv({ cls: "mm-stats-row-energy" });

		// Status Icon + Label
		const statusBlock = row.createDiv();
		statusBlock.style.cssText = `
			display: flex;
			align-items: center;
			gap: 6px;
			min-width: 80px;
		`;

		this.statusIconEl = statusBlock.createDiv({ text: "😊" });
		this.statusIconEl.style.cssText = `font-size: 18px; line-height: 1;`;

		this.statusLabelEl = statusBlock.createDiv({ text: "Ready" });
		this.statusLabelEl.style.cssText = `
			font-size: 11px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.3px;
		`;

		// Energy Bar
		const energyBlock = row.createDiv();
		energyBlock.style.cssText = `
			display: flex;
			align-items: center;
			gap: 8px;
		`;

		const energyLabel = energyBlock.createDiv({ text: "⚡" });
		energyLabel.style.cssText = `font-size: 12px;`;

		const energyBarBg = energyBlock.createDiv();
		energyBarBg.style.cssText = `
			flex: 1;
			height: 8px;
			min-width: 80px;
			background: var(--background-modifier-border);
			border-radius: 4px;
			overflow: hidden;
		`;

		this.energyBarFill = energyBarBg.createDiv();
		this.energyBarFill.style.cssText = `
			height: 100%;
			width: 100%;
			background: var(--color-green, #4ade80);
			border-radius: 4px;
			transition: width 0.3s ease, background 0.3s ease;
		`;

		// Energy Text + Stacks
		const energyRight = row.createDiv();
		energyRight.style.cssText = `
			display: flex;
			align-items: center;
			gap: 6px;
			min-width: 70px;
			justify-content: flex-end;
		`;

		this.energyTextEl = energyRight.createDiv({ text: "100%" });
		this.energyTextEl.style.cssText = `
			font-size: 12px;
			font-weight: 700;
			font-family: var(--font-monospace);
			min-width: 38px;
			text-align: right;
		`;

		this.stacksEl = energyRight.createDiv({ text: "" });
		this.stacksEl.style.cssText = `
			font-size: 9px;
			font-weight: 600;
			padding: 2px 5px;
			border-radius: 4px;
			background: var(--color-orange, #fb923c);
			color: #000;
			display: none;
		`;
	}

	private buildProgressRow(parent: HTMLElement) {
		const row = parent.createDiv({ cls: "mm-stats-row-progress" });

		// Level Badge
		const levelBlock = row.createDiv();
		levelBlock.style.cssText = `
			display: flex;
			align-items: center;
			gap: 6px;
			min-width: 80px;
		`;

		this.levelBadgeEl = levelBlock.createDiv({ text: "Lvl 1" });
		this.levelBadgeEl.style.cssText = `
			font-size: 11px;
			font-weight: 700;
			padding: 3px 8px;
			background: var(--interactive-accent);
			color: var(--text-on-accent);
			border-radius: 6px;
		`;

		// XP Bar
		const xpBlock = row.createDiv();
		xpBlock.style.cssText = `
			display: flex;
			align-items: center;
			gap: 8px;
		`;

		const xpLabel = xpBlock.createDiv({ text: "⭐" });
		xpLabel.style.cssText = `font-size: 12px;`;

		const xpBarBg = xpBlock.createDiv();
		xpBarBg.style.cssText = `
			flex: 1;
			height: 8px;
			min-width: 80px;
			background: var(--background-modifier-border);
			border-radius: 4px;
			overflow: hidden;
		`;

		this.xpBarFill = xpBarBg.createDiv();
		this.xpBarFill.style.cssText = `
			height: 100%;
			width: 0%;
			background: linear-gradient(90deg, var(--interactive-accent), var(--color-purple, #a855f7));
			border-radius: 4px;
			transition: width 0.4s ease;
		`;

		// XP Text + Tasks
		const progressRight = row.createDiv();
		progressRight.style.cssText = `
			display: flex;
			align-items: center;
			gap: 8px;
			min-width: 100px;
			justify-content: flex-end;
		`;

		this.xpTextEl = progressRight.createDiv({ text: "0 XP" });
		this.xpTextEl.style.cssText = `
			font-size: 11px;
			font-weight: 500;
			font-family: var(--font-monospace);
			opacity: 0.8;
		`;

		// Tasks Counter
		this.tasksCountEl = progressRight.createDiv({ text: "✓ 0" });
		this.tasksCountEl.style.cssText = `
			font-size: 10px;
			font-weight: 600;
			padding: 2px 6px;
			background: var(--color-green, #4ade80);
			color: #000;
			border-radius: 4px;
		`;
		this.tasksCountEl.title = "Completed Tasks";
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// BLOCK 3: Phase Indicator (Zentriert)
	// ═══════════════════════════════════════════════════════════════════════════
	private buildPhaseBlock() {
		if (!this.root) return;

		const block = this.root.createDiv({ cls: "mm-header-phases" });

		for (const phase of PHASE_ORDER) {
			const config = PHASE_ICONS[phase];
			const chip = block.createDiv({ text: config.icon });
			chip.style.cssText = `
				width: 30px;
				height: 30px;
				display: flex;
				align-items: center;
				justify-content: center;
				border-radius: 50%;
				font-size: 14px;
				cursor: default;
				transition: all 0.2s ease;
				opacity: 0.3;
				background: transparent;
			`;
			chip.title = config.label;
			this.phaseChips.set(phase, chip);
		}
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// BLOCK 4: Controls (Rechts)
	// ═══════════════════════════════════════════════════════════════════════════
	private buildControlsBlock() {
		if (!this.root) return;

		const block = this.root.createDiv({ cls: "mm-header-controls" });

		// Pause/Play
		this.pauseBtn = this.makeControlBtn(block, "⏸", () =>
			void this.events.publish(new TogglePauseEvent())
		);
		this.pauseBtn.style.minWidth = "36px";
		this.pauseBtn.style.fontSize = "14px";
		this.pauseBtn.title = "Pause/Resume";

		// Separator
		const sep = block.createDiv();
		sep.style.cssText = `width: 1px; height: 22px; background: var(--background-modifier-border); margin: 0 4px;`;

		// Speed buttons
		for (const preset of this.presets) {
			const btn = this.makeControlBtn(block, speedLabel(preset), () =>
				void this.events.publish(new SetTimeScaleEvent(preset))
			);
			btn.style.minWidth = "44px";
			btn.title = `Speed: ${speedLabel(preset)}`;
			this.speedBtns.set(preset, btn);
		}

		// Separator
		const sep2 = block.createDiv();
		sep2.style.cssText = `width: 1px; height: 22px; background: var(--background-modifier-border); margin: 0 4px;`;

		// Jump to next phase
		const jumpBtn = this.makeControlBtn(block, "⏭", () =>
			void this.events.publish(new JumpToNextPhaseEvent())
		);
		jumpBtn.style.minWidth = "36px";
		jumpBtn.style.fontSize = "14px";
		jumpBtn.title = "Skip to next phase";
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// RENDER
	// ═══════════════════════════════════════════════════════════════════════════
	render(m: GameViewModel) {
		this.renderClock(m);
		this.renderEnergy(m);
		this.renderProgress(m);
		this.renderPhases(m);
		this.renderControls(m);
	}

	private renderClock(m: GameViewModel) {
		if (m.minuteOfDay !== this.lastMinute) {
			this.lastMinute = m.minuteOfDay;
			this.timeEl?.setText(formatMinute(m.minuteOfDay));
		}
		
		if (m.day !== this.lastDay) {
			this.lastDay = m.day;
			this.dayEl?.setText(`Day ${m.day}`);
		}
	}

	private renderEnergy(m: GameViewModel) {
		const status = m.player.status ?? "idle";
		const energy = m.player.stats.energy ?? 100;
		const stacks = m.player.stats.exhaustedSleepStacks ?? 0;

		// Status icon & label
		if (status !== this.lastStatus) {
			this.lastStatus = status;
			const config = STATUS_CONFIG[status as PlayerStatus];
			
			if (this.statusIconEl) {
				this.statusIconEl.textContent = config.icon;
			}
			if (this.statusLabelEl) {
				this.statusLabelEl.textContent = config.label;
				this.statusLabelEl.style.color = config.color;
			}
		}

		// Energy bar & text
		if (energy !== this.lastEnergy) {
			this.lastEnergy = energy;
			
			if (this.energyBarFill) {
				this.energyBarFill.style.width = `${Math.max(0, Math.min(100, energy))}%`;
				
				if (energy <= ENERGY_CRITICAL_THRESHOLD) {
					this.energyBarFill.style.background = "var(--color-red, #f87171)";
				} else if (energy <= ENERGY_LOW_THRESHOLD) {
					this.energyBarFill.style.background = "var(--color-yellow, #facc15)";
				} else {
					this.energyBarFill.style.background = "var(--color-green, #4ade80)";
				}
			}

			if (this.energyTextEl) {
				this.energyTextEl.textContent = `${Math.round(energy)}%`;
				
				if (energy <= ENERGY_CRITICAL_THRESHOLD) {
					this.energyTextEl.style.color = "var(--color-red, #f87171)";
				} else if (energy <= ENERGY_LOW_THRESHOLD) {
					this.energyTextEl.style.color = "var(--color-yellow, #facc15)";
				} else {
					this.energyTextEl.style.color = "var(--text-normal)";
				}
			}

			this.updateSleepButton(energy, status);
		}

		// Exhausted stacks
		if (stacks !== this.lastStacks) {
			this.lastStacks = stacks;
			
			if (this.stacksEl) {
				if (stacks > 0) {
					this.stacksEl.textContent = `😵×${stacks}`;
					this.stacksEl.style.display = "block";
				} else {
					this.stacksEl.style.display = "none";
				}
			}
		}

		// Update sleep button state based on status changes
		if (status !== this.lastStatus) {
			this.updateSleepButton(energy, status);
		}
	}

	private renderProgress(m: GameViewModel) {
		const xp = m.player.stats.xp ?? 0;
		const tasks = m.player.stats.completedTasks ?? 0;

		// XP & Level
		if (xp !== this.lastXP) {
			this.lastXP = xp;
			
			const levelInfo = getLevelFromXP(xp);
			
			if (this.levelBadgeEl) {
				this.levelBadgeEl.textContent = `Lvl ${levelInfo.level}`;
				
				// Pulse animation on level up (could track previous level)
				this.levelBadgeEl.style.animation = "none";
				void this.levelBadgeEl.offsetWidth; // Trigger reflow
				this.levelBadgeEl.style.animation = "mm-level-pop 0.3s ease";
			}
			
			if (this.xpBarFill) {
				this.xpBarFill.style.width = `${levelInfo.progress}%`;
			}
			
			if (this.xpTextEl) {
				this.xpTextEl.textContent = `${this.formatXP(levelInfo.currentXP)}/${this.formatXP(levelInfo.nextLevelXP)} XP`;
				this.xpTextEl.title = `Total: ${this.formatXP(xp)} XP`;
			}
		}

		// Tasks
		if (tasks !== this.lastTasks) {
			this.lastTasks = tasks;
			
			if (this.tasksCountEl) {
				this.tasksCountEl.textContent = `✓ ${tasks}`;
				
				// Quick pulse on task completion
				this.tasksCountEl.style.animation = "none";
				void this.tasksCountEl.offsetWidth;
				this.tasksCountEl.style.animation = "mm-task-pop 0.2s ease";
			}
		}
	}

	private updateSleepButton(energy: number, status: PlayerStatus) {
		if (!this.sleepBtn) return;

		const sleeping = status === "sleeping";
		
		if (sleeping) {
			this.sleepBtn.style.display = "none";
		} else if (energy <= ENERGY_LOW_THRESHOLD) {
			this.sleepBtn.style.display = "block";
			this.sleepBtn.disabled = false;
			this.sleepBtn.style.cursor = "pointer";
			
			if (energy <= ENERGY_CRITICAL_THRESHOLD) {
				this.sleepBtn.style.background = "var(--color-red, #f87171)";
				this.sleepBtn.textContent = "😴 Sleep NOW!";
				this.sleepBtn.style.animation = "mm-pulse 1s ease-in-out infinite";
			} else {
				this.sleepBtn.style.background = "var(--color-yellow, #facc15)";
				this.sleepBtn.textContent = "😴 Sleep";
				this.sleepBtn.style.animation = "none";
			}
		} else {
			this.sleepBtn.style.display = "none";
		}
	}

	private renderPhases(m: GameViewModel) {
		if (m.phase !== this.lastPhase) {
			this.lastPhase = m.phase;
			
			const currentIdx = PHASE_ORDER.indexOf(m.phase);

			for (const [phase, chip] of this.phaseChips) {
				const idx = PHASE_ORDER.indexOf(phase);
				const isActive = phase === m.phase;
				const isPast = idx < currentIdx;

				if (isActive) {
					chip.style.background = "var(--interactive-accent)";
					chip.style.opacity = "1";
					chip.style.transform = "scale(1.15)";
					chip.style.boxShadow = "0 0 8px rgba(var(--interactive-accent-rgb), 0.5)";
				} else if (isPast) {
					chip.style.background = "transparent";
					chip.style.opacity = "0.5";
					chip.style.transform = "scale(1)";
					chip.style.boxShadow = "none";
				} else {
					chip.style.background = "transparent";
					chip.style.opacity = "0.25";
					chip.style.transform = "scale(1)";
					chip.style.boxShadow = "none";
				}
			}
		}
	}

	private renderControls(m: GameViewModel) {
		const pausedChanged = m.paused !== this.lastPaused;
		const speedChanged = m.speed !== this.lastSpeed;
		
		if (pausedChanged) {
			this.lastPaused = m.paused;
			
			if (this.pauseBtn) {
				this.pauseBtn.textContent = m.paused ? "▶" : "⏸";
				this.pauseBtn.style.background = m.paused
					? "var(--interactive-accent)"
					: "var(--background-secondary)";
				this.pauseBtn.style.color = m.paused
					? "var(--text-on-accent)"
					: "var(--text-normal)";
			}
		}

		if (speedChanged || pausedChanged) {
			this.lastSpeed = m.speed;
			
			for (const [preset, btn] of this.speedBtns) {
				const isActive = !m.paused && preset === m.speed;
				btn.style.background = isActive
					? "var(--interactive-accent)"
					: "var(--background-secondary)";
				btn.style.color = isActive
					? "var(--text-on-accent)"
					: "var(--text-normal)";
				btn.style.opacity = m.paused ? "0.5" : "1";
			}
		}
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// HELPERS
	// ═══════════════════════════════════════════════════════════════════════════
	private makeControlBtn(parent: HTMLElement, text: string, onClick: () => void): HTMLButtonElement {
		const btn = parent.createEl("button", { text });
		btn.addEventListener("click", () => void onClick());
		btn.style.cssText = `
			border: 1px solid var(--background-modifier-border);
			border-radius: 6px;
			padding: 6px 10px;
			background: var(--background-secondary);
			cursor: pointer;
			font-size: 11px;
			font-weight: 500;
			transition: all 0.15s ease;
		`;
		
		btn.addEventListener("mouseenter", () => {
			if (!btn.disabled) {
				btn.style.borderColor = "var(--interactive-accent)";
			}
		});
		btn.addEventListener("mouseleave", () => {
			btn.style.borderColor = "var(--background-modifier-border)";
		});
		
		return btn;
	}

	private formatXP(xp: number): string {
		if (xp >= 1000) {
			return `${(xp / 1000).toFixed(1)}k`;
		}
		return String(xp);
	}

	private injectAnimationStyles() {
		const styleId = "mm-header-animations";
		if (document.getElementById(styleId)) return;

		const style = document.createElement("style");
		style.id = styleId;
		style.textContent = `
			@keyframes mm-pulse {
				0%, 100% { transform: scale(1); }
				50% { transform: scale(1.05); }
			}
			
			@keyframes mm-level-pop {
				0% { transform: scale(1); }
				50% { transform: scale(1.2); }
				100% { transform: scale(1); }
			}
			
			@keyframes mm-task-pop {
				0% { transform: scale(1); }
				50% { transform: scale(1.15); }
				100% { transform: scale(1); }
			}
			
			@keyframes mm-xp-shine {
				0% { background-position: -100% 0; }
				100% { background-position: 200% 0; }
			}
		`;
		document.head.appendChild(style);
	}

	destroy() {
		this.root?.remove();
		this.root = undefined;
		this.speedBtns.clear();
		this.phaseChips.clear();
		this.lastMinute = -1;
		this.lastDay = -1;
		this.lastPhase = undefined;
		this.lastPaused = undefined;
		this.lastSpeed = -1;
		this.lastEnergy = -1;
		this.lastStatus = undefined;
		this.lastStacks = -1;
		this.lastXP = -1;
		this.lastTasks = -1;
	}
}
