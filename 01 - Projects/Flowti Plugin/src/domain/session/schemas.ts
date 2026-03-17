/**
 * Zod schemas for session domain types (TD-120).
 *
 * Follows the settings.ts pattern: define schema, use `satisfies z.ZodType<T>`.
 * Replaces hand-written validation in SessionService.
 */

import { z } from "zod";

// ── Artifact ─────────────────────────────────────────────────

export const SessionArtifactSchema = z.object({
	path: z.string().min(1),
	action: z.enum(["created", "modified"]),
	timestamp: z.string().min(1),
});

// ── Template ─────────────────────────────────────────────────

const ContextBindingSchema = z.object({
	path: z.string(),
	type: z.enum(["domain", "feature", "product", "file", "folder"]),
});

const ReflectionSchema = z.object({
	type: z.enum(["observation", "blocker", "idea", "decision"]),
	content: z.string(),
});

export const SessionTemplateSchema = z.object({
	id: z.string().min(1),
	name: z.string().refine((s) => s.trim().length > 0),
	type: z.string().min(1),
	durationMinutes: z.number().positive(),
	description: z.string().optional(),
	focusFile: z.string().optional(),
	goals: z.array(z.string()).optional(),
	decisions: z.array(z.string()).optional(),
	tasks: z.array(z.string()).optional(),
	contextBindings: z.array(ContextBindingSchema).optional(),
	notes: z.string().optional(),
	reflections: z.array(ReflectionSchema).optional(),
	createdAt: z.number(),
});

// ── Template export ──────────────────────────────────────────

const TemplateBodySchema = z.object({
	name: z.string().refine((s) => s.trim().length > 0),
	type: z.string().min(1),
	durationMinutes: z.number().positive(),
	description: z.string().optional(),
	focusFile: z.string().optional(),
	goals: z.array(z.string()).optional(),
	decisions: z.array(z.string()).optional(),
	tasks: z.array(z.string()).optional(),
	contextBindings: z.array(ContextBindingSchema).optional(),
	notes: z.string().optional(),
	reflections: z.array(ReflectionSchema).optional(),
});

export const SessionTemplateExportSchema = z.object({
	version: z.literal(1),
	template: TemplateBodySchema,
});
