/**
 * events.controller.ts — Controller for event catalog commands.
 *
 * Returns typed data models; rendering is handled by ui/events-display.ts.
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import type { CommandHandler } from "../infrastructure/types.js";
import { disk } from "../infrastructure/filesystem.js";
import { paths } from "../infrastructure/paths.js";
import { listEvents, createEventFile, parseCommaSeparated } from "../domain/events/event-catalog.js";
import type { EventDefinition } from "../domain/events/event-catalog.js";
import { parsePayloadFlag } from "../domain/events/event-payload.js";
import { versionCommands } from "../domain/events/event-versioning.js";
import { saveEventFlowDoc } from "../domain/events/event-flow.js";
import { loadEventContracts, validateContracts, generateContractsJson, validatePayload, findContract } from "../domain/events/event-contracts.js";
import { generateEventTypes } from "../domain/events/event-codegen.js";
import { renderError } from "../ui/common-renderers.js";
import type { ErrorModel } from "../ui/common-renderers.js";
import {
	renderEventList, renderEventFlowCreated, renderEventAdded,
	renderContractValidation, renderPayloadValidation,
	renderContractsGenerated, renderCodegenGenerated, renderEmpty,
} from "../ui/events-display.js";
import type {
	EventListModel, EventFlowCreatedModel, EventAddedModel,
	ContractValidationModel, PayloadValidationModel,
	ContractsGeneratedModel, CodegenGeneratedModel, EmptyModel,
} from "../ui/events-display.js";

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
		const events = listEvents(req.project.path);
		return dataResponse<EventListModel>({ events }, renderEventList);
	},

	"events:flow": (req) => {
		if (!req.project) return;
		const domain = typeof req.flags.domain === "string" ? req.flags.domain : undefined;
		const relativePath = paths.relative(req.project.path, saveEventFlowDoc(req.project.path, domain));
		return dataResponse<EventFlowCreatedModel>({ relativePath }, renderEventFlowCreated);
	},

	"events:add": (req) => {
		if (!req.project) return;
		const name = req.flags.name;
		if (!name || typeof name !== "string") {
			return dataResponse<ErrorModel>(
				{ error: "Missing --name flag.", hint: 'Usage: flowti events:add --name="user.created" --domain="user"' },
				renderError,
			);
		}
		const payload = typeof req.flags.payload === "string" ? parsePayloadFlag(req.flags.payload) : [];
		const def: EventDefinition = {
			name, domain: flagStr(req.flags, "domain", "core"), version: flagStr(req.flags, "version", "1.0.0"),
			description: flagStr(req.flags, "description", ""), producers: flagList(req.flags, "producers"),
			consumers: flagList(req.flags, "consumers"), payload,
		};
		const filePath = createEventFile(req.project.path, def);
		if (filePath) {
			return dataResponse<EventAddedModel>(
				{ relativePath: paths.relative(req.project.path, filePath) },
				renderEventAdded,
			);
		}
	},

	"events:validate": (req) => {
		if (!req.project) return;
		const dir = paths.join(req.project.path, "docs", "events");
		const contracts = loadEventContracts(dir);
		if (contracts.length === 0) {
			return dataResponse<EmptyModel>({ message: "No events found in docs/events/." }, renderEmpty);
		}
		const result = validateContracts(contracts);
		const model: ContractValidationModel = { contractCount: contracts.length, result };
		return {
			data: model,
			render: renderContractValidation,
			exitCode: result.valid ? undefined : 1,
		};
	},

	"events:check-payload": (req) => {
		if (!req.project) return;
		const eventName = req.flags.event;
		const payloadJson = req.flags.payload;
		if (!eventName || typeof eventName !== "string" || !payloadJson || typeof payloadJson !== "string") {
			return dataResponse<ErrorModel>(
				{ error: "Missing --event and/or --payload flag.", hint: "Usage: flowti events:check-payload --event=\"user.created\" --payload='{\"id\":\"1\"}'" },
				renderError,
			);
		}
		const dir = paths.join(req.project.path, "docs", "events");
		const contracts = loadEventContracts(dir);
		const contract = findContract(contracts, eventName);
		if (!contract) {
			return {
				data: { error: `No contract found for event "${eventName}".` } as ErrorModel,
				render: renderError,
				exitCode: 1,
			};
		}
		let payload: Record<string, unknown>;
		try {
			payload = JSON.parse(payloadJson) as Record<string, unknown>;
		} catch {
			return {
				data: { error: "Invalid JSON payload." } as ErrorModel,
				render: renderError,
				exitCode: 1,
			};
		}
		const result = validatePayload(contract, payload);
		const model: PayloadValidationModel = { eventName, result };
		return {
			data: model,
			render: renderPayloadValidation,
			exitCode: result.valid ? undefined : 1,
		};
	},

	"events:contracts": (req) => {
		if (!req.project) return;
		const dir = paths.join(req.project.path, "docs", "events");
		const contracts = loadEventContracts(dir);
		if (contracts.length === 0) {
			return dataResponse<EmptyModel>({ message: "No events found in docs/events/." }, renderEmpty);
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
			renderContractsGenerated,
		);
	},

	"events:codegen": (req) => {
		if (!req.project) return;
		const dir = paths.join(req.project.path, "docs", "events");
		const contracts = loadEventContracts(dir);
		if (contracts.length === 0) {
			return dataResponse<EmptyModel>({ message: "No events found in docs/events/." }, renderEmpty);
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
			renderCodegenGenerated,
		);
	},
};

// ── Merge version commands ──────────────────────────────────────────

// Version commands use legacy signature — wrap them via adapt
const adaptedVersionCommands = Object.fromEntries(
	Object.entries(versionCommands).map(([key, handler]) => [key, handler]),
);

// ── Adapted commands ────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = {
	...Object.fromEntries(
		Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
	),
	...adaptedVersionCommands,
};
