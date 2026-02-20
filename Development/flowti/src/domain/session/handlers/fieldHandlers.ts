/**
 * Field update handlers — intent, energy, duration, notes, links,
 * context bindings, decisions, reflections, workspace state,
 * output artifacts, and type configuration.
 *
 * Extracted from SessionService (TD-101).
 */

import { generateUUID } from "../../../utils/helpers";
import type { ContextBindingType, EnergyLevel, ReflectionEntry, Session, SessionContextBinding, SessionIntent, SessionLink, SessionOutputArtifact, SessionOutputTemplate, SessionTypeConfig, WorkspaceState } from "../types";
import { MAX_CONTEXT_BINDINGS, MAX_SESSION_DECISIONS, MAX_OUTPUT_ARTIFACTS, SESSION_NOTES_FOLDER, SESSION_TYPE_CONFIGS } from "../types";
import { createContextBinding, createDecision, generateSessionOutput, resolveTypeConfig } from "../helpers";
import type { SessionHandlerContext } from "./types";

// ── Intent & Energy (ADR-031) ────────────────────────────

export async function handleSetIntent(ctx: SessionHandlerContext, sessionId: string, intent: SessionIntent): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session) return;
	if (session.status !== "prepared" && session.status !== "paused") return;

	const previous = session.intent;
	session.intent = { ...intent };
	await ctx.saveState();
	await ctx.eventBus?.emit("session.intent.updated", { sessionId, intent: { ...intent }, previous });
	if (intent.mode && (!previous || previous.mode !== intent.mode)) {
		await ctx.eventBus?.emit("session.mode.set", { sessionId, mode: intent.mode });
	}
}

export async function handleEnergyChange(ctx: SessionHandlerContext, sessionId: string, level: EnergyLevel): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session) return;
	if (session.status !== "running" && session.status !== "paused") return;

	const before = session.energy;
	session.energy = level;
	await ctx.saveState();
	await ctx.eventBus?.emit("session.energy.changed", { sessionId, before, after: level });
	ctx.scheduleSyncNotesFile(sessionId);
	ctx.checkCognitiveOverload(sessionId);
}

// ── Duration ─────────────────────────────────────────────

export async function handleDurationUpdate(ctx: SessionHandlerContext, sessionId: string, durationMinutes: number): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session || session.status !== "prepared") return;
	if (durationMinutes < 1) return;

	session.durationMinutes = durationMinutes;
	await ctx.saveState();
	await ctx.eventBus?.emit("session.duration.updated", { sessionId, durationMinutes });
}

// ── Notes ────────────────────────────────────────────────

export async function handleNotesUpdate(ctx: SessionHandlerContext, sessionId: string, notes: string): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session) return;

	session.notes = notes;
	await ctx.saveState();
	await ctx.eventBus?.emit("session.notes.updated", { sessionId, notes });
	ctx.scheduleSyncNotesFile(sessionId);
}

export async function handleNotesFileSet(ctx: SessionHandlerContext, sessionId: string, path: string): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session) return;

	session.notesFile = path;
	await ctx.saveState();
	await ctx.eventBus?.emit("session.notesFile.updated", { sessionId, path });
}

export async function handleCanvasFileSet(ctx: SessionHandlerContext, sessionId: string, path: string): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session) return;

	session.canvasFile = path;
	await ctx.saveState();
	await ctx.eventBus?.emit("session.canvasFile.updated", { sessionId, path });
}

// ── Links ────────────────────────────────────────────────

export async function handleLinkAdd(ctx: SessionHandlerContext, sessionId: string, path: string): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session) return;

	if (session.links.some((l) => l.path === path)) return;

	const link: SessionLink = { path, addedAt: new Date().toISOString() };
	session.links.push(link);
	await ctx.saveState();
	await ctx.eventBus?.emit("session.link.added", { sessionId, link: { ...link } });
}

export async function handleLinkRemove(ctx: SessionHandlerContext, sessionId: string, path: string): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session) return;

	const index = session.links.findIndex((l) => l.path === path);
	if (index === -1) return;

	session.links.splice(index, 1);
	await ctx.saveState();
	await ctx.eventBus?.emit("session.link.removed", { sessionId, path });
}

// ── Context bindings ─────────────────────────────────────

export async function handleContextBind(ctx: SessionHandlerContext, sessionId: string, path: string, type: ContextBindingType): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session) return;

	if (session.contextBindings.some((b) => b.path === path)) return;
	if (session.contextBindings.length >= MAX_CONTEXT_BINDINGS) return;

	const binding: SessionContextBinding = createContextBinding(`ctx_${generateUUID()}`, type, path);
	session.contextBindings.push(binding);
	await ctx.saveState();
	await ctx.eventBus?.emit("session.context.bound", { sessionId, binding: { ...binding } });
	ctx.scheduleSyncNotesFile(sessionId);
	ctx.checkCognitiveOverload(sessionId);
}

export async function handleContextUnbind(ctx: SessionHandlerContext, sessionId: string, bindingId: string): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session) return;

	const index = session.contextBindings.findIndex((b) => b.id === bindingId);
	if (index === -1) return;

	session.contextBindings.splice(index, 1);
	await ctx.saveState();
	await ctx.eventBus?.emit("session.context.unbound", { sessionId, bindingId });
	ctx.scheduleSyncNotesFile(sessionId);
	ctx.checkCognitiveOverload(sessionId);
}

export async function handleContextChangeType(ctx: SessionHandlerContext, sessionId: string, bindingId: string, type: ContextBindingType): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session) return;

	const binding = session.contextBindings.find((b) => b.id === bindingId);
	if (!binding) return;

	binding.type = type;
	await ctx.saveState();
	await ctx.eventBus?.emit("session.context.typeChanged", { sessionId, bindingId, type });
	ctx.scheduleSyncNotesFile(sessionId);
}

