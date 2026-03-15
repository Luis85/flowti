/**
 * capture.controller.ts — Controller for capture commands.
 *
 * Non-interactive capture commands (idea, note, search, import).
 * Interactive capture functions (captureIdea, captureNote, captureBug)
 * remain in domain/capture/capture.ts as menu actions.
 *
 * Returns typed data models; rendering is handled by ui/capture-display.ts.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types.js";
import type { LogFn } from "../infrastructure/command-engine.js";
import { VAULT_ROOT, getCaptureDir } from "../infrastructure/config.js";
import { createCaptureFile, searchCaptures, importCaptureItems, parseTags, NOTE_TYPES } from "../domain/capture/capture.js";
import { renderSearchResults, renderImportResult, type SearchResultsModel, type ImportResultModel } from "../ui/displays/capture-display.js";
import { renderError, type ErrorModel } from "../ui/renderers/common-renderers.js";

// ── Model types ─────────────────────────────────────────────────────

type CaptureOkModel = Record<string, never>;
type CaptureModel = CaptureOkModel | ErrorModel;
type SearchModel = SearchResultsModel | ErrorModel;
type ImportModel = ImportResultModel | ErrorModel;

function isErrorModel(m: unknown): m is ErrorModel {
	return typeof m === "object" && m !== null && "error" in m;
}

function renderCaptureResult(data: CaptureModel, log: LogFn): void {
	if (isErrorModel(data)) { renderError(data, log); return; }
	// ok — side-effect only, no output needed
}

function renderSearchOrError(data: SearchModel, log: LogFn): void {
	if (isErrorModel(data)) { renderError(data, log); return; }
	renderSearchResults(data as SearchResultsModel, log);
}

function renderImportOrError(data: ImportModel, log: LogFn): void {
	if (isErrorModel(data)) { renderError(data, log); return; }
	renderImportResult(data as ImportResultModel, log);
}

// ── Commands ────────────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = {
	"capture:idea": adaptDescriptor<Record<string, unknown>, CaptureModel>({
		handler: (ctx) => {
			const text = ctx.flags.text;
			if (!text || typeof text !== "string") {
				return {
					error: "Missing --text flag.",
					hint: 'Usage: flowti capture:idea --text="My idea" [--tags=a,b]',
				} as ErrorModel;
			}
			const tags = parseTags(ctx.flags.tags as string | boolean | undefined);
			const title = text.length > 60 ? text.slice(0, 60).trim() : text;
			createCaptureFile(getCaptureDir("idea"), ctx.deps, "Idea", title, text, tags);
			return {} as CaptureOkModel;
		},
		renderer: renderCaptureResult,
	}),

	"capture:note": adaptDescriptor<Record<string, unknown>, CaptureModel>({
		handler: (ctx) => {
			const type = ctx.flags.type;
			const title = ctx.flags.title;
			if (!type || typeof type !== "string" || !title || typeof title !== "string") {
				return {
					error: "Missing --type and/or --title flag.",
					hint: 'Usage: flowti capture:note --type=task --title="My note" [--tags=a,b]',
				} as ErrorModel;
			}
			const normalized = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
			if (!NOTE_TYPES.includes(normalized)) {
				return {
					error: `Invalid type: ${type}`,
					hint: `Valid types: ${NOTE_TYPES.join(", ")}`,
				} as ErrorModel;
			}
			const tags = parseTags(ctx.flags.tags as string | boolean | undefined);
			createCaptureFile(getCaptureDir(normalized.toLowerCase()), ctx.deps, normalized, title, "", tags);
			return {} as CaptureOkModel;
		},
		renderer: renderCaptureResult,
	}),

	"capture:search": adaptDescriptor<Record<string, unknown>, SearchModel>({
		handler: (ctx) => {
			const query = ctx.flags.query;
			if (!query || typeof query !== "string") {
				return {
					error: "Missing --query flag.",
					hint: 'Usage: flowti capture:search --query="keyword" [--type=idea] [--tag=urgent]',
				} as ErrorModel;
			}
			const typeFilter = typeof ctx.flags.type === "string" && ctx.flags.type
				? ctx.flags.type.charAt(0).toUpperCase() + ctx.flags.type.slice(1).toLowerCase()
				: undefined;
			const tagFilter = typeof ctx.flags.tag === "string" && ctx.flags.tag ? ctx.flags.tag : undefined;
			const results = searchCaptures(VAULT_ROOT, getCaptureDir, ctx.deps, query, typeFilter, tagFilter);
			return { query, results };
		},
		renderer: renderSearchOrError,
	}),

	"capture:import": adaptDescriptor<Record<string, unknown>, ImportModel>({
		handler: (ctx) => {
			const { disk, paths, proc } = ctx.deps;
			const file = ctx.flags.file;
			if (!file || typeof file !== "string") {
				return {
					error: "Missing --file flag.",
					hint: 'Usage: flowti capture:import --file=items.json\nJSON format: [{ "type": "Idea", "title": "...", "body": "...", "tags": ["a"] }]',
				} as ErrorModel;
			}
			const absPath = paths.isAbsolute(file) ? file : paths.join(proc.cwd(), file);
			if (!disk.existsSync(absPath)) {
				return { error: `File not found: ${file}` } as ErrorModel;
			}
			const result = importCaptureItems(getCaptureDir, ctx.deps, absPath);
			if (result.error) {
				return { error: result.error } as ErrorModel;
			}
			return { created: result.created, skipped: result.skipped };
		},
		renderer: renderImportOrError,
	}),
};
