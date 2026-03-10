/**
 * help-content.ts — Combines individual help pages into the HELP record.
 */

import { helpMain } from "./help/main.js";
import { helpMake } from "./help/make.js";
import { helpBuild } from "./help/build.js";
import { helpReview } from "./help/review.js";
import { helpPublish } from "./help/publish.js";
import { helpReports } from "./help/reports.js";
import { helpDevtools } from "./help/devtools.js";
import { helpCapture } from "./help/capture.js";
import { helpKnowledgebase } from "./help/knowledgebase.js";
import { helpInfo } from "./help/info.js";

export const HELP: Record<string, string> = {
	main: helpMain,
	make: helpMake,
	build: helpBuild,
	review: helpReview,
	publish: helpPublish,
	reports: helpReports,
	devtools: helpDevtools,
	capture: helpCapture,
	knowledgebase: helpKnowledgebase,
	info: helpInfo,
};
