/**
 * DOM highlighting helpers for E2E test screenshots.
 *
 * Injects CSS animations and applies highlight classes to elements
 * before test actions, making interactions visible in screenshots.
 *
 * All manipulation happens through cli.eval() — no direct DOM access.
 *
 * Colors:
 *   - Input focus:  blue glow (#4fc3f7)
 *   - Button hover: orange pulse (#ffb74d)
 *   - Generic:      green outline (#81c784)
 */
import type { ObsidianCli } from "../../../src/infrastructure/cli/ObsidianCli";

const E2E_STYLE_ID = "flowti-e2e-highlight-styles";

const HIGHLIGHT_CSS = `
.ft-e2e-highlight-input {
  outline: 3px solid #4fc3f7 !important;
  box-shadow: 0 0 12px 4px rgba(79, 195, 247, 0.5) !important;
  transition: box-shadow 0.3s ease;
}
.ft-e2e-highlight-button {
  outline: 3px solid #ffb74d !important;
  box-shadow: 0 0 12px 4px rgba(255, 183, 77, 0.5) !important;
  animation: ft-e2e-pulse 0.6s ease-in-out 2 !important;
}
.ft-e2e-highlight-element {
  outline: 3px solid #81c784 !important;
  box-shadow: 0 0 10px 3px rgba(129, 199, 132, 0.4) !important;
}
@keyframes ft-e2e-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.03); }
}
`.trim();

/**
 * Injects the E2E highlight CSS into Obsidian's DOM.
 * Safe to call multiple times — skips if already injected.
 */
export function injectHighlightStyles(cli: ObsidianCli): void {
	cli.eval([
		`if (!document.getElementById('${E2E_STYLE_ID}')) {`,
		`  const s = document.createElement('style');`,
		`  s.id = '${E2E_STYLE_ID}';`,
		`  s.textContent = ${JSON.stringify(HIGHLIGHT_CSS)};`,
		`  document.head.appendChild(s);`,
		`}`,
	].join(" "));
}

/**
 * Highlights an input element: focuses it and adds a blue glow.
 * The highlight persists until clearHighlights() is called.
 */
export function highlightInput(cli: ObsidianCli, selector: string): void {
	const escaped = selector.replace(/'/g, "\\'");
	cli.eval([
		`(() => {`,
		`  const el = document.querySelector('${escaped}');`,
		`  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('ft-e2e-highlight-input'); el.focus(); }`,
		`})()`,
	].join(" "));
}

/**
 * Highlights a button element: adds an orange pulse animation.
 * Scrolls into view if the element is outside the visible area.
 * The highlight persists until clearHighlights() is called.
 */
export function highlightButton(cli: ObsidianCli, selector: string): void {
	const escaped = selector.replace(/'/g, "\\'");
	cli.eval([
		`(() => {`,
		`  const el = document.querySelector('${escaped}');`,
		`  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('ft-e2e-highlight-button'); }`,
		`})()`,
	].join(" "));
}

/**
 * Highlights any element by selector: adds a green outline.
 * Scrolls into view if the element is outside the visible area.
 */
export function highlightElement(cli: ObsidianCli, selector: string): void {
	const escaped = selector.replace(/'/g, "\\'");
	cli.eval([
		`(() => {`,
		`  const el = document.querySelector('${escaped}');`,
		`  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('ft-e2e-highlight-element'); }`,
		`})()`,
	].join(" "));
}

/**
 * Removes all highlight classes from all elements.
 */
export function clearHighlights(cli: ObsidianCli): void {
	cli.eval(
		"document.querySelectorAll('.ft-e2e-highlight-input,.ft-e2e-highlight-button,.ft-e2e-highlight-element').forEach(el => { el.classList.remove('ft-e2e-highlight-input','ft-e2e-highlight-button','ft-e2e-highlight-element'); })",
	);
}