// ── Decisions ────────────────────────────────────────────

export async function handleDecisionRecord(ctx: SessionHandlerContext, sessionId: string, title: string, description?: string, context?: string): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session || !title.trim()) return;
	if (session.decisions.length >= MAX_SESSION_DECISIONS) return;

	const decision = createDecision(`dec_${generateUUID()}`, title.trim(), description?.trim() || undefined, context?.trim() || undefined);
	session.decisions.push(decision);
	await ctx.saveState();
	await ctx.eventBus?.emit("session.decision.recorded", { sessionId, decision: { ...decision } });
	ctx.scheduleSyncNotesFile(sessionId);
}

export async function handleDecisionRemove(ctx: SessionHandlerContext, sessionId: string, decisionId: string): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session) return;

	const idx = session.decisions.findIndex((d) => d.id === decisionId);
	if (idx === -1) return;

	session.decisions.splice(idx, 1);
	await ctx.saveState();
	await ctx.eventBus?.emit("session.decision.removed", { sessionId, decisionId });
	ctx.scheduleSyncNotesFile(sessionId);
}

// ── Reflections (FR-13) ──────────────────────────────────

export async function handleReflectionAdd(ctx: SessionHandlerContext, sessionId: string, type: ReflectionEntry["type"], content: string): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session || !content.trim()) return;
	if (session.status !== "running" && session.status !== "paused") return;

	const entry: ReflectionEntry = {
		id: `ref_${generateUUID()}`,
		type,
		content: content.trim(),
		timestamp: new Date().toISOString(),
	};

	session.reflections.push(entry);
	await ctx.saveState();
	await ctx.eventBus?.emit("session.reflection.added", { sessionId, entry: { ...entry } });
	ctx.scheduleSyncNotesFile(sessionId);
}

export async function handleReflectionRemove(ctx: SessionHandlerContext, sessionId: string, entryId: string): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session) return;
	if (session.status !== "running" && session.status !== "paused") return;

	const idx = session.reflections.findIndex((r) => r.id === entryId);
	if (idx === -1) return;

	session.reflections.splice(idx, 1);
	await ctx.saveState();
	await ctx.eventBus?.emit("session.reflection.removed", { sessionId, entryId });
	ctx.scheduleSyncNotesFile(sessionId);
}

// ── Workspace state ──────────────────────────────────────

export async function handleStateSaved(ctx: SessionHandlerContext, sessionId: string, state: WorkspaceState): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session) return;

	session.workspaceState = state;
	await ctx.saveState();
}

// ── Output artifacts ─────────────────────────────────────

export async function handleOutputGenerate(ctx: SessionHandlerContext, sessionId: string, template: SessionOutputTemplate): Promise<void> {
	const session = ctx.findSession(sessionId);
	if (!session) return;
	if (session.status !== "completed" && session.status !== "archived") return;
	if (session.outputArtifacts.length >= MAX_OUTPUT_ARTIFACTS) return;

	const content = generateSessionOutput(session, template);
	const safeName = session.title.replace(/[\\/:*?"<>|]/g, "-");
	const shortId = session.id.slice(-6);
	const path = `${SESSION_NOTES_FOLDER}/${safeName} - ${template.title} (${shortId}).md`;

	if (ctx.fileSystem) {
		try {
			await ctx.fileSystem.createFile(path, content);
		} catch {
			// File may already exist — continue to persist artifact
		}
	}

	if (session.notesFile && ctx.fileSystem) {
		const date = new Date().toISOString().split("T")[0];
		const wikilink = `- [[${path}]] *(generated ${date})*`;
		try {
			const existing = await ctx.fileSystem.readFile(session.notesFile);
			if (existing !== null && !existing.includes(`[[${path}]]`)) {
				const section = existing.includes("## Output Artifacts")
					? ""
					: "\n## Output Artifacts\n";
				await ctx.fileSystem.updateFile(session.notesFile, existing + section + wikilink + "\n");
			}
		} catch {
			// Notes file doesn't exist or can't be read — skip gracefully
		}
	}

	const artifact: SessionOutputArtifact = {
		type: template.type,
		path,
		generatedAt: new Date().toISOString(),
	};
	session.outputArtifacts.push(artifact);
	await ctx.saveState();
	await ctx.eventBus?.emit("session.output.generated", { sessionId, artifact });
}

// ── Type configuration ───────────────────────────────────

export async function handleTypeCreate(ctx: SessionHandlerContext, config: SessionTypeConfig): Promise<void> {
	if (!config.type || !config.label) return;
	if (SESSION_TYPE_CONFIGS[config.type as keyof typeof SESSION_TYPE_CONFIGS]) return;

	ctx.customSessionTypes[config.type] = { ...config };
	await ctx.eventBus?.emit("settings.updateCustomSessionTypes", { types: { ...ctx.customSessionTypes } });
	await ctx.eventBus?.emit("session.type.created", { config: { ...config } });
}

export async function handleTypeConfigure(ctx: SessionHandlerContext, type: string, updates: Partial<SessionTypeConfig>): Promise<void> {
	const existing = resolveTypeConfig(type as Session["type"], ctx.customSessionTypes);
	const merged: SessionTypeConfig = { ...existing, ...updates, type: type as Session["type"] };
	ctx.customSessionTypes[type] = merged;
	await ctx.eventBus?.emit("settings.updateCustomSessionTypes", { types: { ...ctx.customSessionTypes } });
	await ctx.eventBus?.emit("session.type.configured", { type: type as Session["type"], config: { ...merged } });
}
