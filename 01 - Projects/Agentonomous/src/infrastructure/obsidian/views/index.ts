/**
 * Aggregator for every Obsidian view registration.
 *
 * Each module declares its views as platform-neutral `ViewIntent` data.
 * This file provides the matching `ViewRegistration` (intent + factory)
 * for every view the plugin knows how to render in Obsidian.  main.ts
 * filters this list to the subset whose types appear in an active module.
 */
import type { ViewRegistration } from '../view-registry.js';
import { HOMEPAGE_VIEW_REGISTRATION } from './homepage-view.js';
import { EVENT_INSPECTOR_VIEW_REGISTRATION } from './event-inspector-view.js';
import { FILE_DETAIL_VIEW_REGISTRATION } from './file-detail-view.js';
import { MAKE_VIEW_REGISTRATION } from './make-view.js';

export const VIEW_REGISTRATIONS: readonly ViewRegistration[] = [
	HOMEPAGE_VIEW_REGISTRATION,
	EVENT_INSPECTOR_VIEW_REGISTRATION,
	FILE_DETAIL_VIEW_REGISTRATION,
	MAKE_VIEW_REGISTRATION,
];
