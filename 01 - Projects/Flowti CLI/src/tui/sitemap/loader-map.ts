/**
 * loader-map.ts — Maps pageId to its loader function.
 *
 * Every page in sitemap.json that has a TUI loader is registered here.
 * SitemapPage uses this to load data before rendering the content zone.
 */

import type { LoaderFn } from "../loaders/loader-types.js";
import { loadStart } from "../loaders/start-loader.js";
import { loadHealth } from "../loaders/health-loader.js";
import { loadIterations } from "../loaders/iterations-loader.js";
import { loadIterationDetail } from "../loaders/iteration-detail-loader.js";
import { loadProjectDetail } from "../loaders/project-detail-loader.js";
import { loadProjectsList } from "../loaders/projects-list-loader.js";
import { loadAgentDetail } from "../loaders/agent-detail-loader.js";
import { loadAiTools } from "../loaders/ai-tools-loader.js";
import { loadBuild } from "../loaders/build-loader.js";
import { loadTest } from "../loaders/test-loader.js";
import { loadScaffold } from "../loaders/scaffold-loader.js";
import { loadMake } from "../loaders/make-loader.js";
import { loadReview } from "../loaders/review-loader.js";
import { loadPublish } from "../loaders/publish-loader.js";
import { loadReports } from "../loaders/reports-loader.js";
import { loadEventCatalog } from "../loaders/event-catalog-loader.js";
import { loadPlugins } from "../loaders/plugins-loader.js";
import { loadDevtools } from "../loaders/devtools-loader.js";
import { loadHelp } from "../loaders/help-loader.js";
import { loadCapture } from "../loaders/capture-loader.js";
import { loadKnowledgebase } from "../loaders/knowledgebase-loader.js";
import { loadLifecycle } from "../loaders/lifecycle-loader.js";
import { loadResources } from "../loaders/resources-loader.js";
import { loadRequirements } from "../loaders/requirements-loader.js";
import { loadDeliverables } from "../loaders/deliverables-loader.js";
import { loadRaid } from "../loaders/raid-loader.js";
import { loadCapa } from "../loaders/capa-loader.js";
import { loadTimelog } from "../loaders/timelog-loader.js";
import { loadOnboarding } from "../loaders/onboarding-loader.js";
import { loadOnboardingTour } from "../loaders/onboarding-tour-loader.js";

const loaderMap: Record<string, LoaderFn<unknown>> = {
	"start": loadStart,
	"health": loadHealth,
	"iterations": loadIterations,
	"iteration-detail": loadIterationDetail,
	"project-detail": loadProjectDetail,
	"projects-list": loadProjectsList as LoaderFn<unknown>,
	"agent-detail": loadAgentDetail,
	"ai-tools": loadAiTools,
	"build": loadBuild,
	"test": loadTest,
	"scaffold": loadScaffold,
	"make": loadMake,
	"review": loadReview,
	"publish": loadPublish,
	"reports": loadReports,
	"event-catalog": loadEventCatalog,
	"plugins": loadPlugins,
	"devtools": loadDevtools,
	"help": loadHelp,
	"capture": loadCapture,
	"knowledgebase": loadKnowledgebase,
	"lifecycle": loadLifecycle,
	"resources": loadResources,
	"requirements": loadRequirements,
	"deliverables": loadDeliverables,
	"raid": loadRaid,
	"capa": loadCapa,
	"timelog": loadTimelog,
	"onboarding": loadOnboarding,
	"onboarding-tour": loadOnboardingTour,
};

export function getLoaderForPage(pageId: string): LoaderFn<unknown> | undefined {
	return loaderMap[pageId];
}
