/**
 * events.controller.ts — Controller for event catalog commands.
 *
 * Returns typed data models; rendering is handled by ui/events-display.ts.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types.js";
import type { LogFn } from "../infrastructure/command-engine.js";
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

function flagList(flags: Record<string, unknown>, key: string): string[] {
	return typeof flags[key] === "string" ? parseCommaSeparated(flags[key] as string) : [];
}

// ── Union model types & renderers ────────────────────────────────────

type EventAddResult = EventAddedModel | ErrorModel;
type ValidateResult = ContractValidationModel | EmptyModel;
type CheckPayloadResult = PayloadValidationModel | ErrorModel;
type ContractsResult = ContractsGeneratedModel | EmptyModel;
type CodegenResult = CodegenGeneratedModel | EmptyModel;
type VersionResult = VersionEventModel | ErrorModel;

function isErrorModel(m: unknown): m is ErrorModel {
	return typeof m === "object" && m !== null && "error" in m;
}

function renderEventAddResult(data: EventAddResult, log: LogFn): void {
	if (isErrorModel(data)) { renderError(data, log); return; }
	renderEventAdded(data, log);
}

function renderValidateResult(data: ValidateResult, log: LogFn): void {
	if ("message" in data) { renderEmpty(data as EmptyModel, log); return; }
	renderContractValidation(data as ContractValidationModel, log);
}

function renderCheckPayloadResult(data: CheckPayloadResult, log: LogFn): void {
	if (isErrorModel(data)) { renderError(data, log); return; }
	renderPayloadValidation(data as PayloadValidationModel, log);
}

function renderContractsResult(data: ContractsResult, log: LogFn): void {
	if ("message" in data) { renderEmpty(data as EmptyModel, log); return; }
	renderContractsGenerated(data as ContractsGeneratedModel, log);
}

function renderCodegenResult(data: CodegenResult, log: LogFn): void {
	if ("message" in data) { renderEmpty(data as EmptyModel, log); return; }
	renderCodegenGenerated(data as CodegenGeneratedModel, log);
}

function renderVersionResult(data: VersionResult, log: LogFn): void {
	if (isErrorModel(data)) { renderError(data, log); return; }
	renderVersionEvent(data as VersionEventModel, log);
}

// ── Commands ────────────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = {
	"events:list": adaptDescriptor<Record<string, unknown>, EventListModel>({
		requires: "project",
		handler: (ctx) => {
			const events = listEvents(ctx.deps, ctx.project!.path);
			return { events };
		},
		renderer: renderEventList,
	}),

	"events:flow": adaptDescriptor<Record<string, unknown>, EventFlowCreatedModel>({
		requires: "project",
		flags: {
			domain: { type: "string", default: "" },
		},
		handler: (ctx) => {
			const { paths } = ctx.deps;
			const domain = (ctx.flags.domain as string) || undefined;
			const relativePath = paths.relative(ctx.project!.path, saveEventFlowDoc(ctx.deps, ctx.project!.path, domain));
			return { relativePath };
		},
		renderer: renderEventFlowCreated,
	}),

	"events:add": adaptDescriptor<Record<string, unknown>, EventAddResult>({
		requires: "project",
		flags: {
			name: { type: "string", default: "" },
			domain: { type: "string", default: "core" },
			version: { type: "string", default: "1.0.0" },
			description: { type: "string", default: "" },
			producers: { type: "string", default: "" },
			consumers: { type: "string", default: "" },
			payload: { type: "string", default: "" },
		},
		handler: (ctx) => {
			const { paths } = ctx.deps;
			const name = ctx.flags.name as string;
			if (!name) {
				return { error: "Missing --name flag.", hint: 'Usage: flowti events:add --name="user.created" --domain="user"' } as ErrorModel;
			}
			const payloadRaw = ctx.flags.payload as string;
			const payload = payloadRaw ? parsePayloadFlag(payloadRaw) : [];
			const def: EventDefinition = {
				name,
				domain: ctx.flags.domain as string,
				version: ctx.flags.version as string,
				description: ctx.flags.description as string,
				producers: flagList(ctx.flags as Record<string, unknown>, "producers"),
				consumers: flagList(ctx.flags as Record<string, unknown>, "consumers"),
				payload,
			};
			const filePath = createEventFile(ctx.deps, ctx.project!.path, def);
			if (filePath) {
				return { relativePath: paths.relative(ctx.project!.path, filePath) } as EventAddedModel;
			}
			return { error: "Failed to create event file." } as ErrorModel;
		},
		renderer: renderEventAddResult,
	}),

	"events:validate": adaptDescriptor<Record<string, unknown>, ValidateResult>({
		requires: "project",
		handler: (ctx) => {
			const { disk, paths } = ctx.deps;
			const dir = paths.join(ctx.project!.path, "docs", "events");
			const contracts = loadEventContracts(ctx.deps, dir, disk);
			if (contracts.length === 0) {
				return { message: "No events found in docs/events/." } as EmptyModel;
			}
			const result = validateContracts(contracts);
			return { contractCount: contracts.length, result } as ContractValidationModel;
		},
		renderer: renderValidateResult,
		exitCode: (model) => {
			if ("message" in model) return undefined;
			const m = model as ContractValidationModel;
			return m.result.valid ? undefined : 1;
		},
	}),

	"events:check-payload": adaptDescriptor<Record<string, unknown>, CheckPayloadResult>({
		requires: "project",
		flags: {
			event: { type: "string", default: "" },
			payload: { type: "string", default: "" },
		},
		handler: (ctx) => {
			const { disk, paths } = ctx.deps;
			const eventName = ctx.flags.event as string;
			const payloadJson = ctx.flags.payload as string;
			if (!eventName || !payloadJson) {
				return { error: "Missing --event and/or --payload flag.", hint: "Usage: flowti events:check-payload --event=\"user.created\" --payload='{\"id\":\"1\"}'" } as ErrorModel;
			}
			const dir = paths.join(ctx.project!.path, "docs", "events");
			const contracts = loadEventContracts(ctx.deps, dir, disk);
			const contract = findContract(contracts, eventName);
			if (!contract) {
				return { error: `No contract found for event "${eventName}".` } as ErrorModel;
			}
			let payload: Record<string, unknown>;
			try {
				payload = JSON.parse(payloadJson) as Record<string, unknown>;
			} catch {
				return { error: "Invalid JSON payload." } as ErrorModel;
			}
			const result = validatePayload(contract, payload);
			return { eventName, result } as PayloadValidationModel;
		},
		renderer: renderCheckPayloadResult,
		exitCode: (model) => {
			if (isErrorModel(model)) return 1;
			const m = model as PayloadValidationModel;
			return m.result.valid ? undefined : 1;
		},
	}),

	"events:contracts": adaptDescriptor<Record<string, unknown>, ContractsResult>({
		requires: "project",
		flags: {
			out: { type: "string", default: "" },
		},
		handler: (ctx) => {
			const { disk, paths } = ctx.deps;
			const dir = paths.join(ctx.project!.path, "docs", "events");
			const contracts = loadEventContracts(ctx.deps, dir, disk);
			if (contracts.length === 0) {
				return { message: "No events found in docs/events/." } as EmptyModel;
			}
			const outPath = (ctx.flags.out as string)
				? paths.resolve(ctx.project!.path, ctx.flags.out as string)
				: paths.join(dir, "contracts.json");
			const json = generateContractsJson(contracts);
			const outDir = paths.dirname(outPath);
			disk.mkdirSync(outDir, { recursive: true });
			disk.writeFileSync(outPath, json, "utf-8");
			return { relativePath: paths.relative(ctx.project!.path, outPath), contractCount: contracts.length } as ContractsGeneratedModel;
		},
		renderer: renderContractsResult,
	}),

	"events:codegen": adaptDescriptor<Record<string, unknown>, CodegenResult>({
		requires: "project",
		flags: {
			out: { type: "string", default: "" },
		},
		handler: (ctx) => {
			const { disk, paths } = ctx.deps;
			const dir = paths.join(ctx.project!.path, "docs", "events");
			const contracts = loadEventContracts(ctx.deps, dir, disk);
			if (contracts.length === 0) {
				return { message: "No events found in docs/events/." } as EmptyModel;
			}
			const ts = generateEventTypes(contracts);
			const outPath = (ctx.flags.out as string)
				? paths.resolve(ctx.project!.path, ctx.flags.out as string)
				: paths.join(ctx.project!.path, "src", "generated", "event-types.ts");
			const outDir = paths.dirname(outPath);
			disk.mkdirSync(outDir, { recursive: true });
			disk.writeFileSync(outPath, ts, "utf-8");
			return { relativePath: paths.relative(ctx.project!.path, outPath), contractCount: contracts.length } as CodegenGeneratedModel;
		},
		renderer: renderCodegenResult,
	}),

	"events:version": adaptDescriptor<Record<string, unknown>, VersionResult>({
		requires: "project",
		flags: {
			name: { type: "string", default: "" },
			version: { type: "string", default: "" },
			migration: { type: "string", default: "" },
		},
		handler: (ctx) => {
			const name = ctx.flags.name as string;
			const version = ctx.flags.version as string;
			if (!name || !version) {
				return { error: "Missing required flags.", hint: 'Usage: flowti events:version --name="user.created" --version="2.0.0" --migration="Added email field"' } as ErrorModel;
			}
			const migrationNotes = ctx.flags.migration as string;
			const result = versionEvent(ctx.deps, ctx.project!.path, name, version, migrationNotes);
			if (!result.success) {
				return { error: result.error ?? "Version update failed." } as ErrorModel;
			}
			return {
				success: true,
				name: result.name,
				newVersion: result.newVersion,
				previousVersion: result.previousVersion,
			} as VersionEventModel;
		},
		renderer: renderVersionResult,
	}),
};
