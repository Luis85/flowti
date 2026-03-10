/**
 * cli-events.ts — Composed CLI event map.
 *
 * Each domain defines its own EventMap interface. This file composes them
 * into a single CliEventMap used by the EventBus for type-safe emit/on.
 */

import type { ReportEventMap } from "../domain/reports/report-events.js";
import type { E2EEventMap } from "../domain/e2e/e2e-events.js";

export interface CliEventMap extends ReportEventMap, E2EEventMap {
	"cli.progress": { message: string };
	"cli.warn": { message: string };
}

export type CliEventType = keyof CliEventMap;
