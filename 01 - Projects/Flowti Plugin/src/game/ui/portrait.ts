/**
 * portrait.ts — Portrait rendering helpers.
 *
 * Pure helpers for Faceset image paths and fallback initials,
 * plus a Lit render function for circular agent portraits with
 * trust-tier coloured borders and error-driven text fallbacks.
 */

import { html, type TemplateResult } from "lit";
import { resolveCharacter } from "../sprites/character-pool.js";
import { TRUST_TIER_COLORS } from "./game-ui-constants.js";

/* ── Pure helpers ─────────────────────────────────────────────────── */

export function portraitSrc(characterName: string): string {
	return `assets/Actor/Characters/${characterName}/Faceset.png`;
}

export function fallbackInitial(name: string): string {
	return (name || "?").charAt(0).toUpperCase();
}

/* ── Lit render ───────────────────────────────────────────────────── */

export function renderPortrait(
	agentName: string,
	domain: string,
	size: number,
	trustTier?: string,
): TemplateResult {
	const character = resolveCharacter(agentName, domain);
	const src = portraitSrc(character);
	const initial = fallbackInitial(agentName);
	const borderColor = trustTier ? (TRUST_TIER_COLORS[trustTier] ?? "#6b7280") : "#6b7280";

	const imgStyle = [
		`width:${size}px`,
		`height:${size}px`,
		"border-radius:50%",
		`border:2px solid ${borderColor}`,
		"image-rendering:pixelated",
		"object-fit:cover",
	].join(";");

	const fallbackStyle = [
		"display:none",
		`width:${size}px`,
		`height:${size}px`,
		"border-radius:50%",
		`border:2px solid ${borderColor}`,
		"background:#374151",
		"color:#e5e7eb",
		`font-size:${Math.round(size * 0.5)}px`,
		"font-weight:bold",
		"align-items:center",
		"justify-content:center",
	].join(";");

	const onError = (e: Event) => {
		const img = e.target as HTMLImageElement;
		img.style.display = "none";
		const fallback = img.nextElementSibling as HTMLElement | null;
		if (fallback) fallback.style.display = "flex";
	};

	return html`
		<img
			src=${src}
			alt=${agentName}
			style=${imgStyle}
			@error=${onError}
		/>
		<div style=${fallbackStyle}>${initial}</div>
	`;
}
