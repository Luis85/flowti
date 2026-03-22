/**
 * Create / update / delete agent markdown + companion JSON in the vault (Obsidian API).
 */

import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { App } from "obsidian";
import { TFile } from "obsidian";
import type { AgentBlueprint } from "../../domain/projects/types.js";
import {
	agentVaultPaths,
	buildAgentMarkdownFile,
	buildAgentCompanionJson,
} from "../../domain/projects/agent-note-builder.js";
import { runAgentDashboardSync } from "../projects/flowti-cli-run.js";
import { writeCursorAgentRuleFile, removeCursorAgentRuleFileIfFlowti } from "./cursor-rule-export.js";
import type { FlowtiSettings } from "../../domain/settings/settings.js";

export interface SaveAgentDefinitionResult {
	ok: boolean;
	error?: string;
}

export interface SaveAgentDefinitionOptions {
	/** When renaming, old display name — vault files and Cursor rule for this name are removed first. */
	readonly previousDisplayName?: string;
}

async function trashVaultFileIfExists(app: App, vaultRelativePath: string): Promise<void> {
	const abstract = app.vault.getAbstractFileByPath(vaultRelativePath);
	if (abstract instanceof TFile) {
		await app.fileManager.trashFile(abstract);
	}
}

function normalizeVaultRelativePath(vaultRelativePath: string): string {
	return vaultRelativePath.replace(/\\/g, "/").replace(/^\/+/, "");
}

/**
 * Create or overwrite a note at a vault-relative path.
 * Resolves Obsidian missing the file in its index (case mismatch, sync lag) when `create` would throw "already exists".
 */
export async function upsertVaultTextFile(app: App, vaultRelativePath: string, body: string): Promise<void> {
	const pathNorm = normalizeVaultRelativePath(vaultRelativePath);
	let existing = app.vault.getAbstractFileByPath(pathNorm);
	if (existing && "children" in existing) {
		throw new Error(`Expected a file at "${pathNorm}" but found a folder.`);
	}
	if (existing instanceof TFile) {
		await app.vault.modify(existing, body);
		return;
	}
	const lower = pathNorm.toLowerCase();
	const byPath = app.vault.getFiles().find((f) => f.path.toLowerCase() === lower);
	if (byPath) {
		await app.vault.modify(byPath, body);
		return;
	}
	try {
		await app.vault.create(pathNorm, body);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		if (!/exists|already exist/i.test(msg)) throw e;
		existing = app.vault.getAbstractFileByPath(pathNorm);
		if (existing instanceof TFile) {
			await app.vault.modify(existing, body);
			return;
		}
		const retry = app.vault.getFiles().find((f) => f.path.toLowerCase() === lower);
		if (retry) {
			await app.vault.modify(retry, body);
			return;
		}
		throw e;
	}
}

/** @internal */
async function writeVaultTextFile(app: App, vaultRelativePath: string, body: string): Promise<void> {
	await upsertVaultTextFile(app, vaultRelativePath, body);
}

/** Write companion JSON, or move an existing JSON note to trash when the payload is empty. */
async function writeCompanionOrTrash(app: App, jsonPath: string, companion: string | null): Promise<void> {
	if (companion) {
		await writeVaultTextFile(app, jsonPath, companion);
	} else {
		await trashVaultFileIfExists(app, jsonPath);
	}
}

async function removeAgentVaultArtifacts(
	app: App,
	vaultBasePath: string,
	displayName: string,
	getSettings: () => FlowtiSettings,
): Promise<SaveAgentDefinitionResult> {
	const name = displayName.trim();
	if (!name) return { ok: false, error: "Agent name is required." };
	const { md: mdPath, json: jsonPath } = agentVaultPaths(name);
	try {
		await trashVaultFileIfExists(app, mdPath);
		await trashVaultFileIfExists(app, jsonPath);
		const settings = getSettings();
		const workspaceRoot = (settings.cursorRulesWorkspaceRoot?.trim() || vaultBasePath).trim() || vaultBasePath;
		removeCursorAgentRuleFileIfFlowti(workspaceRoot, name);
	} catch (e) {
		return { ok: false, error: e instanceof Error ? e.message : "Failed to remove agent files." };
	}
	return { ok: true };
}

async function persistAgentMarkdownAndJson(
	app: App,
	vaultBasePath: string,
	mdPath: string,
	jsonPath: string,
	mdBody: string,
	companion: string | null,
): Promise<void> {
	await mkdir(join(vaultBasePath, dirname(mdPath)), { recursive: true });
	await writeVaultTextFile(app, mdPath, mdBody);
	await writeCompanionOrTrash(app, jsonPath, companion);
}

function exportCursorRuleForAgent(
	vaultBasePath: string,
	getSettings: () => FlowtiSettings,
	displayName: string,
	mdPath: string,
	blueprint: AgentBlueprint,
): void {
	const settings = getSettings();
	const workspaceRoot = (settings.cursorRulesWorkspaceRoot?.trim() || vaultBasePath).trim() || vaultBasePath;
	const globs = blueprint.cursorRuleGlobs?.filter((g) => g.trim()) ?? [];
	writeCursorAgentRuleFile(workspaceRoot, {
		displayName,
		persona: blueprint.persona,
		systemPrompt: blueprint.ai?.systemPrompt,
		vaultAgentMdPath: mdPath,
		globs: globs.length > 0 ? globs : undefined,
	});
}

/**
 * Persist agent note + optional companion JSON, export Cursor rule, run dashboard sync.
 */
export async function saveAgentDefinition(
	app: App,
	vaultBasePath: string,
	displayName: string,
	blueprint: AgentBlueprint,
	getSettings: () => FlowtiSettings,
	onLog?: (line: string) => void,
	options?: SaveAgentDefinitionOptions,
): Promise<SaveAgentDefinitionResult> {
	const name = displayName.trim();
	if (!name) return { ok: false, error: "Agent name is required." };
	const prev = options?.previousDisplayName?.trim();
	if (prev && prev !== name) {
		const removed = await removeAgentVaultArtifacts(app, vaultBasePath, prev, getSettings);
		if (!removed.ok) return removed;
	}
	const { md: mdPath, json: jsonPath } = agentVaultPaths(name);
	const mdBody = buildAgentMarkdownFile(name, blueprint);
	const companion = buildAgentCompanionJson(blueprint);

	try {
		await persistAgentMarkdownAndJson(app, vaultBasePath, mdPath, jsonPath, mdBody, companion);
		exportCursorRuleForAgent(vaultBasePath, getSettings, name, mdPath, blueprint);
	} catch (e) {
		return { ok: false, error: e instanceof Error ? e.message : "Failed to save agent files." };
	}

	const sync = await runAgentDashboardSync(vaultBasePath, onLog);
	if (!sync.ok) return { ok: false, error: sync.error ?? "agent:dashboard-sync failed." };
	return { ok: true };
}

export async function deleteAgentDefinition(
	app: App,
	vaultBasePath: string,
	displayName: string,
	getSettings: () => FlowtiSettings,
	onLog?: (line: string) => void,
): Promise<SaveAgentDefinitionResult> {
	const name = displayName.trim();
	if (!name) return { ok: false, error: "Agent name is required." };
	const removed = await removeAgentVaultArtifacts(app, vaultBasePath, name, getSettings);
	if (!removed.ok) return removed;
	const sync = await runAgentDashboardSync(vaultBasePath, onLog);
	if (!sync.ok) return { ok: false, error: sync.error ?? "agent:dashboard-sync failed." };
	return { ok: true };
}
