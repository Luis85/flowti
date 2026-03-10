/**
 * events-display.ts — Console display helpers for event catalog commands.
 *
 * Pure display functions that render event data models with ANSI colors.
 * Controllers pass these as render callbacks to dataResponse().
 */

import { RESET, DIM, GREEN, RED } from "../infrastructure/ui.js";
import { log } from "../infrastructure/logger.js";
import type { ContractIssue, ContractValidationResult, PayloadValidationResult } from "../domain/events/event-contracts.js";

// ── Data models ──────────────────────────────────────────────────────

export interface EventListEntry {
	name: string;
	domain: string;
	version: string;
	file: string;
}

export interface EventListModel {
	events: EventListEntry[];
}

export interface EventFlowCreatedModel {
	relativePath: string;
}

export interface EventAddedModel {
	relativePath: string;
}

export interface ContractValidationModel {
	contractCount: number;
	result: ContractValidationResult;
}

export interface PayloadValidationModel {
	eventName: string;
	result: PayloadValidationResult;
}

export interface ContractsGeneratedModel {
	relativePath: string;
	contractCount: number;
}

export interface CodegenGeneratedModel {
	relativePath: string;
	contractCount: number;
}

export interface EmptyModel {
	message: string;
}

// ── Renderers ────────────────────────────────────────────────────────

export function renderEventList(data: EventListModel): void {
	if (data.events.length === 0) {
		log(`\n  ${DIM}No events defined.${RESET}\n`);
		return;
	}
	for (const evt of data.events) log(`  ${evt.name} [${evt.domain}] v${evt.version}`);
}

export function renderEventFlowCreated(data: EventFlowCreatedModel): void {
	log(`\n  ${GREEN}\u2713${RESET} Generated: ${data.relativePath}\n`);
}

export function renderEventAdded(data: EventAddedModel): void {
	log(`\n  ${GREEN}\u2713${RESET} Created: ${data.relativePath}\n`);
}

export function renderContractValidation(data: ContractValidationModel): void {
	log(`\n  Validated ${data.contractCount} event contract(s).\n`);
	if (data.result.issues.length === 0) {
		log(`  ${GREEN}\u2713${RESET} All contracts are valid.\n`);
		return;
	}
	const errors = data.result.issues.filter((i: ContractIssue) => i.severity === "error");
	const warnings = data.result.issues.filter((i: ContractIssue) => i.severity === "warning");
	for (const issue of errors) {
		const fieldTag = issue.field ? ` \u2192 ${issue.field}` : "";
		log(`  ${RED}\u2717${RESET} ${issue.event}${fieldTag}: ${issue.message}`);
	}
	for (const issue of warnings) {
		const fieldTag = issue.field ? ` \u2192 ${issue.field}` : "";
		log(`  ${DIM}\u26A0${RESET} ${issue.event}${fieldTag}: ${issue.message}`);
	}
	log();
	if (data.result.valid) {
		log(`  ${GREEN}\u2713${RESET} ${errors.length} error(s), ${warnings.length} warning(s) \u2014 contracts valid.\n`);
	} else {
		log(`  ${RED}\u2717${RESET} ${errors.length} error(s), ${warnings.length} warning(s) \u2014 contracts invalid.\n`);
	}
}

export function renderPayloadValidation(data: PayloadValidationModel): void {
	if (data.result.valid) {
		log(`\n  ${GREEN}\u2713${RESET} Payload valid for "${data.eventName}".\n`);
	} else {
		log(`\n  ${RED}\u2717${RESET} Payload invalid for "${data.eventName}":`);
		for (const err of data.result.errors) log(`    ${RED}\u2022${RESET} ${err}`);
		log();
	}
}

export function renderContractsGenerated(data: ContractsGeneratedModel): void {
	log(`\n  ${GREEN}\u2713${RESET} Generated: ${data.relativePath} (${data.contractCount} contracts)\n`);
}

export function renderCodegenGenerated(data: CodegenGeneratedModel): void {
	log(`\n  ${GREEN}\u2713${RESET} Generated: ${data.relativePath} (${data.contractCount} interfaces)\n`);
}

export function renderEmpty(data: EmptyModel): void {
	log(`\n  ${DIM}${data.message}${RESET}\n`);
}
