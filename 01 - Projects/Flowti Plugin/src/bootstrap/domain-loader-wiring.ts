/**
 * Domain loader wiring — scanner/listener helpers extracted from domain-loader.ts.
 *
 * Contains vault-scanning setup for test management, feature lifecycle, and
 * process services, plus session auto-open listeners and settings wiring.
 */

import { TFile } from "obsidian";
import type { DomainLoaderDeps } from "./domain-loader.js";
import type { ISettingsService } from "../domain/settings/types.js";
import type { TestManagementService } from "../domain/testManagement/TestManagementService.js";
import type { FeatureLifecycleService } from "../domain/featureLifecycle/FeatureLifecycleService.js";
import type { ProcessService } from "../domain/process/ProcessService.js";
import type { SessionService } from "../domain/session/SessionService.js";
import type { InboxService } from "../domain/inbox/InboxService.js";
import type { AnalyticsService } from "../domain/analytics/AnalyticsService.js";
import type { TrainSetup } from "./trainSetup.js";
import { VIEW_TYPE_SESSION_WORKSPACE } from "../ui/session/SessionWorkspaceView.js";
import type { SessionWorkspaceView } from "../ui/session/SessionWorkspaceView.js";

export function wireTestManagementScanners(
	deps: DomainLoaderDeps,
	testManagementService: TestManagementService,
	settingsService: ISettingsService,
): void {
	testManagementService.setScanner(async () => {
		const scanStart = performance.now();
		const folder = settingsService.getSettings().journeyFolder;
		const abstract = deps.app.vault.getAbstractFileByPath(folder);
		if (!abstract) return [];
		const results: { json: Record<string, unknown>; path: string }[] = [];
		const files = deps.getFilesInFolder(folder, (f) => f.extension === "json");
		for (const file of files) {
			try {
				const content = await deps.app.vault.read(file);
				if (deps.hasMergeConflictMarkers(content)) {
					deps.logger.warn(`[Flowti] Skipping conflicted journey JSON: ${file.path}`);
					continue;
				}
				const json = JSON.parse(content) as Record<string, unknown>;
				if (typeof json.journey === "string") results.push({ json, path: file.path });
			} catch { /* skip invalid files */ }
		}
		deps.logger.debug(`[StartupProfile] scan journeys files=${files.length} matched=${results.length} duration=${Math.round(performance.now() - scanStart)}ms`);
		return results;
	});

	testManagementService.setPrdScanner(async () => {
		const scanStart = performance.now();
		const featuresFolder = settingsService.getSettings().featuresFolder;
		const abstract = deps.app.vault.getAbstractFileByPath(featuresFolder);
		if (!abstract) return [];
		const results: { name: string; stage: string; domain: string }[] = [];
		const files = deps.getFilesInFolder(featuresFolder, (f) => f.extension === "md");
		for (const file of files) {
			const cache = deps.app.metadataCache.getFileCache(file);
			const fm = cache?.frontmatter;
			if (!fm || fm.type !== "ProductRequirementsDocument") continue;
			results.push({
				name: file.basename.replace(/ PRD$/, ""),
				stage: String(fm.stage ?? "unknown"),
				domain: String(fm.domain ?? "unknown"),
			});
		}
		deps.logger.debug(`[StartupProfile] scan test-mgmt-prds files=${files.length} matched=${results.length} duration=${Math.round(performance.now() - scanStart)}ms`);
		return results;
	});

	testManagementService.setTestReportReader(async () => {
		const reportPath = settingsService.getSettings().testReportPath;
		const file = deps.app.vault.getAbstractFileByPath(reportPath);
		if (!file || !(file instanceof TFile)) return null;
		try {
			const content = await deps.app.vault.read(file);
			if (deps.hasMergeConflictMarkers(content)) {
				deps.logger.warn(`[Flowti] Skipping conflicted test report JSON: ${reportPath}`);
				return null;
			}
			const report = JSON.parse(content) as { testResults?: { name?: string; status?: string }[] };
			const results = report.testResults ?? [];
			const flowSuites = results.filter((r) => r.name && r.name.includes("/flows/"));
			const unitSuites = results.filter((r) => r.name && !r.name.includes("/flows/") && !r.name.includes("/e2e/"));
			return {
				flowSuites: flowSuites.length,
				flowPassRate: flowSuites.length > 0 ? Math.round(flowSuites.filter((r) => r.status === "passed").length / flowSuites.length * 100) : 0,
				unitSuites: unitSuites.length,
				unitPassRate: unitSuites.length > 0 ? Math.round(unitSuites.filter((r) => r.status === "passed").length / unitSuites.length * 100) : 0,
			};
		} catch {
			return null;
		}
	});
}

export function wireFeatureLifecycleScanner(
	deps: DomainLoaderDeps,
	featureLifecycleService: FeatureLifecycleService,
	settingsService: ISettingsService,
): void {
	featureLifecycleService.setScanner(async () => {
		const scanStart = performance.now();
		const featuresFolder = settingsService.getSettings().featuresFolder;
		const abstract = deps.app.vault.getAbstractFileByPath(featuresFolder);
		if (!abstract) return [];
		const results: { path: string; name: string; frontmatter: Record<string, unknown> }[] = [];
		const files = deps.getFilesInFolder(featuresFolder, (f) => f.extension === "md");
		for (const file of files) {
			const cache = deps.app.metadataCache.getFileCache(file);
			const fm = cache?.frontmatter;
			if (!fm || fm.type !== "ProductRequirementsDocument") continue;
			results.push({
				path: file.path,
				name: file.basename,
				frontmatter: { ...fm },
			});
		}
		deps.logger.debug(`[StartupProfile] scan feature-lifecycle-prds files=${files.length} matched=${results.length} duration=${Math.round(performance.now() - scanStart)}ms`);
		return results;
	});
}

