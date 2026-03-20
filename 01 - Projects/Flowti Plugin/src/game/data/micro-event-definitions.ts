/**
 * micro-event-definitions.ts — 9 world event types with phase gates, probabilities, and flags.
 */

import type { DayPhase } from "./day-phase-config.js";

export interface MicroEventDefinition {
	readonly type: string;
	readonly label: string;
	readonly triggerPhases: readonly DayPhase[];
	readonly probability: number;       // 0-1, rolled per eligible phase
	readonly guaranteed: boolean;
	readonly cooldownMs: number;
	readonly durationMs: number;        // how long the event plays out
	readonly suppressedBySensor?: string; // real sensor event type that suppresses this
	readonly priority: number;           // lower = fires first among guaranteed events
}

export const MICRO_EVENTS: readonly MicroEventDefinition[] = [
	{
		type: "standup", label: "Standup",
		triggerPhases: ["morning-arrival"],
		probability: 1, guaranteed: true, cooldownMs: 0, durationMs: 20_000,
		priority: 1,
	},
	{
		type: "deploy-success", label: "Deploy Success",
		triggerPhases: ["morning-arrival", "productive-morning"],
		probability: 1, guaranteed: true, cooldownMs: 0, durationMs: 8_000,
		suppressedBySensor: "build-success",
		priority: 2,
	},
	{
		type: "tea-time", label: "Tea Time",
		triggerPhases: ["afternoon"],
		probability: 1, guaranteed: true, cooldownMs: 0, durationMs: 12_000,
		priority: 1,
	},
	{
		type: "end-of-day", label: "End of Day Bell",
		triggerPhases: ["wind-down"],
		probability: 1, guaranteed: true, cooldownMs: 0, durationMs: 5_000,
		priority: 1,
	},
	{
		type: "new-pr", label: "New PR",
		triggerPhases: ["productive-morning", "afternoon"],
		probability: 0.6, guaranteed: false, cooldownMs: 60_000, durationMs: 8_000,
		priority: 10,
	},
	{
		type: "eureka", label: "Eureka Moment",
		triggerPhases: ["productive-morning", "afternoon"],
		probability: 0.15, guaranteed: false, cooldownMs: 120_000, durationMs: 6_000,
		priority: 10,
	},
	{
		type: "build-break", label: "Build Break",
		triggerPhases: ["afternoon-slump"],
		probability: 0.5, guaranteed: false, cooldownMs: 0, durationMs: 15_000,
		suppressedBySensor: "test-fail",
		priority: 5,
	},
	{
		type: "birthday", label: "Birthday",
		triggerPhases: ["lunch"],
		probability: 0.10, guaranteed: false, cooldownMs: 0, durationMs: 10_000,
		priority: 10,
	},
	{
		type: "power-flicker", label: "Power Flicker",
		triggerPhases: ["afternoon-slump"],
		probability: 0.05, guaranteed: false, cooldownMs: 0, durationMs: 3_000,
		priority: 10,
	},
];
