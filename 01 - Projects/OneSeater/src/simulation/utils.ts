import { MessageTemplate, MessageContext } from "src/messages/types";
import { DayPhase } from "./types";

export function isWeekend(dayIndex: number): boolean {
  // Convention: day 0 = Monday => weekend (5,6)
  const dow = dayIndex % 7;
  return dow === 5 || dow === 6;
}

/**
 * Soft time-of-day curve.
 * Everything can happen: never returns 0.
 */
export function defaultTimeOfDayFactor(minuteOfDay: number): number {
  // night: 00:00-06:00 low, morning medium, work high, session high-ish, wrapup lower
  if (minuteOfDay < 360) return 0.15;     // night
  if (minuteOfDay < 540) return 0.6;      // morning
  if (minuteOfDay < 1020) return 1.0;     // work
  if (minuteOfDay < 1200) return 0.85;    // session
  return 0.45;                             // wrapup
}

export function defaultWeekendFactor(isWeekend: boolean): number {
  return isWeekend ? 0.55 : 1.0; // softer on weekends, but not zero
}

export function computeTemplateWeight(t: MessageTemplate, ctx: MessageContext): number {
  const base = Math.max(0, t.weight);
  if (base <= 0) return 0;

  const wkd = isWeekend(ctx.dayIndex);

  const tof = t.soft?.timeOfDayFactor?.(ctx.minuteOfDay) ?? defaultTimeOfDayFactor(ctx.minuteOfDay);
  const wf = t.soft?.weekendFactor?.(wkd) ?? defaultWeekendFactor(wkd);

  // Safety: never negative, never NaN
  const result = base * Math.max(0.01, tof) * Math.max(0.01, wf);
  return Number.isFinite(result) ? result : 0;
}

/** Deterministic RNG step (LCG). Keep state in your system Storage. */
export function nextRng(seed: number): { seed: number; value: number } {
  const next = (seed * 1664525 + 1013904223) >>> 0;
  return { seed: next, value: next / 4294967296 };
}

/** Weighted pick. Returns undefined if no item has weight > 0. */
export function weightedPick<T>(
  items: T[],
  weights: number[],
  roll01: number
): T | undefined {
  if (items.length === 0 || items.length !== weights.length) return undefined;

  let total = 0;
  for (const w of weights) total += Math.max(0, w);
  if (total <= 0) return undefined;

  // roll in [0,total)
  let r = Math.max(0, Math.min(0.999999999, roll01)) * total;

  for (let i = 0; i < items.length; i++) {
	r -= Math.max(0, weights[i]);
	if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}



export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}


export function formatMinute(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * non-linear presets for simulation speed:
 * 1 = realtime
 * 1800 = 30 minutes per second
 * 3600 = 1 hour per second
 * 36000 = 10 hours per second
 */
export function speedLabel(multiplier: number): string {
  if (multiplier === 1) return "1x";
  if (multiplier === 1800) return "30m/s";
  if (multiplier === 3600) return "1h/s";
  if (multiplier === 36000) return "10h/s";
  if (multiplier === 0) return "0x";
  return `${multiplier}x`;
}

export function phaseHeadline(phase: DayPhase): string {
  switch (phase) {
    case "night": return "Night Shift";
    case "morning": return "Morning Briefing";
    case "work": return "Operations & R&D";
    case "session": return "Track Session";
    case "wrapup": return "Wrap-up & Planning";
    default: return String(phase);
  }
}

export function nextPhaseName(minuteOfDay: number): string {
  if (minuteOfDay < 360) return "morning (06:00)";
  if (minuteOfDay < 540) return "work (09:00)";
  if (minuteOfDay < 1020) return "session (17:00)";
  if (minuteOfDay < 1200) return "wrapup (20:00)";
  return "night (00:00)";
}