export function wireProcessScanner(
	deps: DomainLoaderDeps,
	processService: ProcessService,
	settingsService: ISettingsService,
): void {
	processService.setScanner(async () => {
		const scanStart = performance.now();
		const processesFolder = settingsService.getSettings().processesFolder;
		const abstract = deps.app.vault.getAbstractFileByPath(processesFolder);
		if (!abstract) return [];
		const results: { name: string; filePath: string; content: string }[] = [];
		const files = deps.getFilesInFolder(
			processesFolder,
			(f) => f.path.startsWith(processesFolder + "/") && f.extension === "canvas" && f.basename.endsWith(".process"),
		);
		for (const file of files) {
			try {
				const content = await deps.app.vault.read(file);
				if (deps.hasMergeConflictMarkers(content)) {
					deps.logger.warn(`[Flowti] Skipping conflicted process canvas: ${file.path}`);
					continue;
				}
				results.push({ name: file.basename.replace(/\.process$/, ""), filePath: file.path, content });
			} catch { /* skip unreadable files */ }
		}
		deps.logger.debug(`[StartupProfile] scan processes files=${files.length} matched=${results.length} duration=${Math.round(performance.now() - scanStart)}ms`);
		return results;
	});
}

export function wireSessionAutoOpen(
	deps: DomainLoaderDeps,
	sessionService: SessionService,
	trainSetup: TrainSetup,
	listeners: (() => void)[],
): void {
	listeners.push(
		deps.eventBus.on("session.started", (event) => {
			const { session } = event.payload;
			sessionService.workspaceSessionId = session.id;
			if (session.type === "train-of-thought") return;
			if (session.type === "canvas-session") return;

			const existingLeaves = deps.app.workspace.getLeavesOfType(VIEW_TYPE_SESSION_WORKSPACE);
			if (existingLeaves.length > 0) {
				if (session.focusFile) {
					void deps.app.workspace.openLinkText(session.focusFile, "", "split");
				}
				return;
			}

			void deps.app.workspace.getLeaf("tab").setViewState({
				type: VIEW_TYPE_SESSION_WORKSPACE,
				active: true,
			}).then(() => {
				if (session.focusFile) {
					void deps.app.workspace.openLinkText(session.focusFile, "", "split");
				}
			});
		}),
	);

	listeners.push(
		deps.eventBus.on("session.resumed", (event) => {
			const { session } = event.payload;
			if (session.type !== "canvas-session" || !session.canvasFile) return;
			void deps.app.workspace.openLinkText(session.canvasFile, "", false);
		}),
	);
}

export function wireSettingsListener(
	deps: DomainLoaderDeps,
	inboxService: InboxService,
	sessionService: SessionService,
	analyticsService: AnalyticsService,
	sessionSetupRef: { openSessionWorkspaceInSidebar?: (id: string) => void },
): (() => void)[] {
	const listeners: (() => void)[] = [];

	listeners.push(
		deps.eventBus.on("settings.changed", (event) => {
			inboxService.setEnabledSources(event.payload.settings.inboxEnabledSources);
			inboxService.setWatchedFolders(event.payload.settings.inboxWatchedFolders ?? []);
			inboxService.setTriageTargetFolder(event.payload.settings.inboxTriageTargetFolder ?? "");
			sessionService.globalActivityFilter = event.payload.settings.sessionActivityFilterGlobal ?? [];
			analyticsService.setAnalyticsFolder(event.payload.settings.analyticsFolder);
			const templates = event.payload.settings.customOutputTemplates ?? [];
			for (const leaf of deps.app.workspace.getLeavesOfType(VIEW_TYPE_SESSION_WORKSPACE)) {
				(leaf.view as SessionWorkspaceView).customOutputTemplates = templates;
			}
		}),
	);

	listeners.push(
		deps.eventBus.on("session.completed", (event) => {
			void (sessionSetupRef as { writeSessionSummary?: (s: unknown) => Promise<void> }).writeSessionSummary?.(event.payload.session);
		}),
	);

	listeners.push(
		deps.eventBus.on("session.created", (event) => {
			sessionSetupRef.openSessionWorkspaceInSidebar?.(event.payload.session.id);
		}),
	);

	listeners.push(
		deps.eventBus.on("session.closure.started", (event) => {
			const sid = event.payload.sessionId;
			const alreadyVisible = deps.app.workspace
				.getLeavesOfType(VIEW_TYPE_SESSION_WORKSPACE)
				.some((l) => {
					const state = l.view.getState() as { sessionId?: string } | undefined;
					return state?.sessionId === sid;
				});
			if (!alreadyVisible) {
				sessionSetupRef.openSessionWorkspaceInSidebar?.(sid);
			}
		}),
	);

	return listeners;
}
