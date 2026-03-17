/**
 * Handles opening the user-configured startpage on layout ready.
 *
 * Maps the `startPage` setting value to a view type and opens it
 * when the workspace layout is ready. "none" preserves Obsidian defaults.
 */

import type { Workspace } from "obsidian";
import {
	VIEW_TYPE_USER_HUB,
	VIEW_TYPE_EVENT_CATALOG,
	VIEW_TYPE_DATA_EXCHANGE_HUB,
	VIEW_TYPE_ANALYTICS_HUB,
	VIEW_TYPE_TRAIN_HUB,
} from "../domain/hub/types";
import type { FlowtiSettings } from "../domain/settings/settings";

const START_PAGE_VIEW_MAP: Record<string, string> = {
	"user-hub": VIEW_TYPE_USER_HUB,
	"event-catalog": VIEW_TYPE_EVENT_CATALOG,
	"data-exchange-hub": VIEW_TYPE_DATA_EXCHANGE_HUB,
	"analytics-hub": VIEW_TYPE_ANALYTICS_HUB,
	"train-hub": VIEW_TYPE_TRAIN_HUB,
};

export function resolveStartPageViewType(startPage: FlowtiSettings["startPage"]): string | null {
	if (startPage === "none") return null;
	return START_PAGE_VIEW_MAP[startPage] ?? null;
}

export function openStartPage(workspace: Workspace, startPage: FlowtiSettings["startPage"]): void {
	const viewType = resolveStartPageViewType(startPage);
	if (!viewType) return;

	const leaf = workspace.getLeaf("tab");
	void leaf.setViewState({ type: viewType, active: true });
	void workspace.revealLeaf(leaf);
}
