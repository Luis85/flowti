/**
 * capture.controller.ts — Controller for capture commands.
 *
 * Non-interactive capture commands (idea, note, search, import).
 * Interactive capture functions (captureIdea, captureNote, captureBug)
 * remain in domain/capture/capture.ts as menu actions.
 *
 * Returns typed data models; rendering is handled by ui/capture-display.ts.
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse, okResponse } from "../infrastructure/request-response.js";
import type { CommandHandler } from "../infrastructure/types.js";
import { paths } from "../infrastructure/paths.js";
import { disk } from "../infrastructure/filesystem.js";
import { proc } from "../infrastructure/proc.js";
import { createCaptureFile, searchCaptures, importCaptureItems, parseTags, NOTE_TYPES } from "../domain/capture/capture.js";
import { renderSearchResults, renderImportResult, type SearchResultsModel, type ImportResultModel } from "../ui/capture-display.js";
import { renderError, type ErrorModel } from "../ui/common-renderers.js";

// ── Controller actions ──────────────────────────────────────────────

const actions: Record<string, ControllerAction> = {
	"capture:idea": (req) => {
		const text = req.flags.text;
		if (!text || typeof text !== "string") {
			return dataResponse<ErrorModel>(
				{ error: "Missing --text flag.", hint: "Usage: flowti capture:idea --text=\"My idea\" [--tags=a,b]" },
				renderError,
			);
		}
		const tags = parseTags(req.flags.tags);
		const title = text.length > 60 ? text.slice(0, 60).trim() : text;
		createCaptureFile("Idea", title, text, tags);
		return okResponse();
	},

	"capture:note": (req) => {
		const type = req.flags.type;
		const title = req.flags.title;
		if (!type || typeof type !== "string" || !title || typeof title !== "string") {
			return dataResponse<ErrorModel>(
				{ error: "Missing --type and/or --title flag.", hint: "Usage: flowti capture:note --type=task --title=\"My note\" [--tags=a,b]" },
				renderError,
			);
		}
		const normalized = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
		if (!NOTE_TYPES.includes(normalized)) {
			return dataResponse<ErrorModel>(
				{ error: `Invalid type: ${type}`, hint: `Valid types: ${NOTE_TYPES.join(", ")}` },
				renderError,
			);
		}
		const tags = parseTags(req.flags.tags);
		createCaptureFile(normalized, title, "", tags);
		return okResponse();
	},

	"capture:search": (req) => {
		const query = req.flags.query;
		if (!query || typeof query !== "string") {
			return dataResponse<ErrorModel>(
				{ error: "Missing --query flag.", hint: "Usage: flowti capture:search --query=\"keyword\" [--type=idea] [--tag=urgent]" },
				renderError,
			);
		}
		const typeFilter = typeof req.flags.type === "string" ? req.flags.type.charAt(0).toUpperCase() + req.flags.type.slice(1).toLowerCase() : undefined;
		const tagFilter = typeof req.flags.tag === "string" ? req.flags.tag : undefined;
		const results = searchCaptures(query, typeFilter, tagFilter);
		const model: SearchResultsModel = { query, results };

		return dataResponse(model, renderSearchResults);
	},

	"capture:import": (req) => {
		const file = req.flags.file;
		if (!file || typeof file !== "string") {
			return dataResponse<ErrorModel>(
				{ error: "Missing --file flag.", hint: "Usage: flowti capture:import --file=items.json\nJSON format: [{ \"type\": \"Idea\", \"title\": \"...\", \"body\": \"...\", \"tags\": [\"a\"] }]" },
				renderError,
			);
		}
		const absPath = paths.isAbsolute(file) ? file : paths.join(proc.cwd(), file);
		if (!disk.existsSync(absPath)) {
			return dataResponse<ErrorModel>({ error: `File not found: ${file}` }, renderError);
		}
		const result = importCaptureItems(absPath);
		if (result.error) {
			return dataResponse<ErrorModel>({ error: result.error }, renderError);
		}
		const model: ImportResultModel = { created: result.created, skipped: result.skipped };
		return dataResponse(model, renderImportResult);
	},
};

// ── Adapted commands ────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
