/**
 * events.controller.ts — Controller for event catalog commands.
 *
 * Returns typed data models; rendering is handled by ui/events-display.ts.
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import type { CommandHandler } from "../infrastructure/types.js";
import { listEvents, createEventFile, parseCommaSeparated } from "../domain/events/event-catalog.js";
import type { EventDefinition } from "../domain/events/event-catalog.js";
import { parsePayloadFlag } from "../domain/events/event-payload.js";
import { versionEvent } from "../domain/events/event-versioning.js";
import { saveEventFlowDoc } from "../domain/events/event-flow.js";
import { loadEventContracts, validateContracts, generateContractsJson, validatePayload, findContract } from "../domain/events/event-contracts.js";
import { generateEventTypes } from "../domain/events/event-codegen.js";

import { renderError } from "../ui/renderers/common-renderers.js";
import type { ErrorModel } from "../ui/renderers/common-renderers.js";
import {
	renderEventList, renderEventFlowCreated, renderEventAdded,
	renderContractValidation, renderPayloadValidation,
	renderContractsGenerated, renderCodegenGenerated, renderEmpty,
	renderVersionEvent,
} from "../ui/displays/events-display.js";
import type {
	EventListModel, EventFlowCreatedModel, EventAddedModel,
	ContractValidationModel, PayloadValidationModel,
	ContractsGeneratedModel, CodegenGeneratedModel, EmptyModel,
	VersionEventModel,
} from "../ui/displays/events-display.js";

// ── Flag helpers ────────────────────────────────────────────────────

function flagStr(flags: Record<string, string | boolean>, key: string, fallback: string): string {
	return typeof flags[key] === "string" ? flags[key] : fallback;
}

function flagList(flags: Record<string, string | boolean>, key: string): string[] {
	return typeof flags[key] === "string" ? parseCommaSeparated(flags[key]) : [];
}

// ── Controller actions ──────────────────────────────────────────────

const actions: Record<string, ControllerAction> = {
	"events:list": (req) => {
		if (!req.project) return;
		const events = listEvents(req.deps, req.project.path);
		return dataResponse<EventListModel>({ events }, (d) => renderEventList(d, req.deps.log));
	},

	"events:flow": (req) => {
		if (!req.project) return;
		const { paths } = req.deps;
		const domain = typeof req.flags.domain === "string" ? req.flags.domain : undefined;
		const relativePath = paths.relative(req.project.path, saveEventFlowDoc(req.deps, req.project.path, domain));
		return dataResponse<EventFlowCreatedModel>({ relativePath }, (d) => renderEventFlowCreated(d, req.deps.log));
	},

	"events:add": (req) => {
		if (!req.project) return;
		const { paths, log } = req.deps;
		const name = req.flags.name;
		if (!name || typeof name !== "string") {
			return dataResponse<ErrorModel>(
				{ error: "Missing --name flag.", hint: 'Usage: flowti events:add --name="user.created" --domain="user"' },
				(d) => renderError(d, log),
			);
		}
		const payload = typeof req.flags.payload === "string" ? parsePayloadFlag(req.flags.payload) : [];
		const def: EventDefinition = {
			name, domain: flagStr(req.flags, "domain", "core"), version: flagStr(req.flags, "version", "1.0.0"),
			description: flagStr(req.flags, "description", ""), producers: flagList(req.flags, "producers"),
			consumers: flagList(req.flags, "consumers"), payload,
		};
		const filePath = createEventFile(req.deps, req.project.path, def);
		if (filePath) {
			return dataResponse<EventAddedModel>(
				{ relativePath: paths.relative(req.project.path, filePath) },
				(d) => renderEventAdded(d, req.deps.log),
			);
		}
	},

	"events:validate": (req) => {
		if (!req.project) return;
		const { disk, paths } = req.deps;
		const dir = paths.join(req.project.path, "docs", "events");
		const contracts = loadEventContracts(req.deps, dir, disk);
		if (contracts.length === 0) {
			return dataResponse<EmptyModel>({ message: "No events found in docs/events/." }, (d) => renderEmpty(d, req.deps.log));
		}
		const result = validateContracts(contracts);
		const model: ContractValidationModel = { contractCount: contracts.length, result };
		const { log } = req.deps;
		return {
			data: model,
			render: (d: ContractValidationModel) => renderContractValidation(d, log),
			exitCode: result.valid ? undefined : 1,
		};
	},

	"events:check-payload": (req) => {
		if (!req.project) return;
		const { disk, paths, log } = req.deps;
		const eventName = req.flags.event;
		const payloadJson = req.flags.payload;
		if (!eventName || typeof eventName !== "string" || !payloadJson || typeof payloadJson !== "string") {
			return dataResponse<ErrorModel>(
				{ error: "Missing --event and/or --payload flag.", hint: "Usage: flowti events:check-payload --event=\"user.created\" --payload='{\"id\":\"1\"}'" },
				(d) => renderError(d, log),
			);
		}
		const dir = paths.join(req.project.path, "docs", "events");
		const contracts = loadEventContracts(req.deps, dir, disk);
		const contract = findContract(contracts, eventName);
		if (!contract) {
			return {
				data: { error: `No contract found for event "${eventName}".` } as ErrorModel,
				render: (d: ErrorModel) => renderError(d, log),
				exitCode: 1,
			};
		}
		let payload: Record<string, unknown>;
		try {
			payload = JSON.parse(payloadJson) as Record<string, unknown>;
		} catch {
			return {
				data: { error: "Invalid JSON payload." } as ErrorModel,
				render: (d: ErrorModel) => renderError(d, log),
				exitCode: 1,
			};
		}
		const result = validatePayload(contract, payload);
		const model: PayloadValidationModel = { eventName, result };
		return {
			data: model,
			render: (d: PayloadValidationModel) => renderPayloadValidation(d, log),
			exitCode: result.valid ? undefined : 1,
		};
	},

	"events:contracts": (req) => {
		if (!req.project) return;
		const { disk, paths } = req.deps;
		const dir = paths.join(req.project.path, "docs", "events");
		const contracts = loadEventContracts(req.deps, dir, disk);
		if (contracts.length === 0) {
			return dataResponse<EmptyModel>({ message: "No events found in docs/events/." }, (d) => renderEmpty(d, req.deps.log));
		}
		const outPath = typeof req.flags.out === "string"
			? paths.resolve(req.project.path, req.flags.out)
			: paths.join(dir, "contracts.json");
		const json = generateContractsJson(contracts);
		const outDir = paths.dirname(outPath);
		disk.mkdirSync(outDir, { recursive: true });
		disk.writeFileSync(outPath, json, "utf-8");
		return dataResponse<ContractsGeneratedModel>(
			{ relativePath: paths.relative(req.project.path, outPath), contractCount: contracts.length },
			(d) => renderContractsGenerated(d, req.deps.log),
		);
	},

	"events:codegen": (req) => {
		if (!req.project) return;
		const { disk, paths } = req.deps;
		const dir = paths.join(req.project.path, "docs", "events");
		const contracts = loadEventContracts(req.deps, dir, disk);
		if (contracts.length === 0) {
			return dataResponse<EmptyModel>({ message: "No events found in docs/events/." }, (d) => renderEmpty(d, req.deps.log));
		}
		const ts = generateEventTypes(contracts);
		const outPath = typeof req.flags.out === "string"
			? paths.resolve(req.project.path, req.flags.out)
			: paths.join(req.project.path, "src", "generated", "event-types.ts");
		const outDir = paths.dirname(outPath);
		disk.mkdirSync(outDir, { recursive: true });
		disk.writeFileSync(outPath, ts, "utf-8");
		return dataResponse<CodegenGeneratedModel>(
			{ relativePath: paths.relative(req.project.path, outPath), contractCount: contracts.length },
			(d) => renderCodegenGenerated(d, req.deps.log),
		);
	},

	"events:version": (req) => {
		if (!req.project) return;
		const name = req.flags.name;
		const version = req.flags.version;
		const migration = req.flags.migration;

		if (!name || typeof name !== "string" || !version || typeof version !== "string") {
			return dataResponse<ErrorModel>(
				{ error: "Missing required flags.", hint: 'Usage: flowti events:version --name="user.created" --version="2.0.0" --migration="Added email field"' },
				(d) => renderError(d, req.deps.log),
			);
		}

		const migrationNotes = typeof migration === "string" ? migration : "";
		const result = versionEvent(req.deps, req.project.path, name, version, migrationNotes);

		if (!result.success) {
			return dataResponse<ErrorModel>({ error: result.error ?? "Version update failed." }, (d) => renderError(d, req.deps.log));
		}

		const model: VersionEventModel = {
			success: true,
			name: result.name,
			newVersion: result.newVersion,
			previousVersion: result.previousVersion,
		};
		return dataResponse(model, (d) => renderVersionEvent(d, req.deps.log));
	},
};

// ── Adapted commands ────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
