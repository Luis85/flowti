
import { GameViewModel } from "src/models/GameViewModel";
import { DayPhase, PHASE_MARKERS } from "src/simulation/types";

export class TimelinePanel {
  private root?: HTMLElement;
  private progressEl?: HTMLElement;
  private markerEls = new Map<DayPhase, HTMLElement>();
  private labelEls = new Map<DayPhase, HTMLElement>();

  private lastMinute = -1;
  private lastPhase?: DayPhase;

  mount(parent: HTMLElement) {
    this.root = parent.createDiv({ cls: "mm-timeline" });
    this.root.style.cssText = `padding: 6px 14px 14px;`;

    // Track container - includes markers AND labels
    const trackWrap = this.root.createDiv();
    trackWrap.style.cssText = `position: relative; height: 40px;`;

    // Background track
    const track = trackWrap.createDiv();
    track.style.cssText = `
      position: absolute;
      top: 12px;
      left: 0;
      right: 0;
      height: 5px;
      background: var(--background-modifier-border);
      border-radius: 3px;
      overflow: hidden;
    `;

    // Progress fill - NO TRANSITION to prevent smooth-back
    this.progressEl = track.createDiv();
    this.progressEl.style.cssText = `
      height: 100%;
      width: 0%;
      background: var(--interactive-accent);
      border-radius: 3px;
    `;

    // Phase markers AND labels - both absolutely positioned at same x%
    for (const marker of PHASE_MARKERS) {
      const xPct = (marker.minute / 1440) * 100;
      
      // Dot - centered on the track (track top: 12px, height: 5px, so center is 14.5px)
      const markerEl = trackWrap.createDiv();
      markerEl.style.cssText = `
        position: absolute;
        left: ${xPct}%;
        top: 14.5px;
        transform: translate(-50%, -50%);
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--background-primary);
        border: 2px solid var(--background-modifier-border);
        z-index: 1;
      `;
      this.markerEls.set(marker.phase, markerEl);

      // Label - directly below the dot
      const labelEl = trackWrap.createDiv({ text: marker.label });
      labelEl.style.cssText = `
        position: absolute;
        left: ${xPct}%;
        top: 30px;
        transform: translateX(-50%);
        font-size: 9px;
        opacity: 0.5;
        white-space: nowrap;
      `;
      labelEl.dataset["phase"] = marker.phase;
      this.labelEls.set(marker.phase, labelEl);
    }
  }

  render(m: GameViewModel) {
    // Progress - only update if minute changed
    if (m.minuteOfDay !== this.lastMinute) {
      this.lastMinute = m.minuteOfDay;
      if (this.progressEl) {
        const pct = (m.minuteOfDay / 1440) * 100;
        this.progressEl.style.width = `${pct}%`;
      }
    }

    // Markers + labels - only update if phase changed
    if (m.phase !== this.lastPhase) {
      this.lastPhase = m.phase;
      
      const phaseOrder: DayPhase[] = ["night", "morning", "work", "session", "wrapup"];
      const currentIdx = phaseOrder.indexOf(m.phase);

      for (const [phase, el] of this.markerEls) {
        const idx = phaseOrder.indexOf(phase);
        const isActive = phase === m.phase;
        const isPast = idx < currentIdx;

        if (isActive) {
          el.style.background = "var(--interactive-accent)";
          el.style.borderColor = "var(--interactive-accent)";
          el.style.transform = "translate(-50%, -50%) scale(1.3)";
          el.style.boxShadow = "0 0 6px var(--interactive-accent)";
        } else if (isPast) {
          el.style.background = "var(--interactive-accent)";
          el.style.borderColor = "var(--interactive-accent)";
          el.style.transform = "translate(-50%, -50%) scale(1)";
          el.style.boxShadow = "none";
        } else {
          el.style.background = "var(--background-primary)";
          el.style.borderColor = "var(--background-modifier-border)";
          el.style.transform = "translate(-50%, -50%) scale(1)";
          el.style.boxShadow = "none";
        }
      }

      // Update label styling
      for (const [phase, labelEl] of this.labelEls) {
        const isActive = phase === m.phase;
        labelEl.style.opacity = isActive ? "1" : "0.5";
        labelEl.style.fontWeight = isActive ? "600" : "400";
        labelEl.style.color = isActive ? "var(--interactive-accent)" : "var(--text-normal)";
      }
    }
  }

  destroy() {
    this.root?.remove();
    this.root = undefined;
    this.progressEl = undefined;
    this.markerEls.clear();
    this.labelEls.clear();
    this.lastMinute = -1;
    this.lastPhase = undefined;
  }
}
